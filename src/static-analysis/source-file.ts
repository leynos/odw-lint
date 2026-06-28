/**
 * @file Original workflow source-file records for static analysis.
 *
 * The helpers in this module describe the source text exactly as it was read,
 * before parser normalization or future diagnostic mapping. Byte offsets are
 * UTF-8 offsets into that original text.
 */

import type { SourcePosition, SourceSpan } from "../diagnostics/types";
import {
  ORIGINAL_SOURCE_FILE_BRAND,
  type OriginalSourceFile,
  type SourceLine,
  SourceOffsetError,
  type SourceSnippet,
  type WorkflowSource,
} from "./types";

const TEXT_ENCODER = new TextEncoder();
const SOURCE_INDEXES = new WeakMap<OriginalSourceFile, SourceIndexes>();

/**
 * Private lookup tables derived from the original source text.
 */
type SourceIndexes = {
  /** Positions keyed by valid UTF-8 byte offset. */
  readonly positions: ReadonlyMap<number, SourcePosition>;
  /** UTF-16 string indexes keyed by valid UTF-8 byte offset. */
  readonly textIndexes: ReadonlyMap<number, number>;
};

/**
 * Complete production scan result for one original source text.
 */
type SourceScan = SourceIndexes & {
  /** UTF-8 byte length of the whole original source. */
  readonly byteLength: number;
  /** Display-line metadata derived during the same scan as lookup indexes. */
  readonly lines: readonly SourceLine[];
};

/**
 * Creates an immutable source-file record from original workflow source text.
 *
 * @param source - Original workflow source text and its diagnostic file path.
 * @returns Source-file metadata with UTF-8 byte length and display lines.
 */
export const createOriginalSourceFile = (source: WorkflowSource): OriginalSourceFile => {
  const scan = scanOriginalSource(source.sourceText);
  const sourceFile = {
    filePath: source.filePath,
    sourceText: source.sourceText,
    byteLength: scan.byteLength,
    lines: scan.lines,
  } as OriginalSourceFile;
  Object.defineProperty(sourceFile, ORIGINAL_SOURCE_FILE_BRAND, {
    value: true,
  });
  Object.freeze(sourceFile);

  SOURCE_INDEXES.set(sourceFile, scan);

  return sourceFile;
};

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
 * Returns the exact original source text covered by a validated span.
 *
 * Caller-supplied spans are revalidated against the source record before
 * slicing so stale line, column, or offset data cannot produce misleading
 * snippets.
 *
 * @example
 * ```ts
 * const file = createOriginalSourceFile({
 *   filePath: "workflows/example.js",
 *   sourceText: "meta\nbody",
 * });
 * sliceSourceSpan(file, spanFromOffsets(file, 5, 9)); // "body"
 * ```
 *
 * @param file - Original source-file record created by
 *   `createOriginalSourceFile`.
 * @param span - Half-open source span to validate and slice.
 * @returns The exact original text covered by the span.
 * @throws SourceOffsetError when the span is reversed, out of bounds, or does
 *   not match the supplied source file.
 */
export const sliceSourceSpan = (file: OriginalSourceFile, span: SourceSpan): string => {
  return sliceValidatedSourceSpan(file, validateSourceSpan(file, span));
};

/**
 * Returns a reviewer-useful snippet for a validated original-source span.
 *
 * @example
 * ```ts
 * const file = createOriginalSourceFile({
 *   filePath: "workflows/example.js",
 *   sourceText: "meta\nbody",
 * });
 * snippetForSpan(file, spanFromOffsets(file, 0, 4)).lineText; // "meta"
 * ```
 *
 * @param file - Original source-file record created by
 *   `createOriginalSourceFile`.
 * @param span - Half-open source span to validate and describe.
 * @returns Exact original text plus the validated positions and first line.
 * @throws SourceOffsetError when the span is invalid for the supplied file.
 */
export const snippetForSpan = (file: OriginalSourceFile, span: SourceSpan): SourceSnippet => {
  const validatedSpan = validateSourceSpan(file, span);

  return Object.freeze({
    text: sliceValidatedSourceSpan(file, validatedSpan),
    start: validatedSpan.start,
    end: validatedSpan.end,
    lineText: lineTextAtPosition(file, validatedSpan.start),
  });
};

/**
 * Computes the UTF-8 byte length of source text in Bun and browser runtimes.
 */
const utf8ByteLength = (text: string): number => {
  return TEXT_ENCODER.encode(text).length;
};

/**
 * Builds display lines and private offset indexes in one production scan.
 */
const scanOriginalSource = (sourceText: string): SourceScan => {
  const lines: SourceLine[] = [];
  const positions = new Map<number, SourcePosition>();
  const textIndexes = new Map<number, number>();
  let line = 1;
  let column = 1;
  let lineStartOffset = 0;
  let lineStartIndex = 0;
  let byteOffset = 0;
  let index = 0;

  positions.set(byteOffset, sourcePosition({ offset: byteOffset, line, column }));
  textIndexes.set(byteOffset, index);

  while (index < sourceText.length) {
    const codePoint = sourceText.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }

    const character = String.fromCodePoint(codePoint);
    if (isLineTerminator(character)) {
      const terminatorByteLength = isCrLfTerminator(sourceText, index) ? 2 : 1;
      const terminatorIndexLength = terminatorByteLength;
      const nextByteOffset = byteOffset + terminatorByteLength;
      const nextIndex = index + terminatorIndexLength;

      lines.push(
        sourceLine({
          line,
          startOffset: lineStartOffset,
          contentEndOffset: byteOffset,
          terminatorEndOffset: nextByteOffset,
          text: sourceText.slice(lineStartIndex, index),
        }),
      );
      line += 1;
      column = 1;
      byteOffset = nextByteOffset;
      index = nextIndex;
      lineStartOffset = byteOffset;
      lineStartIndex = index;
      positions.set(byteOffset, sourcePosition({ offset: byteOffset, line, column }));
      textIndexes.set(byteOffset, index);
      continue;
    }

    byteOffset += utf8ByteLength(character);
    index += character.length;
    column += 1;
    positions.set(byteOffset, sourcePosition({ offset: byteOffset, line, column }));
    textIndexes.set(byteOffset, index);
  }

  lines.push(
    sourceLine({
      line,
      startOffset: lineStartOffset,
      contentEndOffset: byteOffset,
      terminatorEndOffset: byteOffset,
      text: sourceText.slice(lineStartIndex),
    }),
  );

  return Object.freeze({
    byteLength: byteOffset,
    lines: Object.freeze(lines),
    positions,
    textIndexes,
  });
};

/**
 * Rejects offsets that cannot refer to the original source text.
 */
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

/**
 * Revalidates a caller-supplied span against the original source-file record.
 */
const validateSourceSpan = (file: OriginalSourceFile, span: SourceSpan): SourceSpan => {
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

/**
 * Slices original source text after span validation has succeeded.
 */
const sliceValidatedSourceSpan = (file: OriginalSourceFile, span: SourceSpan): string => {
  return file.sourceText.slice(
    textIndexAtOffset(file, span.start.offset),
    textIndexAtOffset(file, span.end.offset),
  );
};

/**
 * Looks up the UTF-16 string index for a valid source byte offset.
 */
const textIndexAtOffset = (file: OriginalSourceFile, offset: number): number => {
  const index = sourceIndexes(file).textIndexes.get(offset);
  if (index === undefined) {
    throw new SourceOffsetError(`Offset ${offset} is not a valid source position.`);
  }

  return index;
};

/**
 * Looks up the first line text for a validated snippet position.
 */
const lineTextAtPosition = (file: OriginalSourceFile, position: SourcePosition): string => {
  const sourceLine = file.lines.find((line) => line.line === position.line);
  if (sourceLine === undefined) {
    throw new SourceOffsetError(`Line ${position.line} does not exist in ${file.filePath}.`);
  }

  return sourceLine.text;
};

/**
 * Returns private lookup tables for source records created by this module.
 */
const sourceIndexes = (file: OriginalSourceFile): SourceIndexes => {
  const indexes = SOURCE_INDEXES.get(file);
  if (indexes === undefined) {
    throw new SourceOffsetError(`${file.filePath} was not created by createOriginalSourceFile.`);
  }

  return indexes;
};

/**
 * Checks whether two positions have the same public diagnostic coordinates.
 */
const isSamePosition = (left: SourcePosition, right: SourcePosition): boolean => {
  return left.offset === right.offset && left.line === right.line && left.column === right.column;
};

/**
 * Checks whether a character starts a supported line terminator.
 */
const isLineTerminator = (character: string): boolean => {
  return character === "\n" || character === "\r";
};

/**
 * Checks whether the current string index starts one CRLF terminator.
 */
const isCrLfTerminator = (sourceText: string, index: number): boolean => {
  return sourceText[index] === "\r" && sourceText[index + 1] === "\n";
};

/**
 * Copies a source line into a readonly record.
 */
const sourceLine = (line: SourceLine): SourceLine => {
  return Object.freeze({ ...line });
};

/**
 * Copies a source position into a readonly record.
 */
const sourcePosition = (position: SourcePosition): SourcePosition => {
  return Object.freeze({ ...position });
};

/**
 * Copies a source span into a readonly record.
 */
const sourceSpan = (span: SourceSpan): SourceSpan => {
  return Object.freeze({
    start: span.start,
    end: span.end,
  });
};
