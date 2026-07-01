/**
 * @file Test-only helpers for enforcing source and test TypeScript file sizes.
 */

import { type GitRunner, lsTrackedFiles } from "./git-support";

export const SOURCE_AND_TEST_LINE_LIMIT = 400;
export const SOURCE_AND_TEST_ROOTS = ["src", "tests"] as const;

export type FileSizeViolation = {
  readonly path: string;
  readonly lineCount: number;
  readonly limit: number;
};

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
 * @param gitRunner - Optional runner for `git ls-files`, used by unit tests.
 * @returns Tracked repository-relative TypeScript paths under `src/` and `tests/`.
 */
export function trackedSourceAndTestTypeScriptFiles(gitRunner?: GitRunner): readonly string[] {
  const options =
    gitRunner === undefined
      ? { pathspecs: SOURCE_AND_TEST_ROOTS }
      : { pathspecs: SOURCE_AND_TEST_ROOTS, gitRunner };

  return lsTrackedFiles(options).filter(isSourceOrTestTypeScriptPath);
}
