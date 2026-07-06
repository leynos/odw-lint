/**
 * @file Template literal range scanning for source masking.
 *
 * ODW envelope scanning treats whole template literals as inert, including
 * interpolation code, so this module owns nested template scan state.
 */

import { isAsciiIdentifierStartCharacter } from "./javascript-identifiers";
import { createMaskedRange, isWhitespaceCharacter } from "./source-mask-delimiters";
import { isRegexAllowedAfter, scanRegexBodyEnd } from "./source-mask-regex";
import type { SourceMaskRange } from "./source-mask-types";
import {
  asciiIdentifierRunStart,
  compactOperatorTokenEndingAt,
  indexAfterEscapedUnit,
  isRegexDelimiter,
  isSourceLineTerminator,
  isTemplateDelimiter,
  nextInertRegionEnd,
  scanBalancedExpressionEnd,
  scanDelimitedRegionEnd,
} from "./source-scanner-primitives";

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
  return scanDelimitedRegionEnd(sourceText, startIndex, "`", {
    allowTemplateInterpolation: true,
    nextTemplateExpressionEnd: scanTemplateExpressionEnd,
  });
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

  return nextTemplateExpressionInertRegionEnd(sourceText, index, sourceText.length);
};

/** Skips an escaped character in template text. */
const nextEscapedTemplateIndex = (sourceText: string, index: number): number | undefined => {
  if (sourceText[index] === "\\") {
    return indexAfterEscapedUnit(sourceText, index);
  }

  return undefined;
};

/** Skips inert tokens inside a template expression. */
const scanTemplateExpressionEnd = (
  sourceText: string,
  startIndex: number,
  endIndex: number,
): number => {
  return scanBalancedExpressionEnd(sourceText, startIndex, endIndex, {
    open: "{",
    close: "}",
    initiallyOpen: true,
    nextInertRegionEnd: nextTemplateExpressionInertRegionEnd,
  });
};

/** Skips inert tokens inside a template expression. */
const nextTemplateExpressionInertRegionEnd = (
  sourceText: string,
  index: number,
  endIndex: number,
): number | undefined => {
  const character = sourceText[index] ?? "";
  if (isTemplateRegexStart(sourceText, index, character)) {
    return scanTemplateRegexEnd(sourceText, index);
  }
  if (isTemplateDelimiter(character)) {
    return scanTemplateEnd(sourceText, index);
  }

  return nextInertRegionEnd(sourceText, index, endIndex);
};

/** Checks the local preceding-token regex heuristic. */
const isTemplateRegexStart = (sourceText: string, index: number, character: string): boolean => {
  if (!isRegexDelimiter(character)) {
    return false;
  }

  const previousToken = previousSignificantTemplateToken(sourceText, index);
  const previousCharacter = previousToken.at(-1) ?? "";

  return isRegexAllowedAfter(previousCharacter, previousToken);
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
    return compactOperatorTokenEndingAt(sourceText, cursor);
  }

  const tokenEndIndex = cursor + 1;
  const tokenStartIndex = asciiIdentifierRunStart(sourceText, tokenEndIndex);

  return sourceText.slice(tokenStartIndex, tokenEndIndex);
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
    if (isSourceLineTerminator(sourceText[index] ?? "")) {
      return index + 1;
    }
  }

  return 0;
};

/** Scans a regex-like literal inside a template expression. */
const scanTemplateRegexEnd = (sourceText: string, startIndex: number): number | undefined => {
  return scanRegexBodyEnd(sourceText, startIndex, { shouldRequireBody: false });
};
