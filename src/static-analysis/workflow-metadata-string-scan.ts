/** @file String literal scanner for static metadata parsing. */

import { isLineTerminator, scanDelimitedEnd } from "./workflow-metadata-comment-scan";
import type { ParserCursor } from "./workflow-metadata-parser";

const SIMPLE_ESCAPES = {
  '"': '"',
  "'": "'",
  "\\": "\\",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
} as const;

/**
 * Scans a static string or no-interpolation template literal.
 *
 * @param cursor - Parser cursor positioned at the opening delimiter.
 * @param delimiter - Opening string delimiter.
 * @returns The literal value, or `undefined` when the string is unprovable.
 */
export const scanStringLiteral = (
  cursor: ParserCursor,
  delimiter: "'" | '"' | "`",
): { readonly value: string } | undefined => {
  const literalStartIndex = cursor.index;
  cursor.index += 1;
  let value = "";
  while (cursor.index < cursor.endIndex) {
    const character = cursor.text[cursor.index] ?? "";
    if (character === delimiter) {
      cursor.index += 1;
      return Object.freeze({ value });
    }
    if (isUnprovableStringBoundary(cursor, delimiter, character)) {
      cursor.index = scanDelimitedEnd(cursor.text, literalStartIndex, delimiter, cursor.endIndex);
      return undefined;
    }
    if (character === "\\") {
      const escapeResult = scanStringEscape(cursor, literalStartIndex, delimiter);
      if (escapeResult === undefined) {
        return undefined;
      }
      value += escapeResult;
      continue;
    }
    value += character;
    cursor.index += 1;
  }

  return undefined;
};

/** Checks for string boundaries that make the literal unprovable. */
const isUnprovableStringBoundary = (
  cursor: ParserCursor,
  delimiter: "'" | '"' | "`",
  character: string,
): boolean => {
  if (delimiter === "`") {
    return character === "$" && cursor.text[cursor.index + 1] === "{";
  }
  return isLineTerminator(character);
};

/** Scans one string escape or line continuation. */
const scanStringEscape = (
  cursor: ParserCursor,
  literalStartIndex: number,
  delimiter: "'" | '"' | "`",
): string | undefined => {
  const escapeIndex = cursor.index + 1;
  if (escapeIndex >= cursor.endIndex) {
    cursor.index = cursor.endIndex;
    return undefined;
  }

  const continuationEndIndex = scanLineContinuationEnd(cursor.text, escapeIndex, cursor.endIndex);
  if (continuationEndIndex !== undefined) {
    cursor.index = continuationEndIndex;
    return "";
  }

  const escaped = decodedSimpleEscape(cursor.text[escapeIndex]);
  if (escaped === undefined) {
    cursor.index = scanDelimitedEnd(cursor.text, literalStartIndex, delimiter, cursor.endIndex);
    return undefined;
  }
  cursor.index += 2;
  return escaped;
};

/** Scans a string line continuation after a backslash. */
const scanLineContinuationEnd = (
  text: string,
  startIndex: number,
  endIndex: number,
): number | undefined => {
  const character = text[startIndex];
  if (isCrLfContinuation(text, startIndex, endIndex)) {
    return startIndex + 2;
  }
  if (character !== undefined && isLineTerminator(character)) {
    return startIndex + 1;
  }
  return undefined;
};

/** Checks for a CRLF string line continuation. */
const isCrLfContinuation = (text: string, startIndex: number, endIndex: number): boolean => {
  if (text[startIndex] !== "\r") {
    return false;
  }
  if (startIndex + 1 >= endIndex) {
    return false;
  }
  return text[startIndex + 1] === "\n";
};

/** Decodes supported simple string escapes and rejects computed escape forms. */
const decodedSimpleEscape = (character: string | undefined): string | undefined => {
  if (character === undefined || isComputedEscapeStart(character)) {
    return undefined;
  }
  if (character in SIMPLE_ESCAPES) {
    return SIMPLE_ESCAPES[character as keyof typeof SIMPLE_ESCAPES];
  }
  return character;
};

/** Checks for escape forms that require JavaScript-level decoding. */
const isComputedEscapeStart = (character: string): boolean => {
  return character === "u" || character === "x" || /[0-9]/u.test(character);
};
