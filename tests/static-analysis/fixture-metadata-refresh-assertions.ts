/**
 * @file Assertion helpers for fixture metadata refresh tests.
 */

import type { FixtureRefreshReport } from "./fixtures/refresh-metadata";
import { deriveAnchoredDiagnosticSpan, FixtureRefreshError } from "./fixtures/refresh-metadata";

/**
 * Captures an expected refresh failure from span derivation.
 *
 * @param sourceText - Source text to search for the diagnostic anchor.
 * @param spanText - Diagnostic anchor text expected to fail.
 * @param fallbackByteOffset - Fallback offset for empty-anchor diagnostics.
 * @returns The captured refresh failure.
 * @throws Error when span derivation unexpectedly succeeds.
 */
export const captureRefreshFailure = (
  sourceText: string,
  spanText: string,
  fallbackByteOffset = 0,
): FixtureRefreshReport["failures"][number] => {
  try {
    deriveAnchoredDiagnosticSpan(
      { filePath: "fixtures/example.js", sourceText },
      {
        fixturePath: "fixtures/example.js",
        rule: "odw/meta-name",
        spanText,
        fallbackByteOffset,
      },
    );
  } catch (error) {
    if (error instanceof FixtureRefreshError) {
      return error.failure;
    }
    throw error;
  }
  throw new Error("Expected fixture refresh failure.");
};

/**
 * Removes machine-specific paths from a refresh report before snapshotting.
 *
 * @param report - Refresh report containing local absolute paths.
 * @returns Report with stable placeholder paths.
 */
export const normalizeReportForAssertion = (report: FixtureRefreshReport): FixtureRefreshReport => {
  const normalizePathText = (value: string): string =>
    value
      .replaceAll(report.repositoryRoot, "<repositoryRoot>")
      .replaceAll(report.odwReferenceCheckout, "<odwReferenceCheckout>");
  const normalizePaths = (paths: readonly string[]): readonly string[] =>
    paths.map((path) => normalizePathText(path));

  return {
    ...report,
    repositoryRoot: "<repositoryRoot>",
    odwReferenceCheckout: "<odwReferenceCheckout>",
    managedPaths: normalizePaths(report.managedPaths),
    wouldWritePaths: normalizePaths(report.wouldWritePaths),
    writtenPaths: normalizePaths(report.writtenPaths),
    unchangedPaths: normalizePaths(report.unchangedPaths),
    extraUpstreamExamples: normalizePaths(report.extraUpstreamExamples),
    failures: report.failures.map((failure) => ({
      ...failure,
      message: normalizePathText(failure.message),
      path: failure.path === null ? null : normalizePathText(failure.path),
    })),
  };
};
