/**
 * @file Temporary Git repositories for branch-freshness build-gate tests.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createCapturedCliOutput, runFixtureGit as git, writeRepositoryFile } from "./git-support";

export { createCapturedCliOutput, writeRepositoryFile };

/** Temporary repository set used by one branch-freshness test. */
export type GitFixture = {
  readonly root: string;
  readonly origin: string;
  readonly main: string;
  readonly task: string;
  readonly dispose: () => void;
};

const initialRoadmap = [
  "# Roadmap",
  "",
  "- [ ] 1.5.1. Prepare adjacent task.",
  "  - Keep this task separate.",
  "- [ ] 1.5.2. Add a branch-freshness review guard for roadmap tasks.",
  "  - Implement the declared guard.",
  "- [ ] 1.5.3. Follow-up task.",
  "  - Keep follow-up work fresh.",
  "",
].join("\n");

/**
 * Create a bare origin with separate main and roadmap-task working clones.
 *
 * @returns Temporary Git fixture with a disposable bare origin and clones.
 */
export function createGitFixture(): GitFixture {
  const root = mkdtempSync(join(tmpdir(), "odw-lint-branch-freshness-"));
  const origin = join(root, "origin.git");
  const main = join(root, "main");
  const task = join(root, "task");

  git(root, ["init", "--bare", origin]);
  git(root, ["clone", origin, main]);
  configureRepository(main);
  writeRepositoryFile(main, "docs/roadmap.md", initialRoadmap);
  writeRepositoryFile(main, "docs/technical-design.md", "# Technical Design\n\nInitial design.\n");
  writeRepositoryFile(
    main,
    "tests/example.test.ts",
    "import { expect, it } from 'bun:test';\n\nit('passes', () => expect(true).toBe(true));\n",
  );
  git(main, ["add", "."]);
  git(main, ["commit", "-m", "Seed repository"]);
  git(main, ["branch", "-M", "main"]);
  git(main, ["push", "-u", "origin", "main"]);

  git(root, ["clone", origin, task]);
  configureRepository(task);
  git(task, ["checkout", "-b", "roadmap-1-5-2"]);
  writeRepositoryFile(task, "docs/execplans/roadmap-1-5-2.md", "# ExecPlan\n\nBranch work.\n");
  git(task, ["add", "."]);
  git(task, ["commit", "-m", "Start roadmap task"]);

  return {
    root,
    origin,
    main,
    task,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}

/**
 * Commit and push one change to origin/main.
 *
 * @param fixture Temporary Git fixture.
 * @param path Repository-relative path to write.
 * @param content File content to commit.
 * @param message Commit message for the pushed main change.
 */
export function commitMainChange(
  fixture: GitFixture,
  path: string,
  content: string,
  message = "Update main",
): void {
  writeRepositoryFile(fixture.main, path, content);
  git(fixture.main, ["add", "."]);
  git(fixture.main, ["commit", "-m", message]);
  git(fixture.main, ["push", "origin", "main"]);
}

/**
 * Rewrite and push the roadmap from the main clone.
 *
 * @param fixture Temporary Git fixture.
 * @param updater Function that transforms the current roadmap text.
 * @param message Commit message for the pushed roadmap change.
 */
export function commitRoadmapChange(
  fixture: GitFixture,
  updater: (roadmap: string) => string,
  message = "Update roadmap",
): void {
  const roadmapPath = join(fixture.main, "docs/roadmap.md");

  writeFileSync(roadmapPath, updater(readFileSync(roadmapPath, "utf8")));
  git(fixture.main, ["add", "docs/roadmap.md"]);
  git(fixture.main, ["commit", "-m", message]);
  git(fixture.main, ["push", "origin", "main"]);
}

/**
 * Delete and push the roadmap from origin/main.
 *
 * @param fixture Temporary Git fixture.
 * @param message Commit message for the pushed deletion.
 */
export function deleteMainRoadmap(fixture: GitFixture, message = "Delete roadmap"): void {
  unlinkSync(join(fixture.main, "docs/roadmap.md"));
  git(fixture.main, ["add", "docs/roadmap.md"]);
  git(fixture.main, ["commit", "-m", message]);
  git(fixture.main, ["push", "origin", "main"]);
}

/**
 * Rename a file on origin/main so name-status parsing sees an `R*` record.
 *
 * @param fixture Temporary Git fixture.
 * @param oldPath Existing repository-relative path.
 * @param newPath Destination repository-relative path.
 * @param message Commit message for the pushed rename.
 */
export function renameMainPath(
  fixture: GitFixture,
  oldPath: string,
  newPath: string,
  message = "Rename protected path",
): void {
  mkdirSync(dirname(join(fixture.main, newPath)), { recursive: true });
  git(fixture.main, ["mv", oldPath, newPath]);
  git(fixture.main, ["commit", "-m", message]);
  git(fixture.main, ["push", "origin", "main"]);
}

/**
 * Merge current origin/main into the task branch.
 *
 * @param fixture Temporary Git fixture.
 */
export function mergeMainIntoTask(fixture: GitFixture): void {
  git(fixture.task, ["fetch", "origin", "main"]);
  git(fixture.task, ["merge", "--no-edit", "origin/main"]);
}

/**
 * Check out a named branch in the task clone.
 *
 * @param fixture Temporary Git fixture.
 * @param branchName Branch name to check out or create.
 */
export function checkoutTaskBranch(fixture: GitFixture, branchName: string): void {
  git(fixture.task, ["checkout", "-B", branchName]);
}

/** Configure deterministic commits in a temporary repository. */
const configureRepository = (repositoryPath: string): void => {
  git(repositoryPath, ["config", "user.name", "Branch Freshness Test"]);
  git(repositoryPath, ["config", "user.email", "branch-freshness@example.test"]);
};
