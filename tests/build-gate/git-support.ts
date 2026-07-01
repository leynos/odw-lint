/**
 * @file Shared test-only Git support for repository build gates.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Captured Git command result used by build-gate helpers. */
export type GitCommandResult = {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: NodeJS.ErrnoException;
};

/** Minimal Git runner scoped to one repository directory. */
export type GitRunner = {
  readonly run: (args: readonly string[]) => GitCommandResult;
};

const gitCommandTimeoutMs = 30_000;
const gitCommandMaxBufferBytes = 64 * 1024 * 1024;
const trackedFileListingArgs = ["ls-files", "-z", "--full-name"] as const;

export type GitRunnerOptions = {
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
};

export type CapturedCliOutput = {
  readonly stdout: string;
  readonly stderr: string;
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

export type TemporaryRepositoryOptions = {
  readonly prefix?: string;
  readonly initialBranch?: string;
  readonly userName?: string;
  readonly userEmail?: string;
};

/**
 * Create a Git runner scoped to one repository directory.
 *
 * @param repositoryPath - Repository working-tree path.
 * @param options - Optional runner settings for focused tests.
 * @returns Git runner with terminal prompts disabled and a bounded timeout.
 */
export function createGitRunner(repositoryPath: string, options: GitRunnerOptions = {}): GitRunner {
  const timeout = options.timeoutMs ?? gitCommandTimeoutMs;
  const maxBuffer = options.maxBufferBytes ?? gitCommandMaxBufferBytes;

  return {
    run: (args) => {
      const result = spawnSync("git", args, {
        cwd: repositoryPath,
        encoding: "utf8",
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        timeout,
        maxBuffer,
      });

      return {
        status: result.status ?? null,
        signal: result.signal ?? null,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        ...(result.error === undefined ? {} : { error: result.error }),
      };
    },
  };
}

/**
 * Run Git and keep guard call sites terse without hiding the command contract.
 *
 * @param git - Git runner for the repository under review.
 * @param args - Git arguments excluding the `git` executable.
 * @returns Captured command result.
 */
export function runGit(git: GitRunner, args: readonly string[]): GitCommandResult {
  return git.run(args);
}

/**
 * Parse Git's NUL-separated path stream into concrete path strings.
 *
 * @param output - Raw NUL-separated stdout from `git ls-files -z`.
 * @returns Repository-relative paths with empty separator segments removed.
 */
export function parseNulSeparatedPaths(output: string): readonly string[] {
  return output.split("\0").filter((path) => path.length > 0);
}

/**
 * List tracked repository files through the shared Git command boundary.
 *
 * @param options - Optional repository path, pathspecs, and injected Git runner.
 * @returns Repository-relative tracked paths.
 */
export function lsTrackedFiles(
  options: {
    readonly repositoryPath?: string;
    readonly pathspecs?: readonly string[];
    readonly gitRunner?: GitRunner;
  } = {},
): readonly string[] {
  const args = trackedFileListingArgsFor(options.pathspecs ?? []);
  const git = options.gitRunner ?? createGitRunner(options.repositoryPath ?? process.cwd());
  const result = runGit(git, args);

  assertGitCommandSucceeded(result, renderGitCommand(args));

  return parseNulSeparatedPaths(result.stdout);
}

/** Build the shared tracked-file listing command for optional pathspecs. */
function trackedFileListingArgsFor(pathspecs: readonly string[]): readonly string[] {
  if (pathspecs.length === 0) {
    return trackedFileListingArgs;
  }

  return [...trackedFileListingArgs, "--", ...pathspecs];
}

/** Convert failed Git commands into project-owned build-gate errors. */
function assertGitCommandSucceeded(result: GitCommandResult, command: string): void {
  if (result.error !== undefined) {
    throw new Error(`${command} failed: ${result.error.message}${signalSuffix(result)}`);
  }

  if (result.status !== 0) {
    if (result.signal !== null) {
      throw new Error(`${command} failed with signal ${result.signal}: ${result.stderr}`);
    }

    throw new Error(`${command} failed with status ${String(result.status)}: ${result.stderr}`);
  }
}

/** Render a Git command for stable diagnostic messages. */
function renderGitCommand(args: readonly string[]): string {
  return ["git", ...args].join(" ");
}

/** Render signal details only when the child process was terminated. */
function signalSuffix(result: GitCommandResult): string {
  return result.signal === null ? "" : ` with signal ${result.signal}`;
}

/** Render empty command output without trailing source whitespace. */
function renderOutput(output: string): string {
  return output.length === 0 ? "<empty>" : output;
}

/**
 * Create writers that capture CLI output for assertions.
 *
 * @returns Mutable captured stdout and stderr plus writer callbacks.
 */
export function createCapturedCliOutput(): CapturedCliOutput {
  const output = { stdout: "", stderr: "" };

  return {
    get stdout() {
      return output.stdout;
    },
    get stderr() {
      return output.stderr;
    },
    writeOut: (message) => {
      output.stdout += message;
    },
    writeErr: (message) => {
      output.stderr += message;
    },
  };
}

/**
 * Run a Git command and fail fast when fixture setup is broken.
 *
 * @param cwd - Working directory for the Git command.
 * @param args - Git arguments excluding the `git` executable.
 * @throws Error when Git returns a non-zero status.
 */
export function runFixtureGit(cwd: string, args: readonly string[]): void {
  const result = createGitRunner(cwd).run(args);

  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      [
        `${renderGitCommand(args)} failed in ${cwd}`,
        `status: ${String(result.status)}`,
        `signal: ${String(result.signal)}`,
        `stdout: ${renderOutput(result.stdout)}`,
        `stderr: ${renderOutput(result.stderr)}`,
        `error: ${renderOutput(result.error?.message ?? "")}`,
      ].join("\n"),
    );
  }
}

/**
 * Create a temporary Git repository with deterministic commit identity.
 *
 * @param options - Repository prefix, initial branch, and commit identity.
 * @returns Path to the new temporary repository.
 */
export function createTemporaryRepository(options: TemporaryRepositoryOptions = {}): string {
  const repositoryPath = mkdtempSync(join(tmpdir(), options.prefix ?? "odw-lint-git-support-"));
  const initialBranch = options.initialBranch ?? "main";
  const userName = options.userName ?? "Build Gate Test";
  const userEmail = options.userEmail ?? "build-gate@example.test";

  runFixtureGit(repositoryPath, ["init", `--initial-branch=${initialBranch}`]);
  runFixtureGit(repositoryPath, ["config", "user.name", userName]);
  runFixtureGit(repositoryPath, ["config", "user.email", userEmail]);

  return repositoryPath;
}

/**
 * Write a repository-relative file and create parent directories as needed.
 *
 * @param repositoryPath - Repository working-tree path.
 * @param path - Repository-relative file path.
 * @param content - File content to write.
 */
export function writeRepositoryFile(
  repositoryPath: string,
  path: string,
  content: string | Buffer,
): void {
  const target = join(repositoryPath, path);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/**
 * Stage and commit all current fixture changes.
 *
 * @param repositoryPath - Repository working-tree path.
 * @param message - Commit message.
 */
export function commitAll(repositoryPath: string, message = "Seed repository"): void {
  runFixtureGit(repositoryPath, ["add", "."]);
  runFixtureGit(repositoryPath, ["commit", "-m", message]);
}
