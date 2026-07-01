/**
 * @file Git-backed roadmap branch-freshness review guard.
 */

import { cwd, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import {
  type BranchFreshnessResult,
  classifyBranchFreshness,
  type GitPathChange,
  parseRoadmapTaskFromBranch,
  parseTaskOverride,
  type RoadmapHunk,
} from "./branch-freshness";
import { parseNameStatusZ, parseRoadmapDiffHunks } from "./branch-freshness-git-parsing";
import { formatBranchFreshnessResult } from "./branch-freshness-report";
import { createGitRunner, type GitCommandResult, type GitRunner, runGit } from "./git-support";

/** Process exit status used by the command-line guard. */
export type BranchFreshnessExitCode = 0 | 1 | 2;

type CliWriters = {
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

type CliOptions = { readonly taskOverride?: string } | { readonly usageError: string };

type BranchFreshnessCheckOptions = {
  readonly cwd: string;
  readonly taskOverride?: string;
};

const protectedPathspecs = ["docs", "tests"] as const;
const originMainRef = "refs/remotes/origin/main";

/**
 * Check whether a roadmap task branch has reviewed current protected changes.
 *
 * @param options Repository directory and optional explicit task id.
 * @returns Branch-freshness result suitable for reporting.
 */
export function checkBranchFreshness(options: BranchFreshnessCheckOptions): BranchFreshnessResult {
  const git = createGitRunner(options.cwd);
  const cleanWorktreeError = checkCleanWorktree(git);

  if (cleanWorktreeError !== undefined) {
    return cleanWorktreeError;
  }

  const taskResult = resolveTaskId(git, options.taskOverride);

  if (taskResult.status !== "ready") {
    return taskResult.result;
  }

  const refreshError = refreshOriginMain(git);

  if (refreshError !== undefined) {
    return refreshError;
  }

  return classifyFetchedBranch(git, taskResult.taskId);
}

/**
 * Run the command-line guard and return its process exit code.
 *
 * @param args Command-line arguments excluding `bun` and script path.
 * @param repositoryPath Repository directory.
 * @param writers Output writers for tests and the real CLI.
 * @returns Process exit code.
 */
export function runBranchFreshnessCli(
  args: readonly string[] = [],
  repositoryPath = cwd(),
  writers: CliWriters = {
    writeOut: (message) => stdout.write(message),
    writeErr: (message) => stderr.write(message),
  },
): BranchFreshnessExitCode {
  const cliOptions = parseCliArgs(args);
  const result =
    "usageError" in cliOptions
      ? ({ status: "usage-error", message: cliOptions.usageError } satisfies BranchFreshnessResult)
      : checkBranchFreshness(makeCheckOptions(repositoryPath, cliOptions.taskOverride));
  const report = formatBranchFreshnessResult(result);

  if (result.status === "usage-error") {
    writers.writeErr(report);
    return 2;
  }

  writers.writeOut(report);

  return result.status === "stale" ? 1 : 0;
}

/** Check the dirty-worktree precondition before comparing committed state. */
const checkCleanWorktree = (git: GitRunner): BranchFreshnessResult | undefined => {
  const dirtyStatus = runGit(git, ["status", "--porcelain=v1", "-z"]);

  if (dirtyStatus.status !== 0) {
    return usageErrorResult("git status failed", dirtyStatus);
  }

  if (dirtyStatus.stdout.length > 0) {
    return {
      status: "usage-error",
      message: "working tree must be clean before branch-freshness review",
    };
  }

  return undefined;
};

/** Refresh the canonical remote-tracking branch used for freshness checks. */
const refreshOriginMain = (git: GitRunner): BranchFreshnessResult | undefined => {
  const fetchResult = runGit(git, ["fetch", "origin", `main:${originMainRef}`]);

  return fetchResult.status === 0
    ? undefined
    : usageErrorResult("git fetch origin main failed", fetchResult);
};

/** Classify the branch after `origin/main` has been refreshed. */
const classifyFetchedBranch = (git: GitRunner, taskId: string): BranchFreshnessResult => {
  const ancestorResult = runGit(git, ["merge-base", "--is-ancestor", "origin/main", "HEAD"]);

  if (ancestorResult.status === 0) {
    return classifyBranchFreshness({
      taskId,
      isOriginMainAncestor: true,
      upstreamChanges: [],
      roadmapText: "",
      roadmapHunks: [],
    });
  }

  if (ancestorResult.status !== 1) {
    return usageErrorResult("git merge-base ancestry check failed", ancestorResult);
  }

  return classifyBehindBranch(git, taskId);
};

/** Collect upstream protected changes for a branch behind `origin/main`. */
const classifyBehindBranch = (git: GitRunner, taskId: string): BranchFreshnessResult => {
  const mergeBaseResult = runGit(git, ["merge-base", "HEAD", "origin/main"]);

  if (mergeBaseResult.status !== 0) {
    return usageErrorResult("git merge-base failed", mergeBaseResult);
  }

  const mergeBase = mergeBaseResult.stdout.trim();
  const changesResult = runGit(git, [
    "diff",
    "--name-status",
    "-z",
    mergeBase,
    "origin/main",
    "--",
    ...protectedPathspecs,
  ]);

  if (changesResult.status !== 0) {
    return usageErrorResult("git diff protected paths failed", changesResult);
  }

  const upstreamChanges = parseNameStatusZ(changesResult.stdout);
  const roadmapFacts = collectRoadmapFacts(git, mergeBase, upstreamChanges);

  if (roadmapFacts.status === "usage-error") {
    return roadmapFacts.result;
  }

  return classifyBranchFreshness({
    taskId,
    isOriginMainAncestor: false,
    upstreamChanges,
    roadmapText: roadmapFacts.roadmapText,
    oldRoadmapText: roadmapFacts.oldRoadmapText,
    roadmapHunks: roadmapFacts.roadmapHunks,
  });
};

/**
 * Convert a branch-freshness result into the agreed CLI exit status.
 *
 * @param result Branch-freshness result to map.
 * @returns Process exit status for the CLI.
 */
export function exitCodeForBranchFreshness(result: BranchFreshnessResult): BranchFreshnessExitCode {
  switch (result.status) {
    case "fresh":
    case "skipped":
      return 0;
    case "stale":
      return 1;
    case "usage-error":
      return 2;
  }
}

type TaskResolution =
  | { readonly status: "ready"; readonly taskId: string }
  | { readonly status: "done"; readonly result: BranchFreshnessResult };

/** Resolve the roadmap task id from an override or the current branch name. */
const resolveTaskId = (git: GitRunner, taskOverride: string | undefined): TaskResolution => {
  if (taskOverride !== undefined) {
    const taskId = parseTaskOverride(taskOverride);

    return taskId === undefined
      ? {
          status: "done",
          result: { status: "usage-error", message: `invalid roadmap task id: ${taskOverride}` },
        }
      : { status: "ready", taskId };
  }

  const branchResult = runGit(git, ["branch", "--show-current"]);

  if (branchResult.status !== 0) {
    return {
      status: "done",
      result: usageErrorResult("git branch --show-current failed", branchResult),
    };
  }

  const branchName = branchResult.stdout.trim();
  const taskId = parseRoadmapTaskFromBranch(branchName);

  return taskId === undefined
    ? { status: "done", result: { status: "skipped", reason: "not on a roadmap task branch" } }
    : { status: "ready", taskId };
};

type RoadmapFacts =
  | {
      readonly status: "ready";
      readonly roadmapText: string;
      readonly oldRoadmapText: string;
      readonly roadmapHunks: readonly RoadmapHunk[];
    }
  | { readonly status: "usage-error"; readonly result: BranchFreshnessResult };

/** Load current and merge-base roadmap text only when the upstream changed it. */
const collectRoadmapFacts = (
  git: GitRunner,
  mergeBase: string,
  upstreamChanges: readonly GitPathChange[],
): RoadmapFacts => {
  if (!upstreamChanges.some((change) => change.path === "docs/roadmap.md")) {
    return { status: "ready", roadmapText: "", oldRoadmapText: "", roadmapHunks: [] };
  }

  const roadmapText = readRoadmapBlob(git, "origin/main");
  const oldRoadmapText = readRoadmapBlob(git, mergeBase);
  const diffResult = runGit(git, [
    "diff",
    "--unified=0",
    "--no-color",
    "--no-ext-diff",
    mergeBase,
    "origin/main",
    "--",
    "docs/roadmap.md",
  ]);

  if (roadmapText.status === "usage-error") {
    return roadmapText;
  }

  if (oldRoadmapText.status === "usage-error") {
    return oldRoadmapText;
  }

  if (diffResult.status !== 0) {
    return {
      status: "usage-error",
      result: usageErrorResult("git diff roadmap failed", diffResult),
    };
  }

  return {
    status: "ready",
    roadmapText: roadmapText.text,
    oldRoadmapText: oldRoadmapText.text,
    roadmapHunks: parseRoadmapDiffHunks(diffResult.stdout),
  };
};

type RoadmapBlobResult =
  | { readonly status: "ready"; readonly text: string }
  | { readonly status: "usage-error"; readonly result: BranchFreshnessResult };

/** Read a roadmap blob and treat absent historical blobs as empty content. */
const readRoadmapBlob = (git: GitRunner, revision: string): RoadmapBlobResult => {
  const result = runGit(git, ["show", `${revision}:docs/roadmap.md`]);

  if (result.status === 0) {
    return { status: "ready", text: result.stdout };
  }

  if (isMissingBlobResult(result)) {
    return { status: "ready", text: "" };
  }

  return {
    status: "usage-error",
    result: usageErrorResult(`git show ${revision} roadmap failed`, result),
  };
};

/** Detect Git's stable missing-blob wording without parsing localized prose. */
const isMissingBlobResult = (result: GitCommandResult): boolean => {
  return (
    result.status === 128 &&
    (result.stderr.includes("exists on disk, but not in") ||
      result.stderr.includes("does not exist in"))
  );
};

/** Parse the small CLI surface for an optional explicit task id. */
const parseCliArgs = (args: readonly string[]): CliOptions => {
  if (args.length === 0) {
    return {};
  }

  if (args[0] === "--task") {
    return parseSeparateTaskArg(args);
  }

  const taskArg = args.find((arg) => arg.startsWith("--task="));

  if (args.length === 1 && taskArg !== undefined) {
    return { taskOverride: taskArg.slice("--task=".length) };
  }

  return { usageError: "usage: branch-freshness-git.ts [--task <roadmap-task-id>]" };
};

/** Parse `--task value` without growing the whole CLI parser. */
const parseSeparateTaskArg = (args: readonly string[]): CliOptions => {
  if (args.length === 1) {
    return { usageError: "missing --task value" };
  }

  if (args.length === 2) {
    const taskOverride = args[1];

    return taskOverride === undefined ? { usageError: "missing --task value" } : { taskOverride };
  }

  return { usageError: "usage: branch-freshness-git.ts [--task <roadmap-task-id>]" };
};

/** Build exact-optional-safe checker options for the CLI path. */
const makeCheckOptions = (
  repositoryPath: string,
  taskOverride: string | undefined,
): BranchFreshnessCheckOptions => {
  return taskOverride === undefined
    ? { cwd: repositoryPath }
    : { cwd: repositoryPath, taskOverride };
};

/** Convert a failed Git operation into deterministic user-facing text. */
const usageErrorResult = (description: string, result: GitCommandResult): BranchFreshnessResult => {
  const detail = result.error?.message ?? (result.stderr.trim() || result.stdout.trim());

  return {
    status: "usage-error",
    message: detail.length > 0 ? `${description}: ${detail}` : description,
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  exit(runBranchFreshnessCli(process.argv.slice(2)));
}
