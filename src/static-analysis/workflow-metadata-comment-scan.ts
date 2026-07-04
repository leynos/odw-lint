/** @file Shared delimiter and comment scanners for metadata parsing. */

import {
  blockCommentEnd,
  indexAfterEscapedUnit,
  lineCommentContentEnd,
  type StringLikeDelimiter,
  templateExpressionEnd,
} from "./source-scanner-primitives";

/**
 * Scans one quoted or template-delimited region.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive text index of the opening delimiter.
 * @param delimiter - String or template delimiter to match.
 * @param endIndex - Exclusive maximum scan index.
 * @returns The index just after the closing delimiter, or `endIndex`.
 */
export const scanDelimitedEnd = (
  text: string,
  startIndex: number,
  delimiter: StringLikeDelimiter,
  endIndex: number,
): number => {
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const character = text[index] ?? "";
    if (character === "\\") {
      index = indexAfterEscapedUnit(text, index) - 1;
      continue;
    }
    if (delimiter === "`" && text.startsWith("${", index)) {
      index = templateExpressionEnd(text, index + 2, endIndex) - 1;
      continue;
    }
    if (character === delimiter) {
      return index + 1;
    }
  }
  return endIndex;
};

/**
 * Scans a line comment body and preserves line terminator ownership.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive text index after the opening `//`.
 * @param endIndex - Exclusive maximum scan index.
 * @returns The line terminator index, or `endIndex`.
 */
export const scanLineCommentEnd = (text: string, startIndex: number, endIndex: number): number => {
  return lineCommentContentEnd(text, startIndex, endIndex);
};

/**
 * Scans a block comment and falls back to EOF when unterminated or out of range.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive text index after the opening block marker.
 * @param endIndex - Exclusive maximum scan index.
 * @returns The index just after the closing block marker, or `endIndex`.
 */
export const scanBlockCommentEnd = (text: string, startIndex: number, endIndex: number): number => {
  return blockCommentEnd(text, startIndex, endIndex);
};
