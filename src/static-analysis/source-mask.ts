/**
 * @file Inert-region source masking for static envelope scans.
 *
 * This module blanks comments, quoted strings, whole template literals, and
 * ODW-recognized regex literals while preserving original UTF-16 indexes.
 */

import type { OriginalSourceFile } from "./types";

/** Inert source region kind recognised by the source masker. */
export type SourceMaskKind = "comment" | "string" | "template" | "regex";

/** Half-open UTF-16 text-index range masked in an original source file. */
export type SourceMaskRange = Readonly<{
  kind: SourceMaskKind;
  startIndex: number;
  endIndex: number;
}>;
/** Masked source text plus the inert ranges that produced it. */
export type MaskedSource = Readonly<{
  sourceFile: OriginalSourceFile;
  maskedText: string;
  ranges: readonly SourceMaskRange[];
}>;
type TemplateScanState = { readonly expressionDepth: number; readonly index: number };
type TemplateScanStep = TemplateScanState & { readonly endIndex?: number };
const REGEX_ALLOWED_PREVIOUS_CHARACTERS = new Set("([{,;:=!&|?+-*%<>~^".split(""));

/**
 * Masks inert source regions while leaving code and line terminators aligned.
 *
 * @param sourceFile - Factory-created original source file to mask.
 * @returns Frozen masked source data aligned to the original source text.
 */
export const maskNonCodeSource = (sourceFile: OriginalSourceFile): MaskedSource => {
  const sourceText = sourceFile.sourceText;
  const characters = sourceText.split("");
  const ranges: SourceMaskRange[] = [];
  let previousSignificantCharacter = "";
  let index = 0;

  while (index < sourceText.length) {
    const range = scanMaskRange(sourceText, index, previousSignificantCharacter);

    if (range !== undefined) {
      blankMaskedRange(characters, sourceText, range);
      ranges.push(range);
      previousSignificantCharacter = nextSignificantCharacterAfterRange(
        sourceText,
        range,
        previousSignificantCharacter,
      );
      index = range.endIndex;
      continue;
    }

    const character = sourceText[index] ?? "";
    if (!/\s/u.test(character)) {
      previousSignificantCharacter = character;
    }
    index += 1;
  }

  const frozenRanges = Object.freeze(ranges.map((range) => Object.freeze(range)));

  return Object.freeze({
    sourceFile,
    maskedText: characters.join(""),
    ranges: frozenRanges,
  });
};

/** Preserves expression context across masked non-comment tokens. */
const nextSignificantCharacterAfterRange = (
  sourceText: string,
  range: SourceMaskRange,
  previousSignificantCharacter: string,
): string => {
  if (range.kind === "comment") {
    return previousSignificantCharacter;
  }
  return lastSignificantCharacterInRange(sourceText, range) ?? previousSignificantCharacter;
};

/** Finds the final non-whitespace source character inside a masked range. */
const lastSignificantCharacterInRange = (
  sourceText: string,
  range: SourceMaskRange,
): string | undefined => {
  for (let index = range.endIndex - 1; index >= range.startIndex; index -= 1) {
    const character = sourceText[index] ?? "";
    if (!/\s/u.test(character)) {
      return character;
    }
  }
  return undefined;
};

/** Scans for any maskable range at one source-text index. */
const scanMaskRange = (
  sourceText: string,
  startIndex: number,
  previousSignificantCharacter: string,
): SourceMaskRange | undefined => {
  const character = sourceText[startIndex] ?? "";
  const nextCharacter = sourceText[startIndex + 1] ?? "";
  return (
    scanCommentRange(sourceText, startIndex, character, nextCharacter) ??
    scanQuotedStringRange(sourceText, startIndex, character) ??
    scanTemplateRange(sourceText, startIndex, character) ??
    scanRegexRange(sourceText, startIndex, character, previousSignificantCharacter)
  );
};

/** Checks for JavaScript line terminators. */
const isLineTerminatorCharacter = (character: string): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

/** Blanks one range while preserving every line terminator character. */
const blankMaskedRange = (
  characters: string[],
  sourceText: string,
  range: SourceMaskRange,
): void => {
  for (let index = range.startIndex; index < range.endIndex; index += 1) {
    const character = sourceText[index] ?? "";
    characters[index] = isLineTerminatorCharacter(character) ? character : " ";
  }
};

/** Creates an immutable mask range with a bounded kind and text-index span. */
const createMaskedRange = (
  kind: SourceMaskKind,
  startIndex: number,
  endIndex: number,
): SourceMaskRange => {
  return { kind, startIndex, endIndex };
};

/** Scans line or block comments from a slash position. */
const scanCommentRange = (
  sourceText: string,
  startIndex: number,
  character: string,
  nextCharacter: string,
): SourceMaskRange | undefined => {
  if (!isCommentStart(character, nextCharacter)) {
    return undefined;
  }
  if (nextCharacter === "/") {
    return createMaskedRange("comment", startIndex, scanLineCommentEnd(sourceText, startIndex + 2));
  }
  const terminatorIndex = sourceText.indexOf("*/", startIndex + 2);
  const endIndex = terminatorIndex === -1 ? sourceText.length : terminatorIndex + 2;

  return createMaskedRange("comment", startIndex, endIndex);
};

/** Scans a single-quoted or double-quoted string from an opening delimiter. */
const scanQuotedStringRange = (
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
    scanEscapedDelimitedEnd(sourceText, startIndex, character),
  );
};

/** Scans a whole template literal, including interpolation code, as inert. */
const scanTemplateRange = (
  sourceText: string,
  startIndex: number,
  character: string,
): SourceMaskRange | undefined => {
  if (character !== "`") {
    return undefined;
  }

  return createMaskedRange("template", startIndex, scanTemplateEnd(sourceText, startIndex));
};

/** Scans an ODW-recognized regex literal from an allowed slash position. */
const scanRegexRange = (
  sourceText: string,
  startIndex: number,
  character: string,
  previousSignificantCharacter: string,
): SourceMaskRange | undefined => {
  if (character !== "/" || !isRegexAllowedAfter(previousSignificantCharacter)) {
    return undefined;
  }

  const endIndex = scanRegexEnd(sourceText, startIndex);
  if (endIndex === undefined) {
    return undefined;
  }

  return createMaskedRange("regex", startIndex, endIndex);
};

/** Checks ODW's preceding-significant-character regex heuristic. */
const isRegexAllowedAfter = (previousSignificantCharacter: string): boolean => {
  return (
    previousSignificantCharacter === "" ||
    REGEX_ALLOWED_PREVIOUS_CHARACTERS.has(previousSignificantCharacter)
  );
};

/** Checks for comment start characters. */
const isCommentStart = (character: string, nextCharacter: string): boolean => {
  if (character !== "/") {
    return false;
  }

  return nextCharacter === "/" || nextCharacter === "*";
};

/** Finds a line comment end. */
const scanLineCommentEnd = (sourceText: string, startIndex: number): number => {
  let index = startIndex;

  while (index < sourceText.length) {
    if (isLineTerminatorCharacter(sourceText[index] ?? "")) {
      if (sourceText[index] === "\r" && sourceText[index + 1] === "\n") {
        return index + 2;
      }

      return index + 1;
    }
    index += 1;
  }

  return sourceText.length;
};

/** Finds an escaped string-like delimiter end. */
const scanEscapedDelimitedEnd = (
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

/** Finds a whole template literal end. */
const scanTemplateEnd = (sourceText: string, startIndex: number): number => {
  let state: TemplateScanState = { expressionDepth: 0, index: startIndex + 1 };

  while (state.index < sourceText.length) {
    const nextStep = nextTemplateStep(sourceText, state);
    if (nextStep.endIndex !== undefined) {
      return nextStep.endIndex;
    }
    state = nextStep;
  }

  return sourceText.length;
};

/** Advances a template scan step. */
const nextTemplateStep = (sourceText: string, state: TemplateScanState): TemplateScanStep => {
  const nestedIndex = nextTemplateIndex(sourceText, state.index, state.expressionDepth);
  if (nestedIndex !== undefined) {
    return { expressionDepth: state.expressionDepth, index: nestedIndex };
  }
  if (isTemplateClose(sourceText, state)) {
    return { ...state, endIndex: state.index + 1 };
  }
  if (isTemplateExpressionOpen(sourceText, state.index)) {
    return { expressionDepth: state.expressionDepth + 1, index: state.index + 2 };
  }

  return nextOrdinaryTemplateStep(sourceText, state);
};

/** Skips escaped and nested string-like template content. */
const nextTemplateIndex = (
  sourceText: string,
  index: number,
  expressionDepth: number,
): number | undefined => {
  const character = sourceText[index] ?? "";
  if (character === "\\") {
    return index + 2;
  }
  if (expressionDepth === 0) {
    return undefined;
  }
  if (isStringLikeDelimiter(character)) {
    return scanEscapedDelimitedEnd(sourceText, index, character);
  }

  return undefined;
};

/** Checks for the outer template close. */
const isTemplateClose = (sourceText: string, state: TemplateScanState): boolean => {
  return state.expressionDepth === 0 && sourceText[state.index] === "`";
};

/** Checks for template interpolation start. */
const isTemplateExpressionOpen = (sourceText: string, index: number): boolean => {
  return sourceText[index] === "$" && sourceText[index + 1] === "{";
};

/** Advances through one ordinary template character. */
const nextOrdinaryTemplateStep = (
  sourceText: string,
  state: TemplateScanState,
): TemplateScanState => {
  if (state.expressionDepth > 0 && sourceText[state.index] === "}") {
    return { expressionDepth: state.expressionDepth - 1, index: state.index + 1 };
  }

  return { expressionDepth: state.expressionDepth, index: state.index + 1 };
};

/** Checks for a nested string-like token start. */
const isStringLikeDelimiter = (character: string): boolean => {
  return character === "'" || character === '"' || character === "`";
};

/** Finds a terminated regex literal end. */
const scanRegexEnd = (sourceText: string, startIndex: number): number | undefined => {
  let isInCharacterClass = false;
  let index = startIndex + 1;

  while (index < sourceText.length) {
    const character = sourceText[index] ?? "";
    if (isLineTerminatorCharacter(character)) {
      return undefined;
    }
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (isRegexClassBoundary(character)) {
      isInCharacterClass = character === "[";
      index += 1;
      continue;
    }
    if (isRegexDelimiter(character, isInCharacterClass)) {
      return scanRegexFlagsEnd(sourceText, index + 1);
    }
    index += 1;
  }

  return undefined;
};

/** Checks for regex character-class boundaries. */
const isRegexClassBoundary = (character: string): boolean => {
  return character === "[" || character === "]";
};

/** Checks whether the current slash closes the regex body. */
const isRegexDelimiter = (character: string, isInCharacterClass: boolean): boolean => {
  if (character !== "/") {
    return false;
  }

  return !isInCharacterClass;
};

/** Finds the first index after regex flags. */
const scanRegexFlagsEnd = (sourceText: string, startIndex: number): number => {
  let index = startIndex;

  while (index < sourceText.length && /[A-Za-z0-9_$]/u.test(sourceText[index] ?? "")) {
    index += 1;
  }

  return index;
};
