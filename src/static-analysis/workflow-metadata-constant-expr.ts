/** @file Structural closed-constant checks for impure metadata spans. */

import type { SourceSpan } from "../diagnostics/types";
import { textIndexAtOffset } from "./source-indexes";
import { isStringLikeDelimiter } from "./source-scanner-primitives";
import type { OriginalSourceFile } from "./types";
import {
  type BinaryOperator,
  type ConstantParseResult,
  closed,
  closedUnaryResult,
  isArrayElisionOrSpread,
  isInvalidExponentiation,
  isNumberBinary,
  isNumberUnaryOperator,
  isOpenResult,
  isStringConcatenation,
  openResult,
} from "./workflow-metadata-constant-results";
import type { ParserCursor } from "./workflow-metadata-parser";
import { parseNumericLiteral } from "./workflow-metadata-parser-results";
import {
  currentCharacter,
  isNumberStart,
  scanIdentifierEnd,
  scanKeyword,
  scanNumberEnd,
  skipTrivia,
} from "./workflow-metadata-parser-scan";
import { scanStringLiteral } from "./workflow-metadata-string-scan";

type ConstantCursor = ParserCursor;

const BINARY_PRECEDENCE = new Map<BinaryOperator, number>([
  ["**", 5],
  ["*", 4],
  ["/", 4],
  ["%", 4],
  ["+", 3],
  ["-", 3],
] as const);

const RIGHT_ASSOCIATIVE_OPERATORS = new Set<BinaryOperator>(["**"]);
const LEFT_ASSOCIATIVE_BINARY_OPERATORS = new Set<BinaryOperator>(["+", "-", "*", "/", "%"]);

/**
 * Checks whether a recorded impure metadata span is self-contained and total.
 *
 * @param sourceFile - Original source file owning the span.
 * @param span - Source span for the impure expression or computed key.
 * @returns Whether the expression is provably closed-constant without
 *   evaluating source.
 */
export const isClosedConstantSpan = (sourceFile: OriginalSourceFile, span: SourceSpan): boolean => {
  const cursor: ConstantCursor = {
    file: sourceFile,
    text: sourceFile.sourceText,
    index: textIndexAtOffset(sourceFile, span.start.offset),
    endIndex: textIndexAtOffset(sourceFile, span.end.offset),
  };

  skipTrivia(cursor);
  const result = parseExpression(cursor, 0);
  if (result.status === "open") {
    return false;
  }
  skipTrivia(cursor);
  return cursor.index === cursor.endIndex;
};

/** Parses one expression using the accepted closed-constant operator subset. */
const parseExpression = (
  cursor: ConstantCursor,
  minimumPrecedence: number,
): ConstantParseResult => {
  let left = parseUnaryExpression(cursor);
  if (left.status === "open") {
    return left;
  }

  while (true) {
    skipTrivia(cursor);
    const operator = readBinaryOperator(cursor);
    if (operator === undefined) {
      return left;
    }
    const precedence = BINARY_PRECEDENCE.get(operator) ?? 0;
    if (precedence < minimumPrecedence) {
      return left;
    }

    cursor.index += operator.length;
    const rightMinimum = RIGHT_ASSOCIATIVE_OPERATORS.has(operator) ? precedence : precedence + 1;
    const right = parseExpression(cursor, rightMinimum);
    left = binaryResult(operator, left, right);
    if (left.status === "open") {
      return left;
    }
  }
};

/** Parses unary operators whose operand type is known without evaluation. */
const parseUnaryExpression = (cursor: ConstantCursor): ConstantParseResult => {
  skipTrivia(cursor);
  const operator = currentCharacter(cursor);
  if (isNumberUnaryOperator(operator)) {
    cursor.index += 1;
    const operand = parseUnaryExpression(cursor);
    return closedUnaryResult(operand, "number");
  }
  if (operator === "!") {
    cursor.index += 1;
    const operand = parseUnaryExpression(cursor);
    return closedUnaryResult(operand, "boolean");
  }
  return parsePrimaryExpression(cursor);
};

/** Parses primary values and literals in the closed-constant subset. */
const parsePrimaryExpression = (cursor: ConstantCursor): ConstantParseResult => {
  skipTrivia(cursor);
  const character = currentCharacter(cursor);
  if (character === "(") {
    return parseParenthesizedExpression(cursor);
  }
  if (character === "[") {
    return parseArrayExpression(cursor);
  }
  if (character === "{") {
    return parseObjectExpression(cursor);
  }
  if (isStringLikeDelimiter(character)) {
    return parseStringAtom(cursor);
  }
  if (isNumberStart(character)) {
    return parseNumberAtom(cursor);
  }

  const keyword = scanKeyword(cursor);
  if (keyword !== undefined) {
    return keyword === null ? closed("null") : closed("boolean");
  }
  return openResult();
};

/** Parses a parenthesized closed-constant expression. */
const parseParenthesizedExpression = (cursor: ConstantCursor): ConstantParseResult => {
  cursor.index += 1;
  const result = parseExpression(cursor, 0);
  if (result.status === "open") {
    return result;
  }
  skipTrivia(cursor);
  if (currentCharacter(cursor) !== ")") {
    return openResult();
  }
  cursor.index += 1;
  return result;
};

/** Parses a closed array literal with no elisions or spread elements. */
const parseArrayExpression = (cursor: ConstantCursor): ConstantParseResult => {
  cursor.index += 1;
  skipTrivia(cursor);
  if (currentCharacter(cursor) === "]") {
    cursor.index += 1;
    return closed("array");
  }
  return parseArrayItems(cursor);
};

/** Parses array items after the opening delimiter has been consumed. */
const parseArrayItems = (cursor: ConstantCursor): ConstantParseResult => {
  while (cursor.index < cursor.endIndex) {
    if (
      isArrayElisionOrSpread(currentCharacter(cursor), cursor.text.startsWith("...", cursor.index))
    ) {
      return openResult();
    }
    const item = parseExpression(cursor, 0);
    if (item.status === "open") {
      return item;
    }
    skipTrivia(cursor);
    if (currentCharacter(cursor) === "]") {
      cursor.index += 1;
      return closed("array");
    }
    if (currentCharacter(cursor) !== ",") {
      return openResult();
    }
    cursor.index += 1;
    skipTrivia(cursor);
    if (currentCharacter(cursor) === "]") {
      cursor.index += 1;
      return closed("array");
    }
  }
  return openResult();
};

/** Parses a closed object literal with literal or closed computed keys. */
const parseObjectExpression = (cursor: ConstantCursor): ConstantParseResult => {
  cursor.index += 1;
  skipTrivia(cursor);
  return parseObjectProperties(cursor);
};

/** Parses object properties after the opening delimiter has been consumed. */
const parseObjectProperties = (cursor: ConstantCursor): ConstantParseResult => {
  while (cursor.index < cursor.endIndex) {
    if (currentCharacter(cursor) === "}") {
      cursor.index += 1;
      return closed("object");
    }
    if (!parseObjectProperty(cursor)) {
      return openResult();
    }
    const separator = parseObjectPropertySeparator(cursor);
    if (separator === "closed") {
      return closed("object");
    }
    if (separator === "open") {
      return openResult();
    }
  }
  return openResult();
};

/** Parses one object property in the closed-constant subset. */
const parseObjectProperty = (cursor: ConstantCursor): boolean => {
  if (cursor.text.startsWith("...", cursor.index) || !parseObjectKey(cursor)) {
    return false;
  }
  skipTrivia(cursor);
  if (currentCharacter(cursor) !== ":") {
    return false;
  }
  cursor.index += 1;
  return parseExpression(cursor, 0).status === "closed";
};

/** Parses the delimiter after one closed object property. */
const parseObjectPropertySeparator = (cursor: ConstantCursor): "closed" | "continue" | "open" => {
  skipTrivia(cursor);
  if (currentCharacter(cursor) === "}") {
    cursor.index += 1;
    return "closed";
  }
  if (currentCharacter(cursor) !== ",") {
    return "open";
  }
  cursor.index += 1;
  skipTrivia(cursor);
  return "continue";
};

/** Parses a literal or computed object key in a closed object expression. */
const parseObjectKey = (cursor: ConstantCursor): boolean => {
  skipTrivia(cursor);
  const character = currentCharacter(cursor);
  if (character === "[") {
    cursor.index += 1;
    const key = parseExpression(cursor, 0);
    if (key.status === "open") {
      return false;
    }
    skipTrivia(cursor);
    if (currentCharacter(cursor) !== "]") {
      return false;
    }
    cursor.index += 1;
    return true;
  }
  if (isStringLikeDelimiter(character)) {
    return parseStringAtom(cursor).status === "closed";
  }
  if (isNumberStart(character)) {
    return parseNumberAtom(cursor).status === "closed";
  }
  const identifierEndIndex = scanIdentifierEnd(cursor);
  if (identifierEndIndex === undefined) {
    return false;
  }
  cursor.index = identifierEndIndex;
  return true;
};

/** Parses a parser-accepted string or no-interpolation template literal. */
const parseStringAtom = (cursor: ConstantCursor): ConstantParseResult => {
  const delimiter = currentCharacter(cursor);
  if (!isStringLikeDelimiter(delimiter)) {
    return openResult();
  }
  const result = scanStringLiteral(cursor, delimiter);
  return result === undefined ? openResult() : closed("string");
};

/** Parses a number literal and rejects partial tokens such as BigInt suffixes. */
const parseNumberAtom = (cursor: ConstantCursor): ConstantParseResult => {
  const startIndex = cursor.index;
  const endIndex = scanNumberEnd(cursor.text, startIndex, cursor.endIndex);
  if (endIndex === startIndex) {
    return openResult();
  }
  const numericText = cursor.text.slice(startIndex, endIndex);
  if (Number.isNaN(parseNumericLiteral(numericText))) {
    return openResult();
  }
  cursor.index = endIndex;
  return closed("number");
};

/** Reads a binary operator token, avoiding prefixes of unsupported operators. */
const readBinaryOperator = (cursor: ConstantCursor): BinaryOperator | undefined => {
  if (cursor.text.startsWith("**", cursor.index)) {
    return cursor.text.startsWith("**=", cursor.index) ? undefined : "**";
  }
  const operator = currentCharacter(cursor) as BinaryOperator;
  if (LEFT_ASSOCIATIVE_BINARY_OPERATORS.has(operator) && cursor.text[cursor.index + 1] !== "=") {
    return operator;
  }
  return undefined;
};

/** Derives the kind produced by an accepted binary operation. */
const binaryResult = (
  operator: BinaryOperator,
  left: ConstantParseResult,
  right: ConstantParseResult,
): ConstantParseResult => {
  if (isOpenResult(left) || isOpenResult(right)) {
    return openResult();
  }
  if (isStringConcatenation(operator, left, right)) {
    return closed("string");
  }
  if (isInvalidExponentiation(operator, left)) {
    return openResult();
  }
  if (isNumberBinary(left, right)) {
    return closed("number");
  }
  return openResult();
};
