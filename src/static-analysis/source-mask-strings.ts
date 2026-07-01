/**
 * @file Quoted-string range scanning for source masking.
 *
 * Quoted strings terminate at their delimiter or at the first unescaped line
 * terminator, while this module owns the string-token start rules.
 */

import { createMaskedRange, isLineTerminatorCharacter } from "./source-mask-delimiters";
import type { SourceMaskRange } from "./source-mask-types";

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
  if (character !== "'" && character !== '"') {
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
  let index = startIndex + 1;

  while (index < sourceText.length) {
    const currentCharacter = sourceText[index] ?? "";
    if (currentCharacter === "\\") {
      index = nextEscapedQuotedStringIndex(sourceText, index);
      continue;
    }
    if (currentCharacter === delimiter) {
      return index + 1;
    }
    if (isLineTerminatorCharacter(currentCharacter)) {
      return index;
    }
    index += 1;
  }

  return sourceText.length;
};

/** Finds the next index after an escaped quoted-string character. */
const nextEscapedQuotedStringIndex = (sourceText: string, index: number): number => {
  return isEscapedCrLfLineContinuation(sourceText, index) ? index + 3 : index + 2;
};

/** Checks whether a quoted-string escape consumes a CRLF line continuation. */
const isEscapedCrLfLineContinuation = (sourceText: string, index: number): boolean => {
  if (sourceText[index + 1] !== "\r") {
    return false;
  }

  return sourceText[index + 2] === "\n";
};
