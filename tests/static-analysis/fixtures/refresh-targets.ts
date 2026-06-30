/**
 * @file Managed target validation for fixture metadata refresh.
 */

import { type Stats, statSync } from "node:fs";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { FixtureRefreshFailure } from "./refresh-metadata";

const ODW_REFERENCE_CHECKOUT_REMEDIATION =
  "Set ODW_REFERENCE_CHECKOUT to a source-backed open-dynamic-workflows checkout.";
const MISSING_UPSTREAM_EXAMPLE_REMEDIATION =
  "Restore the upstream example or update the allow-list in a separate roadmap task.";

/**
 * Validates one managed path before comparing or writing it.
 *
 * @param repositoryRoot - Normalized repository-root directory URL.
 * @param relativePath - Repository-relative managed fixture path.
 * @returns Structured failure when the target is unsafe, otherwise `null`.
 */
export const managedTargetFailure = (
  repositoryRoot: URL,
  relativePath: string,
): FixtureRefreshFailure | null => {
  const repositoryRootPath = filePathForUrl(repositoryRoot);
  const targetPath = filePathForUrl(new URL(relativePath, repositoryRoot));
  if (repositoryRootPath === null || targetPath === null) {
    return invalidArgumentsFailure(`Managed fixture path is not a valid file URL: ${relativePath}`);
  }

  const relativeTargetPath = relative(repositoryRootPath, targetPath);
  if (isPathOutsideRoot(relativeTargetPath)) {
    return invalidArgumentsFailure(
      `Managed fixture path escapes the repository root: ${relativePath}`,
    );
  }

  const targetStats = safeStats(targetPath);
  if (targetStats !== null && !targetStats.isFile()) {
    return invalidArgumentsFailure(`Managed fixture path is not a regular file: ${relativePath}`);
  }

  return null;
};

/**
 * Builds an invalid-arguments refresh failure.
 *
 * @param message - Maintainer-facing failure summary.
 * @returns Report-compatible invalid-arguments failure.
 */
export const invalidArgumentsFailure = (message: string): FixtureRefreshFailure => ({
  code: "invalid-arguments",
  message,
  path: null,
  rule: null,
  anchor: null,
  occurrenceCount: null,
  remediation: "Use file: directory URLs for fixture refresh paths.",
});

/**
 * Builds a refresh failure for missing or invalid ODW reference checkouts.
 *
 * @param message - Maintainer-facing checkout failure summary.
 * @param path - Resolved checkout filesystem path.
 * @returns Report-compatible checkout failure.
 */
export const missingOdwReferenceCheckoutFailure = (
  message: string,
  path: string,
): FixtureRefreshFailure => ({
  code: "missing-odw-reference-checkout",
  message,
  path,
  rule: null,
  anchor: null,
  occurrenceCount: null,
  remediation: ODW_REFERENCE_CHECKOUT_REMEDIATION,
});

/**
 * Builds a refresh failure for allow-listed ODW examples missing upstream.
 *
 * @param fileName - Missing upstream example basename.
 * @param upstreamSource - Resolved upstream example URL.
 * @returns Report-compatible missing-example failure.
 */
export const missingUpstreamExampleFailure = (
  fileName: string,
  upstreamSource: URL,
): FixtureRefreshFailure => ({
  code: "missing-upstream-example",
  message: `Missing allow-listed upstream ODW example ${fileName} under ODW_REFERENCE_CHECKOUT.`,
  path: fileURLToPath(upstreamSource),
  rule: null,
  anchor: null,
  occurrenceCount: null,
  remediation: MISSING_UPSTREAM_EXAMPLE_REMEDIATION,
});

/**
 * Normalizes a filesystem directory URL without file-style parent resolution.
 *
 * @param url - Directory URL to normalize.
 * @returns URL copy with no query, no fragment, and a trailing slash.
 */
export const normalizeDirectoryUrl = (url: URL): URL => {
  const normalized = new URL(url.href);
  normalized.search = "";
  normalized.hash = "";
  if (!normalized.pathname.endsWith("/")) {
    normalized.pathname = `${normalized.pathname}/`;
  }
  return normalized;
};

/**
 * Converts a file URL to a filesystem path only when Node can do so safely.
 *
 * @param url - File URL to convert.
 * @returns Filesystem path, or `null` when conversion fails.
 */
export const filePathForUrl = (url: URL): string | null => {
  try {
    return fileURLToPath(url);
  } catch {
    return null;
  }
};

/**
 * Reads filesystem metadata without leaking raw I/O exceptions.
 *
 * @param path - Filesystem path to inspect.
 * @returns File stats, or `null` when the path cannot be inspected.
 */
export const safeStats = (path: string): Stats | null => {
  try {
    return statSync(path);
  } catch {
    return null;
  }
};

/**
 * Checks whether a path resolved outside its expected root directory.
 */
const isPathOutsideRoot = (relativePath: string): boolean =>
  relativePath === "" || relativePath === ".." || relativePath.startsWith(`..${sep}`);
