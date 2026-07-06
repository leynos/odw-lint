/** @file Result helpers for closed-constant metadata expression parsing. */

export type ConstantValueKind = "array" | "boolean" | "null" | "number" | "object" | "string";
export type BinaryOperator = "/" | "*" | "+" | "-" | "%" | "**";

export type ConstantParseResult = {
  readonly status: "closed" | "open";
  readonly kind?: ConstantValueKind;
  readonly isUnaryExpression?: boolean;
};

/**
 * Builds a closed parse result for a known expression kind.
 *
 * @param kind - Expression kind proven by structural parsing.
 * @param options - Extra result flags for grammar-sensitive operators.
 * @returns Frozen closed parse result.
 */
export const closed = (
  kind: ConstantValueKind,
  options: { readonly isUnaryExpression?: boolean } = {},
): ConstantParseResult => {
  return Object.freeze({
    status: "closed",
    kind,
    ...(options.isUnaryExpression === true ? { isUnaryExpression: true } : {}),
  });
};

/**
 * Builds the default-open result for anything outside the allow-list.
 *
 * @returns Frozen open parse result.
 */
export const openResult = (): ConstantParseResult => {
  return Object.freeze({ status: "open" });
};

/**
 * Returns a typed unary expression result when the operand kind is accepted.
 *
 * @param operand - Parsed operand result.
 * @param expectedKind - Primitive kind required by the unary operator.
 * @returns Closed unary result, or open when the operand kind is unsupported.
 */
export const closedUnaryResult = (
  operand: ConstantParseResult,
  expectedKind: "boolean" | "number",
): ConstantParseResult => {
  return isClosedKind(operand, expectedKind)
    ? closed(expectedKind, { isUnaryExpression: true })
    : openResult();
};

/**
 * Checks whether an operator requires a closed number operand.
 *
 * @param operator - Operator token to classify.
 * @returns Whether the operator is `+`, `-`, or `~`.
 */
export const isNumberUnaryOperator = (operator: string): boolean => {
  return operator === "+" || operator === "-" || operator === "~";
};

/**
 * Checks for array syntax that is not total under the allow-list.
 *
 * @param character - Current source character.
 * @param startsWithSpread - Whether the cursor starts with `...`.
 * @returns Whether the current array item is an elision or spread.
 */
export const isArrayElisionOrSpread = (character: string, startsWithSpread: boolean): boolean => {
  return character === "," || startsWithSpread;
};

/**
 * Checks whether a sub-expression already left the closed subset.
 *
 * @param result - Parse result to inspect.
 * @returns Whether the result is open.
 */
export const isOpenResult = (result: ConstantParseResult): boolean => {
  return result.status === "open";
};

/**
 * Checks whether a binary operation is accepted string concatenation.
 *
 * @param operator - Binary operator token.
 * @param left - Left operand result.
 * @param right - Right operand result.
 * @returns Whether the operation is string `+` over two strings.
 */
export const isStringConcatenation = (
  operator: BinaryOperator,
  left: ConstantParseResult,
  right: ConstantParseResult,
): boolean => {
  return operator === "+" && left.kind === "string" && right.kind === "string";
};

/**
 * Checks whether exponentiation would be invalid JavaScript syntax.
 *
 * @param operator - Binary operator token.
 * @param left - Left operand result.
 * @returns Whether `**` follows a unary expression.
 */
export const isInvalidExponentiation = (
  operator: BinaryOperator,
  left: ConstantParseResult,
): boolean => {
  return operator === "**" && left.isUnaryExpression === true;
};

/**
 * Checks whether a binary operation is accepted number arithmetic.
 *
 * @param left - Left operand result.
 * @param right - Right operand result.
 * @returns Whether both operands are numbers.
 */
export const isNumberBinary = (left: ConstantParseResult, right: ConstantParseResult): boolean => {
  return left.kind === "number" && right.kind === "number";
};

/** Checks whether a parse result is closed with the expected primitive kind. */
const isClosedKind = (result: ConstantParseResult, expectedKind: "boolean" | "number"): boolean => {
  return result.status === "closed" && result.kind === expectedKind;
};
