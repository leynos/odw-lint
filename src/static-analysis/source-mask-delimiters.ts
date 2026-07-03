/**
 * @file Shared delimiter and range helpers for source masking scanners.
 *
 * Token-family modules share these helpers so blanking and delimiter movement
 * stay aligned to one UTF-16 source-index contract.
 */

import type { SourceMaskKind, SourceMaskRange } from "./source-mask-types";

const WHITESPACE_PATTERN = /^\s$/u;

export type QuotedStringDelimiter = "'" | '"';
export type TemplateDelimiter = "`";
export type RegexDelimiter = "/";
export type StringLikeDelimiter = QuotedStringDelimiter | TemplateDelimiter;

/**
 * Checks for JavaScript line terminators.
 *
 * @param character - Source character to classify.
 * @returns Whether the character is a JavaScript line terminator.
 */
export const isLineTerminatorCharacter = (character: string): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

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
    characters[index] = isLineTerminatorCharacter(character) ? character : " ";
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
      index += 2;
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
 * Checks for a single-quoted or double-quoted string start.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can delimit a quoted string.
 */
export const isQuotedStringDelimiter = (character: string): character is QuotedStringDelimiter => {
  return character === "'" || character === '"';
};

/**
 * Checks for a template-literal delimiter.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can delimit a template literal.
 */
export const isTemplateDelimiter = (character: string): character is TemplateDelimiter => {
  return character === "`";
};

/**
 * Checks for a regex-literal delimiter.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can delimit a regex literal.
 */
export const isRegexDelimiter = (character: string): character is RegexDelimiter => {
  return character === "/";
};

/**
 * Checks for a nested string-like token start.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can open string-like template content.
 */
export const isStringLikeDelimiter = (character: string): character is StringLikeDelimiter => {
  return isQuotedStringDelimiter(character) || isTemplateDelimiter(character);
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
