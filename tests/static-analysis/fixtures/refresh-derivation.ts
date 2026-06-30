/**
 * @file Shared derivation helpers for fixture metadata refresh.
 */

import {
  createOriginalSourceFile,
  snippetForSpan,
  spanFromOffsets,
  type WorkflowSource,
} from "odw-lint";
import { sha256 } from "./corpus-support";
import type {
  DiagnosticSpanAnchor,
  FixtureRefreshFailure,
  RefreshedDiagnosticSpan,
} from "./refresh-metadata";

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
 * Calculates the SHA-256 digest used by fixture manifests.
 *
 * @param sourceText - Raw fixture source text.
 * @returns Hex-encoded SHA-256 digest.
 */
export const deriveSha256 = (sourceText: string): string => sha256(sourceText);

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
 * Validates the fallback UTF-8 byte offset used for an empty anchor.
 */
const emptyAnchorOffsets = (
  source: WorkflowSource,
  anchor: DiagnosticSpanAnchor,
): readonly [number, number] => {
  const sourceByteLength = Buffer.byteLength(source.sourceText, "utf8");
  if (
    !isValidFallbackByteOffset(anchor.fallbackByteOffset, sourceByteLength) ||
    !isUtf8CharacterBoundary(source.sourceText, anchor.fallbackByteOffset)
  ) {
    throw new FixtureRefreshError({
      code: "missing-anchor",
      message: `${anchor.fixturePath} fallback byte offset for ${anchor.rule} is outside the source byte range or splits a UTF-8 character.`,
      path: anchor.fixturePath,
      rule: anchor.rule,
      anchor: anchor.spanText,
      occurrenceCount: null,
      remediation: "Update the empty spanText diagnostic to use a valid UTF-8 character boundary.",
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
 * Checks whether a UTF-8 byte offset can be decoded without splitting a code point.
 */
const isUtf8CharacterBoundary = (sourceText: string, offset: number): boolean => {
  const sourceBytes = Buffer.from(sourceText, "utf8");
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes.subarray(0, offset));
    return true;
  } catch {
    return false;
  }
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
 * Finds every exact, overlapping occurrence of an anchor string.
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
