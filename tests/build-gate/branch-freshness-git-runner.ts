/**
 * @file Git command runner for the branch-freshness review guard.
 */

import { spawnSync } from "node:child_process";

/** Captured Git command result used by the review guard. */
export type GitCommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
};

/** Minimal Git runner scoped to one repository directory. */
export type GitRunner = {
  readonly run: (args: readonly string[]) => GitCommandResult;
};

const gitCommandTimeoutMs = 30_000;

/**
 * Create a Git runner scoped to one repository directory.
 *
 * @param repositoryPath Repository working-tree path.
 * @returns Git runner with terminal prompts disabled and a bounded timeout.
 */
export function createGitRunner(repositoryPath: string): GitRunner {
  return {
    run: (args) => {
      const result = spawnSync("git", args, {
        cwd: repositoryPath,
        encoding: "utf8",
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        timeout: gitCommandTimeoutMs,
      });

      return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(result.error === undefined ? {} : { error: result.error }),
      };
    },
  };
}

/**
 * Run Git and keep guard call sites terse without hiding the command contract.
 *
 * @param git Git runner for the repository under review.
 * @param args Git arguments excluding the `git` executable.
 * @returns Captured command result.
 */
export function runGit(git: GitRunner, args: readonly string[]): GitCommandResult {
  return git.run(args);
}
