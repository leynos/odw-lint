/** @file Shared delimiter and comment scanners for metadata parsing. */

import {
  blockCommentEnd,
  type StringLikeDelimiter,
  scanDelimitedRegionEnd,
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
  return scanDelimitedRegionEnd(text, startIndex, delimiter, {
    endIndex,
    allowTemplateInterpolation: true,
  });
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
