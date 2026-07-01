/**
 * @file Git-backed tracked-file trailing whitespace hygiene guard.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import {
  findTrailingWhitespaceViolations,
  formatWhitespaceViolations,
  parseNulSeparatedPaths,
} from "./whitespace-hygiene-support";

export type WhitespaceHygieneExitCode = 0 | 1 | 2;

type CliWriters = {
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

type GitFileListingResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
};

const gitFileListingArgs = ["ls-files", "-z", "--full-name"] as const;
const gitFileListingCommand = `git ${gitFileListingArgs.join(" ")}`;

/**
 * Run the command-line guard and return its process exit code.
 *
 * @param repositoryPath Repository directory to scan.
 * @param writers Output writers for tests and the real CLI.
 * @returns Process exit code.
 */
export function runWhitespaceHygieneCli(
  repositoryPath = cwd(),
  writers: CliWriters = {
    writeOut: (message) => stdout.write(message),
    writeErr: (message) => stderr.write(message),
  },
): WhitespaceHygieneExitCode {
  try {
    const paths = trackedRepositoryFiles(repositoryPath);
    const violations = findTrailingWhitespaceViolations(paths, (path) =>
      readTrackedFile(repositoryPath, path),
    );

    if (violations.length === 0) {
      writers.writeOut("Whitespace hygiene check passed.\n");
      return 0;
    }

    writers.writeErr(
      `Trailing whitespace found in tracked files:\n${formatWhitespaceViolations(violations)}\n`,
    );
    return 1;
  } catch (error) {
    writers.writeErr(`whitespace hygiene check failed: ${errorMessage(error)}\n`);
    return 2;
  }
}

/**
 * List every tracked repository path using Git's NUL-separated output.
 */
function trackedRepositoryFiles(repositoryPath: string): readonly string[] {
  const result = runGitFileListing(repositoryPath);

  assertGitFileListingSucceeded(result);

  return parseNulSeparatedPaths(result.stdout);
}

/**
 * Run the tracked-file query against the local Git index.
 */
function runGitFileListing(repositoryPath: string): GitFileListingResult {
  const result = spawnSync("git", gitFileListingArgs, {
    cwd: repositoryPath,
    encoding: "utf8",
  });

  if (result.error instanceof Error) {
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
    };
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Raise a clear project-owned error when Git cannot list tracked paths.
 */
function assertGitFileListingSucceeded(result: GitFileListingResult): void {
  if (result.error !== undefined) {
    throw new Error(`${gitFileListingCommand} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `${gitFileListingCommand} failed with status ${String(result.status)}: ${result.stderr}`,
    );
  }
}

/**
 * Read one tracked file as bytes and convert filesystem failures to stable errors.
 */
function readTrackedFile(repositoryPath: string, path: string): Buffer {
  try {
    return readFileSync(join(repositoryPath, path));
  } catch {
    throw new Error(`could not read tracked file ${path}`);
  }
}

/**
 * Convert unknown thrown values to deterministic CLI text.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  exit(runWhitespaceHygieneCli());
}
