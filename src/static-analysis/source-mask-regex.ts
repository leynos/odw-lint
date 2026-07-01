/**
 * @file Regex-literal range scanning for source masking.
 *
 * ODW envelope scanning treats regex literals as inert only when a slash
 * appears after one of the static source contexts where a regex may start.
 */

import { createMaskedRange, isLineTerminatorCharacter } from "./source-mask-delimiters";
import type { SourceMaskRange } from "./source-mask-types";

export const REGEX_ALLOWED_PREVIOUS_CHARACTERS = new Set("([{,;:=!&|?+-*%<>~^".split(""));
export const REGEX_ALLOWED_PREVIOUS_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);
export const REGEX_DISALLOWED_PREVIOUS_TOKENS = new Set(["++", "--"]);

/**
 * Scans an ODW-recognized regex literal from an allowed slash position.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the candidate slash.
 * @param character - Character at the candidate start index.
 * @param previousSignificantCharacter - Last non-whitespace character before the candidate.
 * @param previousSignificantToken - Last non-whitespace token before the candidate.
 * @returns Regex mask range, or `undefined` when no regex starts here.
 */
export const scanRegexRange = (
  sourceText: string,
  startIndex: number,
  character: string,
  previousSignificantCharacter: string,
  previousSignificantToken: string,
): SourceMaskRange | undefined => {
  if (
    character !== "/" ||
    !isRegexAllowedAfter(previousSignificantCharacter, previousSignificantToken)
  ) {
    return undefined;
  }

  const endIndex = scanRegexEnd(sourceText, startIndex);
  if (endIndex === undefined) {
    return undefined;
  }

  return createMaskedRange("regex", startIndex, endIndex);
};

/**
 * Checks ODW's preceding-significant-character regex heuristic.
 *
 * @param previousSignificantCharacter - Last non-whitespace character before a slash.
 * @param previousSignificantToken - Last non-whitespace token before a slash.
 * @returns Whether the slash may start a regex literal.
 */
export const isRegexAllowedAfter = (
  previousSignificantCharacter: string,
  previousSignificantToken: string,
): boolean => {
  if (REGEX_DISALLOWED_PREVIOUS_TOKENS.has(previousSignificantToken)) {
    return false;
  }
  if (REGEX_ALLOWED_PREVIOUS_KEYWORDS.has(previousSignificantToken)) {
    return true;
  }

  return (
    previousSignificantCharacter === "" ||
    REGEX_ALLOWED_PREVIOUS_CHARACTERS.has(previousSignificantCharacter)
  );
};

/**
 * Finds a terminated regex literal end.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the opening slash.
 * @returns Exclusive end index, or `undefined` for unterminated candidates.
 */
export const scanRegexEnd = (sourceText: string, startIndex: number): number | undefined => {
  let isInCharacterClass = false;
  let hasRegexBody = false;
  let index = startIndex + 1;

  while (index < sourceText.length) {
    const nextStep = nextRegexScanStep(sourceText, index, isInCharacterClass);
    if (nextStep === undefined) {
      return undefined;
    }
    if (nextStep.endIndex !== undefined) {
      return hasRegexBody ? nextStep.endIndex : undefined;
    }
    hasRegexBody = true;
    index = nextStep.nextIndex;
    isInCharacterClass = nextStep.isInCharacterClass;
  }

  return undefined;
};

export type RegexScanStep = Readonly<{
  readonly nextIndex: number;
  readonly isInCharacterClass: boolean;
  readonly endIndex?: number;
}>;

/**
 * Advances one regex body scan step.
 *
 * @param sourceText - Original source text to scan.
 * @param index - UTF-16 index of the regex body character.
 * @param isInCharacterClass - Whether the scanner is inside `[...]`.
 * @returns Next scan step, or `undefined` when the regex is unterminated.
 */
export const nextRegexScanStep = (
  sourceText: string,
  index: number,
  isInCharacterClass: boolean,
): RegexScanStep | undefined => {
  const character = sourceText[index] ?? "";
  if (isLineTerminatorCharacter(character)) {
    return undefined;
  }
  if (character === "\\") {
    return nextEscapedRegexScanStep(sourceText, index, isInCharacterClass);
  }
  const classBoundaryStep = nextRegexClassBoundaryStep(sourceText, index, isInCharacterClass);
  if (classBoundaryStep !== undefined) {
    return classBoundaryStep;
  }
  if (isRegexDelimiter(character, isInCharacterClass)) {
    return {
      endIndex: scanRegexFlagsEnd(sourceText, index + 1),
      isInCharacterClass,
      nextIndex: index + 1,
    };
  }

  return {
    isInCharacterClass,
    nextIndex: index + 1,
  };
};

/**
 * Advances over a regex character-class boundary.
 *
 * @param sourceText - Original source text to scan.
 * @param index - UTF-16 index of the class-boundary candidate.
 * @param isInCharacterClass - Whether the scanner is inside `[...]`.
 * @returns Next scan step for a boundary, or `undefined` for ordinary text.
 */
export const nextRegexClassBoundaryStep = (
  sourceText: string,
  index: number,
  isInCharacterClass: boolean,
): RegexScanStep | undefined => {
  const character = sourceText[index] ?? "";
  if (isRegexClassOpen(character, isInCharacterClass)) {
    return {
      isInCharacterClass: true,
      nextIndex: index + 1,
    };
  }
  if (isRegexClassClose(sourceText, index, isInCharacterClass)) {
    return {
      isInCharacterClass: false,
      nextIndex: index + 1,
    };
  }

  return undefined;
};

/**
 * Advances over an escaped regex character when it is not a line terminator.
 *
 * @param sourceText - Original source text to scan.
 * @param index - UTF-16 index of the escape character.
 * @param isInCharacterClass - Whether the scanner is inside `[...]`.
 * @returns Next scan step, or `undefined` when the escape targets a line terminator.
 */
export const nextEscapedRegexScanStep = (
  sourceText: string,
  index: number,
  isInCharacterClass: boolean,
): RegexScanStep | undefined => {
  if (isLineTerminatorCharacter(sourceText[index + 1] ?? "")) {
    return undefined;
  }

  return {
    isInCharacterClass,
    nextIndex: index + 2,
  };
};

/**
 * Checks for regex character-class boundaries.
 *
 * @param character - Regex body character to classify.
 * @returns Whether the character opens or closes a character class.
 */
export const isRegexClassBoundary = (character: string): boolean => {
  return character === "[" || character === "]";
};

/**
 * Checks whether a character opens a regex character class.
 *
 * @param character - Regex body character to classify.
 * @param isInCharacterClass - Whether the scanner is already inside `[...]`.
 * @returns Whether the character opens a new character class.
 */
export const isRegexClassOpen = (character: string, isInCharacterClass: boolean): boolean => {
  return character === "[" && !isInCharacterClass;
};

/**
 * Checks whether a character closes a regex character class.
 *
 * @param sourceText - Original source text to scan.
 * @param index - UTF-16 index of the class-close candidate.
 * @param isInCharacterClass - Whether the scanner is inside `[...]`.
 * @returns Whether the character is a real class close.
 */
export const isRegexClassClose = (
  sourceText: string,
  index: number,
  isInCharacterClass: boolean,
): boolean => {
  if (!isInCharacterClass || sourceText[index] !== "]") {
    return false;
  }

  return !isLeadingRegexClassClose(sourceText, index);
};

/**
 * Checks for `]` that is literal because it leads a character class.
 *
 * @param sourceText - Original source text to scan.
 * @param index - UTF-16 index of the class-close candidate.
 * @returns Whether the `]` is a leading literal instead of a class close.
 */
export const isLeadingRegexClassClose = (sourceText: string, index: number): boolean => {
  const previousCharacter = sourceText[index - 1] ?? "";
  if (previousCharacter === "[") {
    return true;
  }

  return previousCharacter === "^" && sourceText[index - 2] === "[";
};

/**
 * Checks whether the current slash closes the regex body.
 *
 * @param character - Regex body character to classify.
 * @param isInCharacterClass - Whether the scanner is inside `[...]`.
 * @returns Whether the current slash closes the regex literal.
 */
export const isRegexDelimiter = (character: string, isInCharacterClass: boolean): boolean => {
  if (character !== "/") {
    return false;
  }

  return !isInCharacterClass;
};

/**
 * Finds the first index after regex flags.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index immediately after the closing slash.
 * @returns Exclusive end index after zero or more flag characters.
 */
export const scanRegexFlagsEnd = (sourceText: string, startIndex: number): number => {
  let index = startIndex;

  while (index < sourceText.length && /[A-Za-z0-9_$]/u.test(sourceText[index] ?? "")) {
    index += 1;
  }

  return index;
};
