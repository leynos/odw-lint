/**
 * @file Deterministic static-analysis fixture metadata refresh helpers.
 *
 * This module reads workflow fixtures as UTF-8 source text only. It must stay
 * import-safe because hostile metadata fixtures are designed to reveal any
 * accidental evaluation path.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createOriginalSourceFile,
  type SourceSpan,
  snippetForSpan,
  spanFromOffsets,
  type WorkflowSource,
} from "odw-lint";
import { sha256 } from "./corpus-support";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./invalid-workflows";
import { MASKING_FIXTURE_SNAPSHOTS } from "./masking";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./odw-examples";

export type FixtureRefreshMode = "dry-run" | "write";
export type FixtureRefreshFailureCode =
  | "invalid-arguments"
  | "missing-odw-reference-checkout"
  | "missing-upstream-example"
  | "missing-fixture-source"
  | "missing-anchor"
  | "duplicate-anchor"
  | "manifest-write-failed"
  | "unexpected-error";
export interface FixtureRefreshFailure {
  readonly code: FixtureRefreshFailureCode;
  readonly message: string;
  readonly path: string | null;
  readonly rule: string | null;
  readonly anchor: string | null;
  readonly occurrenceCount: number | null;
  readonly remediation: string;
}
export interface FixtureRefreshCounts {
  readonly odwExamples: number;
  readonly masking: number;
  readonly invalidWorkflows: number;
  readonly hostileMetadata: number;
  readonly invalidDiagnostics: number;
  readonly totalFixtures: number;
}
export interface FixtureRefreshReport {
  readonly mode: FixtureRefreshMode;
  readonly repositoryRoot: string;
  readonly odwReferenceCheckout: string;
  readonly counts: FixtureRefreshCounts;
  readonly managedPaths: readonly string[];
  readonly wouldWritePaths: readonly string[];
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
  readonly extraUpstreamExamples: readonly string[];
  readonly failures: readonly FixtureRefreshFailure[];
}
export interface DiagnosticSpanAnchor {
  readonly fixturePath: string;
  readonly rule: string;
  readonly spanText: string;
  readonly fallbackByteOffset: number;
}
export interface RefreshedDiagnosticSpan {
  readonly span: SourceSpan;
  readonly spanText: string;
}
export interface FixtureRefreshOptions {
  readonly repositoryRoot: URL;
  readonly odwReferenceCheckout: URL;
  readonly shouldWrite: boolean;
}

/**
 * Error wrapper for actionable fixture refresh failures.
 */
export class FixtureRefreshError extends Error {
  /**
   * Creates a refresh error from a report-compatible failure object.
   *
   * @param failure - Failure details to expose through the refresh report.
   */
  public constructor(public readonly failure: FixtureRefreshFailure) {
    super(failure.message);
    this.name = "FixtureRefreshError";
  }
}

/**
 * Repository-relative TypeScript manifest paths owned by fixture refresh.
 */
export const MANIFEST_PATHS = [
  "tests/static-analysis/fixtures/odw-examples.ts",
  "tests/static-analysis/fixtures/masking.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/malformed-metadata.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/missing-metadata.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/unsupported-import-export.ts",
] as const;

/**
 * Calculates the SHA-256 digest used by fixture manifests.
 *
 * @param sourceText - Raw fixture source text.
 * @returns Hex-encoded SHA-256 digest.
 */
export const deriveSha256 = (sourceText: string): string => sha256(sourceText);

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
 * Resolves the default sibling ODW checkout for a repository root.
 *
 * @param repositoryRoot - Repository root directory URL.
 * @returns Directory URL for the default ODW reference checkout.
 */
export const defaultOdwReferenceCheckout = (repositoryRoot: URL): URL => {
  const normalizedRepositoryRoot = normalizeDirectoryUrl(repositoryRoot);
  const siblingPath = normalizedRepositoryRoot.pathname.includes(".worktrees/")
    ? "../../open-dynamic-workflows/"
    : "../open-dynamic-workflows/";

  return new URL(siblingPath, normalizedRepositoryRoot);
};

/**
 * Resolves the effective ODW reference checkout from configuration.
 *
 * @param repositoryRoot - Repository root directory URL.
 * @param overridePath - Optional filesystem path from `ODW_REFERENCE_CHECKOUT`.
 * @returns Directory or path URL for the effective ODW reference checkout.
 */
export const resolveOdwReferenceCheckout = (
  repositoryRoot: URL,
  overridePath: string | undefined,
): URL => {
  if (overridePath === undefined || overridePath.length === 0) {
    return defaultOdwReferenceCheckout(repositoryRoot);
  }

  const normalizedRootPath = fileURLToPath(normalizeDirectoryUrl(repositoryRoot));
  return pathToFileURL(resolve(normalizedRootPath, overridePath));
};

/**
 * Derives a diagnostic span from a stable reviewer-facing source anchor.
 *
 * @param source - Raw workflow source and diagnostic file path.
 * @param anchor - Existing manifest anchor and fallback UTF-8 byte offset.
 * @returns Refreshed UTF-8 source span and canonical snippet text.
 * @throws FixtureRefreshError when a non-empty anchor is missing or duplicated.
 */
export const deriveAnchoredDiagnosticSpan = (
  source: WorkflowSource,
  anchor: DiagnosticSpanAnchor,
): RefreshedDiagnosticSpan => {
  const file = createOriginalSourceFile(source);
  const [startOffset, endOffset] =
    anchor.spanText.length === 0
      ? emptyAnchorOffsets(source, anchor)
      : exactAnchorOffsets(source.sourceText, anchor);
  const span = spanFromOffsets(file, startOffset, endOffset);

  return {
    span,
    spanText: snippetForSpan(file, span).text,
  };
};

/**
 * Refreshes fixture metadata and returns the maintainer report shape.
 *
 * @param options - Repository, reference checkout, and write-mode settings.
 * @returns Refresh report describing managed paths, counts, and failures.
 */
export const refreshFixtureMetadata = (options: FixtureRefreshOptions): FixtureRefreshReport => {
  const repositoryRoot = normalizeDirectoryUrl(options.repositoryRoot);
  const odwReferenceCheckout = normalizeDirectoryUrl(options.odwReferenceCheckout);

  if (options.shouldWrite) {
    return reportWithFailure(options, writeModeNotImplementedFailure());
  }

  if (!existsSync(odwReferenceCheckout)) {
    return reportWithFailure(options, missingReferenceCheckoutFailure(odwReferenceCheckout));
  }

  return {
    mode: options.shouldWrite ? "write" : "dry-run",
    repositoryRoot: fileURLToPath(repositoryRoot),
    odwReferenceCheckout: fileURLToPath(odwReferenceCheckout),
    counts: currentCounts(),
    managedPaths: managedPaths(),
    wouldWritePaths: [],
    writtenPaths: [],
    unchangedPaths: managedPaths(),
    extraUpstreamExamples: [],
    failures: [],
  };
};

/**
 * Validates the fallback UTF-8 byte offset used for an empty anchor.
 */
const emptyAnchorOffsets = (
  source: WorkflowSource,
  anchor: DiagnosticSpanAnchor,
): readonly [number, number] => {
  const sourceByteLength = Buffer.byteLength(source.sourceText, "utf8");
  if (!isValidFallbackByteOffset(anchor.fallbackByteOffset, sourceByteLength)) {
    throw new FixtureRefreshError({
      code: "missing-anchor",
      message: `${anchor.fixturePath} fallback byte offset for ${anchor.rule} is outside the source byte range.`,
      path: anchor.fixturePath,
      rule: anchor.rule,
      anchor: anchor.spanText,
      occurrenceCount: null,
      remediation:
        "Update the empty spanText diagnostic to use a valid UTF-8 fallback byte offset.",
    });
  }

  return [anchor.fallbackByteOffset, anchor.fallbackByteOffset];
};

/**
 * Checks whether an empty-anchor fallback byte offset can map into source.
 */
const isValidFallbackByteOffset = (offset: number, sourceByteLength: number): boolean => {
  if (!Number.isInteger(offset)) {
    return false;
  }

  if (offset < 0) {
    return false;
  }

  return offset <= sourceByteLength;
};

/**
 * Locates a unique anchor and converts its text indexes to UTF-8 byte offsets.
 */
const exactAnchorOffsets = (
  sourceText: string,
  anchor: DiagnosticSpanAnchor,
): readonly [number, number] => {
  const startIndexes = allStartIndexes(sourceText, anchor.spanText);
  if (startIndexes.length !== 1) {
    throw new FixtureRefreshError(anchorFailure(anchor, startIndexes.length));
  }

  const startIndex = startIndexes[0];
  if (startIndex === undefined) {
    throw new FixtureRefreshError(anchorFailure(anchor, 0));
  }

  return [
    Buffer.byteLength(sourceText.slice(0, startIndex), "utf8"),
    Buffer.byteLength(sourceText.slice(0, startIndex + anchor.spanText.length), "utf8"),
  ];
};

/**
 * Finds every exact, non-overlapping occurrence of an anchor string.
 */
const allStartIndexes = (sourceText: string, anchorText: string): readonly number[] => {
  const startIndexes: number[] = [];
  let searchStart = 0;
  while (searchStart <= sourceText.length) {
    const startIndex = sourceText.indexOf(anchorText, searchStart);
    if (startIndex === -1) {
      return startIndexes;
    }
    startIndexes.push(startIndex);
    searchStart = startIndex + 1;
  }
  return startIndexes;
};

/**
 * Builds an actionable failure for a missing or duplicated diagnostic anchor.
 */
const anchorFailure = (
  anchor: DiagnosticSpanAnchor,
  occurrenceCount: number,
): FixtureRefreshFailure => {
  const code = occurrenceCount === 0 ? "missing-anchor" : "duplicate-anchor";
  return {
    code,
    message: `${anchor.fixturePath} diagnostic anchor for ${anchor.rule} must appear exactly once; found ${occurrenceCount}.`,
    path: anchor.fixturePath,
    rule: anchor.rule,
    anchor: anchor.spanText,
    occurrenceCount,
    remediation:
      "Update the manifest spanText anchor to a stable source fragment, then rerun the fixture refresh.",
  };
};

/**
 * Builds the failure used when the configured ODW reference checkout is absent.
 */
const missingReferenceCheckoutFailure = (checkout: URL): FixtureRefreshFailure => ({
  code: "missing-odw-reference-checkout",
  message: `ODW_REFERENCE_CHECKOUT does not exist: ${fileURLToPath(checkout)}`,
  path: fileURLToPath(checkout),
  rule: null,
  anchor: null,
  occurrenceCount: null,
  remediation: "Set ODW_REFERENCE_CHECKOUT to a source-backed open-dynamic-workflows checkout.",
});

/**
 * Builds the item 1 failure used before manifest writing is implemented.
 */
const writeModeNotImplementedFailure = (): FixtureRefreshFailure => ({
  code: "invalid-arguments",
  message: "Write-mode fixture refresh is implemented by roadmap work item 2.",
  path: null,
  rule: null,
  anchor: null,
  occurrenceCount: null,
  remediation:
    "Run dry-run mode for this helper slice, or continue with work item 2 before using write mode.",
});

/**
 * Builds a report containing one actionable refresh failure.
 */
const reportWithFailure = (
  options: FixtureRefreshOptions,
  failure: FixtureRefreshFailure,
): FixtureRefreshReport => ({
  mode: options.shouldWrite ? "write" : "dry-run",
  repositoryRoot: fileURLToPath(normalizeDirectoryUrl(options.repositoryRoot)),
  odwReferenceCheckout: fileURLToPath(normalizeDirectoryUrl(options.odwReferenceCheckout)),
  counts: currentCounts(),
  managedPaths: managedPaths(),
  wouldWritePaths: [],
  writtenPaths: [],
  unchangedPaths: [],
  extraUpstreamExamples: [],
  failures: [failure],
});

/**
 * Counts the current committed fixture corpus.
 */
const currentCounts = (): FixtureRefreshCounts => {
  const invalidWorkflows = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.length;
  return {
    odwExamples: ODW_EXAMPLE_FIXTURE_SNAPSHOTS.length,
    masking: MASKING_FIXTURE_SNAPSHOTS.length,
    invalidWorkflows,
    hostileMetadata: INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.family === "hostile-metadata",
    ).length,
    invalidDiagnostics: INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.reduce(
      (count, fixture) => count + fixture.expectedDiagnostics.length,
      0,
    ),
    totalFixtures:
      ODW_EXAMPLE_FIXTURE_SNAPSHOTS.length + MASKING_FIXTURE_SNAPSHOTS.length + invalidWorkflows,
  };
};

/**
 * Lists repository paths owned by the refresh command in stable order.
 */
const managedPaths = (): readonly string[] => {
  return [
    ...ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((fixture) => fixture.fixturePath),
    ...MANIFEST_PATHS,
  ].sort();
};
