/** @file Low-level scanners for static metadata literal parsing. */

import {
  scanBlockCommentEnd,
  scanDelimitedEnd,
  scanLineCommentEnd,
} from "./workflow-metadata-comment-scan";
import type { ParserCursor } from "./workflow-metadata-parser";

/** Keyword value table for primitive metadata literals. */
const KEYWORD_VALUES = {
  false: false,
  null: null,
  true: true,
} as const;
const NUMBER_LITERAL_PATTERN =
  /^-?(?:0[xX][\da-fA-F](?:_?[\da-fA-F])*|0[bB][01](?:_?[01])*|0[oO][0-7](?:_?[0-7])*|\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?)/u;

type ExpressionDepth = {
  readonly brace: number;
  readonly bracket: number;
  readonly paren: number;
};

/**
 * Scans a primitive keyword value from the current cursor.
 *
 * @param cursor - Parser cursor positioned at a possible keyword.
 * @returns The parsed primitive, or `undefined` when no keyword is present.
 */
export const scanKeyword = (cursor: ParserCursor): boolean | null | undefined => {
  for (const keyword of Object.keys(KEYWORD_VALUES) as (keyof typeof KEYWORD_VALUES)[]) {
    if (isStandaloneKeywordAt(cursor, keyword)) {
      cursor.index += keyword.length;
      return KEYWORD_VALUES[keyword];
    }
  }
  return undefined;
};

/**
 * Skips whitespace and comments before the next parser token.
 *
 * @param cursor - Parser cursor to advance in place.
 */
export const skipTrivia = (cursor: ParserCursor): void => {
  while (cursor.index < cursor.endIndex) {
    if (/\s/u.test(currentCharacter(cursor))) {
      cursor.index += 1;
      continue;
    }
    const commentEndIndex = scanCommentEnd(cursor.text, cursor.index, cursor.endIndex);
    if (commentEndIndex !== undefined) {
      cursor.index = commentEndIndex;
      continue;
    }
    return;
  }
};

/**
 * Scans an expression until a top-level terminator is reached.
 *
 * @param cursor - Parser cursor positioned at the expression start.
 * @param terminators - Top-level characters that terminate the expression.
 * @returns The exclusive text index for the scanned expression.
 */
export const scanExpressionEnd = (cursor: ParserCursor, terminators: readonly string[]): number => {
  let depth: ExpressionDepth = { brace: 0, bracket: 0, paren: 0 };
  let index = cursor.index;
  while (index < cursor.endIndex) {
    const character = cursor.text[index] ?? "";
    if (isStringDelimiter(character)) {
      index = scanDelimitedEnd(cursor.text, index, character, cursor.endIndex);
      continue;
    }
    const commentEndIndex = scanCommentEnd(cursor.text, index, cursor.endIndex);
    if (commentEndIndex !== undefined) {
      index = commentEndIndex;
      continue;
    }
    if (isExpressionTerminator(character, terminators, depth)) {
      return trimTrailingTriviaIndex(cursor.text, cursor.index, index);
    }
    depth = nextExpressionDepth(depth, character);
    index += 1;
  }
  return trimTrailingTriviaIndex(cursor.text, cursor.index, index);
};

/**
 * Scans a balanced bracketed expression from the current cursor.
 *
 * @param cursor - Parser cursor positioned at the opening delimiter.
 * @param open - Opening delimiter to count.
 * @param close - Closing delimiter to match.
 * @returns The exclusive text index for the balanced expression.
 */
export const scanBalancedEnd = (
  cursor: ParserCursor,
  open: "[" | "{" | "(",
  close: "]" | "}" | ")",
): number => {
  let depth = 0;
  for (let index = cursor.index; index < cursor.endIndex; index += 1) {
    const character = cursor.text[index] ?? "";
    const commentEndIndex = scanCommentEnd(cursor.text, index, cursor.endIndex);
    if (commentEndIndex !== undefined) {
      index = commentEndIndex - 1;
      continue;
    }
    if (isStringDelimiter(character)) {
      index = scanDelimitedEnd(cursor.text, index, character, cursor.endIndex) - 1;
      continue;
    }
    if (character === open) {
      depth += 1;
    }
    if (character === close) {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return cursor.endIndex;
};

/**
 * Scans a JavaScript-like numeric literal token.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive text index where the number starts.
 * @param endIndex - Exclusive maximum text index for the scan.
 * @returns The exclusive text index where the number token ends.
 */
export const scanNumberEnd = (text: string, startIndex: number, endIndex: number): number => {
  const sourceText = text.slice(startIndex, endIndex);
  const match = NUMBER_LITERAL_PATTERN.exec(sourceText);
  if (match === null) {
    return startIndex;
  }
  return startIndex + match[0].length;
};

/**
 * Returns the current source character, or an empty string at EOF.
 *
 * @param cursor - Parser cursor whose current character should be read.
 * @returns The current character, or `""` when the cursor is past EOF.
 */
export const currentCharacter = (cursor: ParserCursor): string => {
  return cursor.text[cursor.index] ?? "";
};

/**
 * Checks whether a character can start an identifier key.
 *
 * @param character - Character to test.
 * @returns `true` when the character can start an identifier.
 */
export const isIdentifierStart = (character: string): boolean => {
  return /[$_\p{ID_Start}]/u.test(character);
};

/**
 * Checks whether a character can continue an identifier key.
 *
 * @param character - Character to test.
 * @returns `true` when the character can continue an identifier.
 */
export const isIdentifierPart = (character: string | undefined): boolean => {
  return (
    character !== undefined &&
    (character === "$" ||
      character === "_" ||
      character === "\u200c" ||
      character === "\u200d" ||
      /\p{ID_Continue}/u.test(character))
  );
};

/**
 * Checks whether a character can start a number literal.
 *
 * @param character - Character to test.
 * @returns `true` when the character can start a number.
 */
export const isNumberStart = (character: string): boolean => {
  return /[0-9-]/u.test(character);
};

/**
 * Checks whether a character ends an object property.
 *
 * @param character - Character to test.
 * @returns `true` when the character ends an object property.
 */
export const isPropertyTerminator = (character: string): boolean => {
  return character === "," || character === "}";
};

/**
 * Checks whether a character ends an array item.
 *
 * @param character - Character to test.
 * @returns `true` when the character ends an array item.
 */
export const isArrayTerminator = (character: string): boolean => {
  return character === "," || character === "]";
};

/** Removes trivia from the end of a scanned expression range. */
const trimTrailingTriviaIndex = (text: string, startIndex: number, endIndex: number): number => {
  let trimmedEndIndex = endIndex;
  while (trimmedEndIndex > startIndex && /\s/u.test(text[trimmedEndIndex - 1] ?? "")) {
    trimmedEndIndex -= 1;
  }
  return trimmedEndIndex;
};

/** Checks that a primitive keyword is not a prefix of an identifier. */
const isStandaloneKeywordAt = (
  cursor: ParserCursor,
  keyword: "true" | "false" | "null",
): boolean => {
  if (!cursor.text.startsWith(keyword, cursor.index)) {
    return false;
  }
  return !isIdentifierPart(cursor.text[cursor.index + keyword.length]);
};

/** Checks whether a top-level expression terminator has been reached. */
const isExpressionTerminator = (
  character: string,
  terminators: readonly string[],
  depth: ExpressionDepth,
): boolean => {
  if (hasOpenExpressionDepth(depth)) {
    return false;
  }
  return terminators.includes(character);
};

/** Checks whether any nested expression depth is still open. */
const hasOpenExpressionDepth = (depth: ExpressionDepth): boolean => {
  return depth.paren !== 0 || depth.brace !== 0 || depth.bracket !== 0;
};

/** Updates nested expression depth for one source character. */
const nextExpressionDepth = (depth: ExpressionDepth, character: string): ExpressionDepth => {
  if (character === "(") {
    return { ...depth, paren: depth.paren + 1 };
  }
  if (character === "{") {
    return { ...depth, brace: depth.brace + 1 };
  }
  if (character === "[") {
    return { ...depth, bracket: depth.bracket + 1 };
  }
  if (character === ")") {
    return { ...depth, paren: Math.max(0, depth.paren - 1) };
  }
  if (character === "}") {
    return { ...depth, brace: Math.max(0, depth.brace - 1) };
  }
  if (character === "]") {
    return { ...depth, bracket: Math.max(0, depth.bracket - 1) };
  }
  return depth;
};

/** Checks for any supported string delimiter. */
const isStringDelimiter = (character: string): character is "'" | '"' | "`" => {
  return character === "'" || character === '"' || character === "`";
};

/** Scans a comment from the current index when present. */
const scanCommentEnd = (text: string, startIndex: number, endIndex: number): number | undefined => {
  if (text.startsWith("//", startIndex)) {
    return scanLineCommentEnd(text, startIndex + 2, endIndex);
  }
  if (text.startsWith("/*", startIndex)) {
    return scanBlockCommentEnd(text, startIndex + 2, endIndex);
  }
  return undefined;
};
