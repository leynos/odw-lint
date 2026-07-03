/**
 * @file Template literal range scanning for source masking.
 *
 * ODW envelope scanning treats whole template literals as inert, including
 * interpolation code, so this module owns nested template scan state.
 */

import {
  isAsciiIdentifierCharacter,
  isAsciiIdentifierStartCharacter,
} from "./javascript-identifiers";
import { scanCommentRange } from "./source-mask-comments";
import {
  createMaskedRange,
  isLineTerminatorCharacter,
  isRegexDelimiter,
  isStringLikeDelimiter,
  isTemplateDelimiter,
  isWhitespaceCharacter,
  scanEscapedDelimitedEnd,
} from "./source-mask-delimiters";
import { scanRegexBodyEnd } from "./source-mask-regex";
import type { SourceMaskRange } from "./source-mask-types";

const TEMPLATE_REGEX_ALLOWED_PREVIOUS_CHARACTERS = new Set("([{,;:=!&|?+-*%<>~^".split(""));
const TEMPLATE_REGEX_ALLOWED_PREVIOUS_KEYWORDS = new Set(["await", "return", "throw", "yield"]);

/** State for a template scan step. */
export type TemplateScanState = { readonly expressionDepth: number; readonly index: number };

/** Template scan state plus an optional terminating index. */
export type TemplateScanStep = TemplateScanState & { readonly endIndex?: number };

/**
 * Scans a whole template literal, including interpolation code, as inert.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the candidate backtick.
 * @param character - Character at the candidate start index.
 * @returns Template mask range, or `undefined` when no template starts here.
 */
export const scanTemplateRange = (
  sourceText: string,
  startIndex: number,
  character: string,
): SourceMaskRange | undefined => {
  if (!isTemplateDelimiter(character)) {
    return undefined;
  }

  return createMaskedRange("template", startIndex, scanTemplateEnd(sourceText, startIndex));
};

/**
 * Finds a whole template literal end.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the opening backtick.
 * @returns Exclusive end index for the template range.
 */
export const scanTemplateEnd = (sourceText: string, startIndex: number): number => {
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

/**
 * Advances a template scan step.
 *
 * @param sourceText - Original source text to scan.
 * @param state - Current template scan state.
 * @returns Next scan state, or state plus `endIndex` when the template closes.
 */
export const nextTemplateStep = (
  sourceText: string,
  state: TemplateScanState,
): TemplateScanStep => {
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

/**
 * Skips escaped and nested string-like template content.
 *
 * @param sourceText - Original source text to scan.
 * @param index - Current UTF-16 source-text index.
 * @param expressionDepth - Current template expression nesting depth.
 * @returns Next index for skipped nested content, or `undefined`.
 */
export const nextTemplateIndex = (
  sourceText: string,
  index: number,
  expressionDepth: number,
): number | undefined => {
  const escapedEnd = nextEscapedTemplateIndex(sourceText, index);
  if (escapedEnd !== undefined) {
    return escapedEnd;
  }
  if (expressionDepth === 0) {
    return undefined;
  }

  return nextTemplateExpressionIndex(sourceText, index);
};

/** Skips an escaped character in template text. */
const nextEscapedTemplateIndex = (sourceText: string, index: number): number | undefined => {
  if (sourceText[index] === "\\") {
    return index + 2;
  }

  return undefined;
};

/** Skips inert tokens inside a template expression. */
const nextTemplateExpressionIndex = (sourceText: string, index: number): number | undefined => {
  const character = sourceText[index] ?? "";
  const commentEndIndex = nextTemplateCommentIndex(sourceText, index, character);
  if (commentEndIndex !== undefined) {
    return commentEndIndex;
  }
  if (isTemplateRegexStart(sourceText, index, character)) {
    return scanTemplateRegexEnd(sourceText, index);
  }
  if (isTemplateDelimiter(character)) {
    return scanTemplateEnd(sourceText, index);
  }
  if (isStringLikeDelimiter(character)) {
    return scanEscapedDelimitedEnd(sourceText, index, character);
  }

  return undefined;
};

/** Checks the local preceding-token regex heuristic. */
const isTemplateRegexStart = (sourceText: string, index: number, character: string): boolean => {
  if (!isRegexDelimiter(character)) {
    return false;
  }

  const previousCharacter = previousSignificantTemplateCharacter(sourceText, index);
  if (isTemplateRegexAllowedAfter(previousCharacter)) {
    return true;
  }

  return isTemplateRegexAllowedAfter(previousSignificantTemplateToken(sourceText, index));
};

/** Checks whether a template-expression slash may start a regex. */
const isTemplateRegexAllowedAfter = (previousSignificantToken: string): boolean => {
  return (
    previousSignificantToken === "" ||
    TEMPLATE_REGEX_ALLOWED_PREVIOUS_CHARACTERS.has(previousSignificantToken) ||
    TEMPLATE_REGEX_ALLOWED_PREVIOUS_KEYWORDS.has(previousSignificantToken)
  );
};

/** Finds the nearest non-whitespace, non-comment character before an expression index. */
const previousSignificantTemplateCharacter = (sourceText: string, index: number): string => {
  const token = previousSignificantTemplateToken(sourceText, index);

  return token.at(-1) ?? "";
};

/** Finds the nearest non-whitespace, non-comment token before an expression index. */
const previousSignificantTemplateToken = (sourceText: string, index: number): string => {
  let cursor = previousSignificantTemplateIndex(sourceText, index);
  while (cursor >= 0) {
    const commentStartIndex = previousTemplateCommentStartIndex(sourceText, cursor);
    if (commentStartIndex === undefined) {
      break;
    }
    cursor = previousSignificantTemplateIndex(sourceText, commentStartIndex);
  }

  const character = sourceText[cursor] ?? "";
  if (!isAsciiIdentifierStartCharacter(character)) {
    return character;
  }

  const tokenEndIndex = cursor + 1;
  while (cursor >= 0 && isAsciiIdentifierCharacter(sourceText[cursor])) {
    cursor -= 1;
  }

  return sourceText.slice(cursor + 1, tokenEndIndex);
};

/** Finds the previous non-whitespace character index before an expression index. */
const previousSignificantTemplateIndex = (sourceText: string, index: number): number => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!isWhitespaceCharacter(sourceText[cursor] ?? "")) {
      return cursor;
    }
  }

  return -1;
};

/** Finds the start of a comment ending at or before a previous token index. */
const previousTemplateCommentStartIndex = (
  sourceText: string,
  cursor: number,
): number | undefined => {
  if (sourceText[cursor] === "/" && sourceText[cursor - 1] === "*") {
    const blockStartIndex = sourceText.lastIndexOf("/*", cursor - 2);
    return blockStartIndex === -1 ? undefined : blockStartIndex;
  }

  const lineStartIndex = previousTemplateLineStartIndex(sourceText, cursor);
  const lineCommentStartIndex = sourceText.lastIndexOf("//", cursor);
  if (lineCommentStartIndex >= lineStartIndex) {
    return lineCommentStartIndex;
  }

  return undefined;
};

/** Finds the text index immediately after the previous line terminator. */
const previousTemplateLineStartIndex = (sourceText: string, cursor: number): number => {
  for (let index = cursor; index >= 0; index -= 1) {
    if (isLineTerminatorCharacter(sourceText[index] ?? "")) {
      return index + 1;
    }
  }

  return 0;
};

/** Skips a comment inside a template expression. */
const nextTemplateCommentIndex = (
  sourceText: string,
  index: number,
  character: string,
): number | undefined => {
  const nextCharacter = sourceText[index + 1] ?? "";
  return scanCommentRange(sourceText, index, character, nextCharacter)?.endIndex;
};

/** Scans a regex-like literal inside a template expression. */
const scanTemplateRegexEnd = (sourceText: string, startIndex: number): number | undefined => {
  return scanRegexBodyEnd(sourceText, startIndex, { shouldRequireBody: false });
};

/**
 * Checks for the outer template close.
 *
 * @param sourceText - Original source text to scan.
 * @param state - Current template scan state.
 * @returns Whether the current state closes the outer template literal.
 */
export const isTemplateClose = (sourceText: string, state: TemplateScanState): boolean => {
  return state.expressionDepth === 0 && isTemplateDelimiter(sourceText[state.index] ?? "");
};

/**
 * Checks for template interpolation start.
 *
 * @param sourceText - Original source text to scan.
 * @param index - Current UTF-16 source-text index.
 * @returns Whether the current index starts a template expression.
 */
export const isTemplateExpressionOpen = (sourceText: string, index: number): boolean => {
  return sourceText[index] === "$" && sourceText[index + 1] === "{";
};

/**
 * Advances through one ordinary template character.
 *
 * @param sourceText - Original source text to scan.
 * @param state - Current template scan state.
 * @returns Next scan state after one ordinary character.
 */
export const nextOrdinaryTemplateStep = (
  sourceText: string,
  state: TemplateScanState,
): TemplateScanState => {
  if (state.expressionDepth > 0 && sourceText[state.index] === "{") {
    return { expressionDepth: state.expressionDepth + 1, index: state.index + 1 };
  }
  if (state.expressionDepth > 0 && sourceText[state.index] === "}") {
    return { expressionDepth: state.expressionDepth - 1, index: state.index + 1 };
  }

  return { expressionDepth: state.expressionDepth, index: state.index + 1 };
};
