/**
 * @file Test-only helpers for enforcing source and test TypeScript file sizes.
 */

import { spawnSync } from "node:child_process";

export const SOURCE_AND_TEST_LINE_LIMIT = 400;
export const SOURCE_AND_TEST_ROOTS = ["src", "tests"] as const;

export type FileSizeViolation = {
  readonly path: string;
  readonly lineCount: number;
  readonly limit: number;
};

export type GitFileListingResult = {
  readonly status: number | null;
  readonly stdout: string | null;
  readonly stderr: string | null;
  readonly error?: Error;
};

export type GitFileListingRunner = () => GitFileListingResult;

const gitFileListingCommand = "git ls-files -z -- src tests";
const typeScriptExtensions = [".ts", ".tsx", ".mts", ".cts"] as const;

/**
 * Count physical LF-delimited lines with `wc -l`-style trailing newline
 * semantics for ordinary source files.
 *
 * @param sourceText - UTF-8 source text to count.
 * @returns The number of physical source lines.
 */
export function countPhysicalLines(sourceText: string): number {
  if (sourceText.length === 0) {
    return 0;
  }

  const newlineCount = [...sourceText].filter((character) => character === "\n").length;

  return sourceText.endsWith("\n") ? newlineCount : newlineCount + 1;
}

/**
 * Return whether a Git path is a TypeScript source or test file in scope.
 *
 * @param path - Repository-relative path from Git.
 * @returns `true` when the path is an in-scope TypeScript source or test file.
 */
export function isSourceOrTestTypeScriptPath(path: string): boolean {
  return (
    SOURCE_AND_TEST_ROOTS.some((root) => path.startsWith(`${root}/`)) &&
    typeScriptExtensions.some((extension) => path.endsWith(extension))
  );
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
 * Find in-scope TypeScript files whose physical line count exceeds `limit`.
 *
 * @param paths - Candidate repository-relative paths.
 * @param readSource - Reader for a candidate path's UTF-8 source text.
 * @param limit - Maximum allowed physical source lines.
 * @returns Oversized file reports for in-scope TypeScript paths.
 */
export function findOversizedSourceAndTestFiles(
  paths: readonly string[],
  readSource: (path: string) => string,
  limit = SOURCE_AND_TEST_LINE_LIMIT,
): readonly FileSizeViolation[] {
  return paths
    .filter(isSourceOrTestTypeScriptPath)
    .map((path) => ({
      path,
      lineCount: countPhysicalLines(readSource(path)),
      limit,
    }))
    .filter((violation) => violation.lineCount > violation.limit);
}

/**
 * Format oversized-file reports for deterministic build-gate failures.
 *
 * @param violations - Oversized file reports to render.
 * @returns A newline-separated diagnostic message.
 */
export function formatFileSizeViolations(violations: readonly FileSizeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.path}: ${violation.lineCount} physical lines exceeds ${violation.limit}`,
    )
    .join("\n");
}

/**
 * List tracked TypeScript source and test files from Git.
 *
 * @param runGit - Optional runner for `git ls-files`, used by unit tests.
 * @returns Tracked repository-relative TypeScript paths under `src/` and `tests/`.
 */
export function trackedSourceAndTestTypeScriptFiles(
  runGit: GitFileListingRunner = runGitFileListing,
): readonly string[] {
  const result = runGit();

  assertGitFileListingSucceeded(result);

  return parseNulSeparatedPaths(result.stdout ?? "").filter(isSourceOrTestTypeScriptPath);
}

/** Run the tracked-file query against the local Git index. */
function runGitFileListing(): GitFileListingResult {
  const result = spawnSync("git", ["ls-files", "-z", "--", "src", "tests"], {
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

/** Raise a clear project-owned error when Git cannot list tracked paths. */
function assertGitFileListingSucceeded(result: GitFileListingResult): void {
  if (result.error !== undefined) {
    throw new Error(`${gitFileListingCommand} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `${gitFileListingCommand} failed with status ${String(result.status)}: ${result.stderr ?? ""}`,
    );
  }
}
