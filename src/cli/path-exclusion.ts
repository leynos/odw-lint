/**
 * @file Glob-based path exclusion for the `check` command.
 */

/**
 * Returns whether a path matches any configured exclusion pattern.
 *
 * @param path Path supplied to or synthesized by the check command.
 * @param excludeGlobs Configured exclusion glob patterns.
 * @returns `true` when `path` should be skipped by `--force-exclude`.
 */
export const isPathExcluded = (path: string, excludeGlobs: readonly string[]): boolean => {
  return excludeGlobs.some((pattern) => new Bun.Glob(pattern).match(path));
};
