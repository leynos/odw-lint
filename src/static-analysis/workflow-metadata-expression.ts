/** @file Helpers for classifying non-object metadata expressions. */

import type { SourceSpan } from "../diagnostics/types";
import { textIndexAtOffset } from "./source-indexes";
import { maskNonCodeSource } from "./source-mask";
import { isWhitespaceCharacter } from "./source-mask-delimiters";
import { EXPRESSION_LEADING_PREVIOUS_CHARACTERS } from "./source-scanner-primitives";
import type { OriginalSourceFile } from "./types";

const OBJECT_LITERAL_ALLOWED_PREVIOUS_CHARACTERS = new Set([
  ...EXPRESSION_LEADING_PREVIOUS_CHARACTERS,
  // Unlike regex starts, division and regex-close contexts may still be
  // followed by an object-literal expression.
  "/",
]);

/**
 * Checks whether a non-object metadata expression may contain an object literal.
 *
 * @param sourceFile - Original source file owning the expression.
 * @param span - Expression span to inspect in original source coordinates.
 * @returns Whether the expression contains a brace where object literals are
 *   syntactically plausible.
 */
export const expressionContainsObjectLiteralCandidate = (
  sourceFile: OriginalSourceFile,
  span: SourceSpan,
): boolean => {
  const maskedText = maskNonCodeSource(sourceFile).maskedText;
  const startIndex = textIndexAtOffset(sourceFile, span.start.offset);
  const endIndex = textIndexAtOffset(sourceFile, span.end.offset);

  for (let index = startIndex; index < endIndex; index += 1) {
    if (maskedText[index] !== "{") {
      continue;
    }
    if (isObjectLiteralOpening(maskedText, startIndex, index)) {
      return true;
    }
    index = scanMaskedBraceEnd(maskedText, index, endIndex) - 1;
  }

  return false;
};

/** Checks whether a brace appears where JavaScript accepts an expression. */
const isObjectLiteralOpening = (text: string, startIndex: number, braceIndex: number): boolean => {
  const previousIndex = previousNonWhitespaceIndex(text, startIndex, braceIndex);
  if (previousIndex === undefined) {
    return true;
  }
  if (isArrowBodyOpening(text, previousIndex)) {
    return false;
  }
  return OBJECT_LITERAL_ALLOWED_PREVIOUS_CHARACTERS.has(text[previousIndex] ?? "");
};

/** Checks whether a brace opens an arrow-function block body. */
const isArrowBodyOpening = (text: string, previousIndex: number): boolean => {
  return text[previousIndex] === ">" && text[previousIndex - 1] === "=";
};

/** Finds the previous non-whitespace text index in a half-open range. */
const previousNonWhitespaceIndex = (
  text: string,
  startIndex: number,
  endIndex: number,
): number | undefined => {
  for (let index = endIndex - 1; index >= startIndex; index -= 1) {
    if (!isWhitespaceCharacter(text[index] ?? "")) {
      return index;
    }
  }
  return undefined;
};

/** Skips a brace-delimited block in already masked source text. */
const scanMaskedBraceEnd = (text: string, startIndex: number, endIndex: number): number => {
  let depth = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const character = text[index];
    if (character === "{") {
      depth += 1;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return endIndex;
};
