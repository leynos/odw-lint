/** @file Metadata value scanning for static workflow envelopes. */

import type { SourceMaskRange } from "./source-mask-types";
import { spanFromTextIndexes } from "./source-position";
import type { OriginalSourceFile, WorkflowMetaValue } from "./types";
import { topLevelStatementEndIndex } from "./workflow-envelope-statement";
import { scanDelimitedEnd } from "./workflow-metadata-comment-scan";

/**
 * Scans the metadata value state after the assignment operator.
 *
 * @param sourceFile - Original workflow source file.
 * @param maskedText - Source text with inert regions blanked.
 * @param maskedRanges - Ordered inert ranges that produced `maskedText`.
 * @param valueSearchIndex - Text index after the metadata assignment operator.
 * @returns Metadata value state for downstream literal parsing and diagnostics.
 */
export const scanMetaValue = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  maskedRanges: readonly SourceMaskRange[],
  valueSearchIndex: number,
): WorkflowMetaValue => {
  const valueStartIndex = nextMetadataValueIndex(sourceFile.sourceText, valueSearchIndex);
  if (valueStartIndex === undefined) {
    return Object.freeze({
      kind: "missing-value",
      span: spanFromTextIndexes(sourceFile, maskedText.length, maskedText.length),
    });
  }

  if (sourceFile.sourceText[valueStartIndex] === ";") {
    return Object.freeze({
      kind: "missing-value",
      span: spanFromTextIndexes(sourceFile, valueStartIndex, valueStartIndex),
    });
  }

  if (sourceFile.sourceText[valueStartIndex] !== "{") {
    return nonObjectMetaValue(sourceFile, maskedText, valueStartIndex);
  }

  return objectMetaValue(sourceFile, maskedText, maskedRanges, valueStartIndex);
};

/** Builds metadata state for computed or otherwise non-object expressions. */
const nonObjectMetaValue = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  startIndex: number,
): WorkflowMetaValue => {
  const statementEndIndex = topLevelStatementEndIndex(maskedText, startIndex);
  const expressionEndIndex = trimStatementTerminator(
    sourceFile.sourceText,
    startIndex,
    trimTrailingWhitespaceIndex(sourceFile.sourceText, startIndex, statementEndIndex),
  );

  return Object.freeze({
    kind: "non-object-expression",
    expressionStartSpan: spanFromTextIndexes(sourceFile, startIndex, startIndex + 1),
    expressionSpan: spanFromTextIndexes(sourceFile, startIndex, expressionEndIndex),
  });
};

/** Builds metadata state for object literals and unterminated objects. */
const objectMetaValue = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  maskedRanges: readonly SourceMaskRange[],
  startIndex: number,
): WorkflowMetaValue => {
  const closeBraceIndex = matchingBraceIndex(
    sourceFile.sourceText,
    maskedText,
    maskedRanges,
    startIndex,
  );
  if (closeBraceIndex === undefined) {
    return Object.freeze({
      kind: "unterminated-object",
      openBraceSpan: spanFromTextIndexes(sourceFile, startIndex, startIndex + 1),
      span: spanFromTextIndexes(sourceFile, startIndex, maskedText.length),
    });
  }

  return Object.freeze({
    kind: "object",
    span: spanFromTextIndexes(sourceFile, startIndex, closeBraceIndex + 1),
    openBraceSpan: spanFromTextIndexes(sourceFile, startIndex, startIndex + 1),
    closeBraceSpan: spanFromTextIndexes(sourceFile, closeBraceIndex, closeBraceIndex + 1),
  });
};

/** Finds the next metadata value token while keeping comments inert. */
const nextMetadataValueIndex = (text: string, startIndex: number): number | undefined => {
  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (/\s/u.test(character)) {
      continue;
    }
    if (text.startsWith("//", index)) {
      index = scanLineCommentEnd(text, index + 2) - 1;
      continue;
    }
    if (text.startsWith("/*", index)) {
      index = scanBlockCommentEnd(text, index + 2) - 1;
      continue;
    }
    return index;
  }

  return undefined;
};

/** Finds the end of a line comment from the first character after `//`. */
const scanLineCommentEnd = (text: string, startIndex: number): number => {
  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (isLineTerminator(character)) {
      return index;
    }
  }
  return text.length;
};

/** Checks for JavaScript line terminators. */
const isLineTerminator = (character: string): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

/** Finds the end of a block comment from the first character after `/*`. */
const scanBlockCommentEnd = (text: string, startIndex: number): number => {
  const terminatorIndex = text.indexOf("*/", startIndex);
  return terminatorIndex === -1 ? text.length : terminatorIndex + 2;
};

/** Finds a matching `}` for an object that starts at `startIndex`. */
const matchingBraceIndex = (
  sourceText: string,
  maskedText: string,
  maskedRanges: readonly SourceMaskRange[],
  startIndex: number,
): number | undefined => {
  let depth = 0;
  let rangeIndex = nextRangeIndex(maskedRanges, startIndex);

  for (let index = startIndex; index < maskedText.length; index += 1) {
    rangeIndex = nextRangeIndexAtOrAfter(maskedRanges, rangeIndex, index);
    const skippedEndIndex = skippedRangeEndIndex(
      sourceText,
      maskedRanges[rangeIndex],
      index,
      maskedText.length,
    );
    if (skippedEndIndex !== undefined) {
      index = skippedEndIndex - 1;
      rangeIndex += 1;
      continue;
    }

    const character = sourceText[index];
    depth = nextObjectDepth(depth, character);
    if (depth === 0 && character === "}") {
      return index;
    }
  }

  return undefined;
};

/** Finds the first source-mask range that can affect a metadata object scan. */
const nextRangeIndex = (ranges: readonly SourceMaskRange[], startIndex: number): number => {
  const rangeIndex = ranges.findIndex((range) => range.endIndex > startIndex);
  return rangeIndex === -1 ? ranges.length : rangeIndex;
};

/** Advances past mask ranges already covered by a wider metadata string scan. */
const nextRangeIndexAtOrAfter = (
  ranges: readonly SourceMaskRange[],
  rangeIndex: number,
  sourceIndex: number,
): number => {
  let nextIndex = rangeIndex;
  while (ranges[nextIndex] !== undefined && (ranges[nextIndex]?.startIndex ?? 0) < sourceIndex) {
    nextIndex += 1;
  }
  return nextIndex;
};

/** Returns the end index to skip when the current index starts an inert range. */
const skippedRangeEndIndex = (
  sourceText: string,
  range: SourceMaskRange | undefined,
  sourceIndex: number,
  endIndex: number,
): number | undefined => {
  if (range === undefined || range.startIndex !== sourceIndex) {
    return undefined;
  }
  return endIndexForMatchedRange(sourceText, range, endIndex);
};

/** Chooses how far the object matcher should skip one masked inert range. */
const endIndexForMatchedRange = (
  sourceText: string,
  range: SourceMaskRange,
  endIndex: number,
): number => {
  if (range.kind === "string" || range.kind === "template") {
    return scanDelimitedEnd(
      sourceText,
      range.startIndex,
      sourceText[range.startIndex] ?? "",
      endIndex,
    );
  }
  return range.endIndex;
};

/** Applies one source character to the metadata-object brace depth. */
const nextObjectDepth = (depth: number, character: string | undefined): number => {
  if (character === "{") {
    return depth + 1;
  }
  if (character === "}") {
    return depth - 1;
  }
  return depth;
};

/** Removes trailing whitespace from an expression span without crossing start. */
const trimTrailingWhitespaceIndex = (
  text: string,
  startIndex: number,
  endIndex: number,
): number => {
  let trimmedEndIndex = endIndex;
  while (trimmedEndIndex > startIndex && /\s/u.test(text[trimmedEndIndex - 1] ?? "")) {
    trimmedEndIndex -= 1;
  }
  return trimmedEndIndex;
};

/** Removes a trailing statement terminator from a metadata expression span. */
const trimStatementTerminator = (text: string, startIndex: number, endIndex: number): number => {
  if (endIndex <= startIndex) {
    return endIndex;
  }

  return text[endIndex - 1] === ";" ? endIndex - 1 : endIndex;
};
