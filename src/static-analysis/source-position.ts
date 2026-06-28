/**
 * @file Source-position lookup and span validation helpers.
 *
 * This module owns byte-offset validation and half-open span construction for
 * original workflow source text. It relies on private indexes recorded by the
 * source-file factory rather than trusting structurally forged records.
 */

import type { SourcePosition, SourceSpan } from "../diagnostics/types";
import { sourceIndexes } from "./source-indexes";
import { type OriginalSourceFile, SourceOffsetError } from "./types";

/**
 * Converts one valid UTF-8 byte offset to a display position.
 *
 * @example
 * ```ts
 * positionAtOffset(createOriginalSourceFile({ filePath: "workflow.js", sourceText: "éx" }), 2);
 * // { offset: 2, line: 1, column: 2 }
 * ```
 *
 * @param file - Original source-file record created by
 *   `createOriginalSourceFile`.
 * @param offset - Zero-based UTF-8 byte offset into the original source.
 * @returns The one-based source position for the supplied byte offset.
 * @throws SourceOffsetError when the offset is outside the file or not a
 *   displayable code point boundary.
 */
export const positionAtOffset = (file: OriginalSourceFile, offset: number): SourcePosition => {
  validateOffsetBounds(file, offset);

  const position = sourceIndexes(file).positions.get(offset);
  if (position === undefined) {
    throw new SourceOffsetError(`Offset ${offset} is not a valid source position.`);
  }

  return position;
};

/**
 * Builds a half-open original-source span from valid byte offsets.
 *
 * @example
 * ```ts
 * const file = createOriginalSourceFile({
 *   filePath: "workflows/example.js",
 *   sourceText: "meta\nbody",
 * });
 * const span = spanFromOffsets(file, 0, 4);
 * ```
 *
 * @param file - Original source-file record created by
 *   `createOriginalSourceFile`.
 * @param startOffset - Inclusive zero-based UTF-8 byte offset.
 * @param endOffset - Exclusive zero-based UTF-8 byte offset.
 * @returns A source span whose positions match the original source text.
 * @throws SourceOffsetError when either offset is invalid or the span is
 *   reversed.
 */
export const spanFromOffsets = (
  file: OriginalSourceFile,
  startOffset: number,
  endOffset: number,
): SourceSpan => {
  if (endOffset < startOffset) {
    throw new SourceOffsetError(`Span end offset ${endOffset} is before start ${startOffset}.`);
  }

  return sourceSpan({
    start: positionAtOffset(file, startOffset),
    end: positionAtOffset(file, endOffset),
  });
};

/**
 * Revalidates a caller-supplied span against the original source-file record.
 *
 * @param file - Original source-file record created by the factory.
 * @param span - Caller-supplied half-open source span.
 * @returns A frozen span with positions derived from the source file.
 * @throws SourceOffsetError when the span does not match the source file.
 */
export const validateSourceSpan = (file: OriginalSourceFile, span: SourceSpan): SourceSpan => {
  if (!isSourceSpanLike(span)) {
    throw new SourceOffsetError("Source span must include start and end positions.");
  }

  if (span.end.offset < span.start.offset) {
    throw new SourceOffsetError(
      `Span end offset ${span.end.offset} is before start ${span.start.offset}.`,
    );
  }

  const expectedSpan = spanFromOffsets(file, span.start.offset, span.end.offset);
  if (!isSamePosition(span.start, expectedSpan.start)) {
    throw new SourceOffsetError("Span start position does not match the source file.");
  }
  if (!isSamePosition(span.end, expectedSpan.end)) {
    throw new SourceOffsetError("Span end position does not match the source file.");
  }

  return expectedSpan;
};

/** Checks whether an unknown value is a non-null object record. */
const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

/** Checks whether a value has public source-position coordinates. */
const isSourcePositionLike = (value: unknown): value is SourcePosition => {
  if (!isObjectRecord(value)) {
    return false;
  }
  const position = value as {
    readonly column?: unknown;
    readonly line?: unknown;
    readonly offset?: unknown;
  };

  return (
    typeof position.offset === "number" &&
    typeof position.line === "number" &&
    typeof position.column === "number"
  );
};

/** Checks whether a value has the public source-span shape. */
const isSourceSpanLike = (value: unknown): value is SourceSpan => {
  if (!isObjectRecord(value)) {
    return false;
  }
  const span = value as {
    readonly end?: unknown;
    readonly start?: unknown;
  };

  return isSourcePositionLike(span.start) && isSourcePositionLike(span.end);
};

/** Rejects offsets that cannot refer to the original source text. */
const validateOffsetBounds = (file: OriginalSourceFile, offset: number): void => {
  if (!Number.isInteger(offset)) {
    throw new SourceOffsetError(`Offset ${offset} must be an integer.`);
  }

  if (offset < 0) {
    throw new SourceOffsetError(`Offset ${offset} must be non-negative.`);
  }

  if (offset > file.byteLength) {
    throw new SourceOffsetError(`Offset ${offset} is past the end of ${file.filePath}.`);
  }
};

/** Checks whether two positions have the same public diagnostic coordinates. */
const isSamePosition = (left: SourcePosition, right: SourcePosition): boolean => {
  return left.offset === right.offset && left.line === right.line && left.column === right.column;
};

/** Copies a source span into a readonly record. */
const sourceSpan = (span: SourceSpan): SourceSpan => {
  return Object.freeze({
    start: span.start,
    end: span.end,
  });
};
