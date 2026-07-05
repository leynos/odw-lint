/**
 * @file Quoted-string range scanning for source masking.
 *
 * Quoted strings terminate at their delimiter or at the first unescaped line
 * terminator, while this module owns the string-token start rules.
 */

import { createMaskedRange } from "./source-mask-delimiters";
import type { SourceMaskRange } from "./source-mask-types";
import { isQuotedStringDelimiter, scanDelimitedRegionEnd } from "./source-scanner-primitives";

/**
 * Scans a single-quoted or double-quoted string from an opening delimiter.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the candidate delimiter.
 * @param character - Character at the candidate start index.
 * @returns String mask range, or `undefined` when no quoted string starts here.
 */
export const scanQuotedStringRange = (
  sourceText: string,
  startIndex: number,
  character: string,
): SourceMaskRange | undefined => {
  if (!isQuotedStringDelimiter(character)) {
    return undefined;
  }

  return createMaskedRange(
    "string",
    startIndex,
    scanQuotedStringEnd(sourceText, startIndex, character),
  );
};

/**
 * Finds a quoted-string end without consuming valid code after a line break.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the opening delimiter.
 * @param delimiter - Opening string delimiter.
 * @returns Exclusive end index for the quoted-string range.
 */
export const scanQuotedStringEnd = (
  sourceText: string,
  startIndex: number,
  delimiter: string,
): number => {
  return scanDelimitedRegionEnd(sourceText, startIndex, delimiter, {
    terminateAtLineTerminator: true,
  });
};
