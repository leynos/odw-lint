/**
 * @file Original source scanning for static-analysis source helpers.
 *
 * This module owns the single production pass over original workflow text. It
 * records display lines, UTF-8 byte offsets, and UTF-16 string indexes before
 * parser normalization or future span mapping can alter the source shape.
 */

import type { SourcePosition } from "../diagnostics/types";
import type { SourceLine } from "./types";

const TEXT_ENCODER = new TextEncoder();

/**
 * Private lookup tables derived from the original source text.
 */
export type SourceIndexes = {
  /** Positions keyed by valid UTF-8 byte offset. */
  readonly positions: ReadonlyMap<number, SourcePosition>;
  /** UTF-16 string indexes keyed by valid UTF-8 byte offset. */
  readonly textIndexes: ReadonlyMap<number, number>;
};

/**
 * Complete production scan result for one original source text.
 */
export type SourceScan = SourceIndexes & {
  /** UTF-8 byte length of the whole original source. */
  readonly byteLength: number;
  /** Display-line metadata derived during the same scan as lookup indexes. */
  readonly lines: readonly SourceLine[];
};

/**
 * Builds display lines and private offset indexes in one production scan.
 *
 * @param sourceText - Original workflow source text.
 * @returns The byte length, display lines, and private lookup tables.
 */
export const scanOriginalSource = (sourceText: string): SourceScan => {
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

    byteOffset += utf8ByteLengthForCodePoint(codePoint);
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
 * Computes the UTF-8 byte length of source text in Bun and browser runtimes.
 *
 * @param text - Text to encode as UTF-8.
 * @returns The encoded byte length.
 */
export const utf8ByteLength = (text: string): number => {
  return TEXT_ENCODER.encode(text).length;
};

/** Computes UTF-8 width for one already-decoded Unicode code point. */
const utf8ByteLengthForCodePoint = (codePoint: number): number => {
  if (codePoint <= 0x7f) {
    return 1;
  }
  if (codePoint <= 0x7ff) {
    return 2;
  }
  if (codePoint <= 0xffff) {
    return 3;
  }

  return 4;
};

/**
 * Checks whether a character starts a supported line terminator.
 *
 * @param character - Source character to classify.
 * @returns True when the character is a current source line terminator.
 */
export const isLineTerminator = (character: string): boolean => {
  return character === "\n" || character === "\r";
};

/**
 * Checks whether the current string index starts one CRLF terminator.
 *
 * @param sourceText - Original workflow source text.
 * @param index - UTF-16 string index to inspect.
 * @returns True when the index starts a CRLF terminator pair.
 */
export const isCrLfTerminator = (sourceText: string, index: number): boolean => {
  return sourceText[index] === "\r" && sourceText[index + 1] === "\n";
};

/**
 * Copies a source line into a readonly record.
 *
 * @param line - Source line metadata to freeze.
 * @returns An immutable copy of the source line.
 */
export const sourceLine = (line: SourceLine): SourceLine => {
  return Object.freeze({ ...line });
};

/**
 * Copies a source position into a readonly record.
 *
 * @param position - Source position metadata to freeze.
 * @returns An immutable copy of the source position.
 */
export const sourcePosition = (position: SourcePosition): SourcePosition => {
  return Object.freeze({ ...position });
};
