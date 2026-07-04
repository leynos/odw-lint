/**
 * @file Shared delimiter and range helpers for source masking scanners.
 *
 * Token-family modules share these helpers so blanking and delimiter movement
 * stay aligned to one UTF-16 source-index contract.
 */

import type { SourceMaskKind, SourceMaskRange } from "./source-mask-types";
import { indexAfterEscapedUnit, isSourceLineTerminator } from "./source-scanner-primitives";

const WHITESPACE_PATTERN = /^\s$/u;

/**
 * Blanks one range while preserving every line terminator character.
 *
 * @param characters - Mutable character buffer being masked in place.
 * @param sourceText - Original source text that owns the range indexes.
 * @param range - Half-open source range to blank.
 */
export const blankMaskedRange = (
  characters: string[],
  sourceText: string,
  range: SourceMaskRange,
): void => {
  for (let index = range.startIndex; index < range.endIndex; index += 1) {
    const character = sourceText[index] ?? "";
    characters[index] = isSourceLineTerminator(character) ? character : " ";
  }
};

/**
 * Creates an immutable mask range with a bounded kind and text-index span.
 *
 * @param kind - Inert source region kind represented by the range.
 * @param startIndex - Inclusive UTF-16 source-text start index.
 * @param endIndex - Exclusive UTF-16 source-text end index.
 * @returns Source mask range for the requested span.
 */
export const createMaskedRange = (
  kind: SourceMaskKind,
  startIndex: number,
  endIndex: number,
): SourceMaskRange => {
  return { kind, startIndex, endIndex };
};

/**
 * Finds an escaped string-like delimiter end.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the opening delimiter.
 * @param delimiter - Delimiter character that closes the token.
 * @returns Exclusive end index, or source length for an unterminated token.
 */
export const scanEscapedDelimitedEnd = (
  sourceText: string,
  startIndex: number,
  delimiter: string,
): number => {
  let index = startIndex + 1;

  while (index < sourceText.length) {
    const character = sourceText[index] ?? "";
    if (character === "\\") {
      index = indexAfterEscapedUnit(sourceText, index);
      continue;
    }
    if (character === delimiter) {
      return index + 1;
    }
    index += 1;
  }

  return sourceText.length;
};

/**
 * Checks for JavaScript whitespace.
 *
 * @param character - Source character to classify.
 * @returns Whether the character is JavaScript whitespace or a line terminator.
 */
export const isWhitespaceCharacter = (character: string): boolean => {
  return WHITESPACE_PATTERN.test(character);
};
