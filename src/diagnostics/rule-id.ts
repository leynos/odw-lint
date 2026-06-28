/**
 * @file Rule identifier parsing and trusted construction helpers.
 *
 * The module keeps rule identifiers branded so diagnostic contracts cannot
 * accidentally mix arbitrary strings with documented ODW lint rule IDs.
 */

/**
 * Unique marker that prevents arbitrary strings from being used as rule IDs.
 */
declare const ruleIdBrand: unique symbol;

/**
 * Stable ODW lint rule identifier.
 */
export type RuleId = string & { readonly [ruleIdBrand]: true };

/**
 * Programmatic reason for a rejected rule identifier.
 */
export type InvalidRuleIdReason =
  | "empty"
  | "missing-namespace"
  | "wrong-namespace"
  | "invalid-name";

/**
 * Structured error detail for a rejected rule identifier.
 */
export type InvalidRuleId = {
  /** Machine-readable error kind. */
  readonly kind: "invalid-rule-id";
  /** Programmatic rejection reason. */
  readonly reason: InvalidRuleIdReason;
  /** Original invalid value. */
  readonly value: string;
  /** Human-readable diagnostic message. */
  readonly message: string;
};

/**
 * Discriminated parse result for a rule identifier boundary.
 */
export type RuleIdParseResult =
  | { readonly ok: true; readonly value: RuleId }
  | { readonly ok: false; readonly error: InvalidRuleId };

/**
 * Error thrown by trusted rule-id construction when the value is invalid.
 */
export class InvalidRuleIdError extends Error {
  /**
   * Structured detail matching `parseRuleId`'s invalid result.
   */
  readonly detail: InvalidRuleId;

  /**
   * Builds an exception that preserves the recoverable parse detail.
   *
   * @param detail Structured parse failure detail.
   */
  constructor(detail: InvalidRuleId) {
    super(detail.message);
    this.name = "InvalidRuleIdError";
    this.detail = detail;
  }
}

/**
 * Rule-id namespace prefix owned by this package.
 */
const RULE_ID_NAMESPACE = "odw";

/**
 * Complete rule-id grammar accepted by public rule-id helpers.
 */
const RULE_ID_PATTERN = /^odw\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Converts a validated string into a branded rule identifier. */
const brandRuleId = (value: string): RuleId => {
  return value as RuleId;
};

/** Builds structured invalid rule-id detail. */
const invalidRuleId = (value: string, reason: InvalidRuleIdReason): InvalidRuleId => {
  return {
    kind: "invalid-rule-id",
    reason,
    value,
    message: `Invalid rule identifier "${value}": ${describeInvalidRuleId(reason)}.`,
  };
};

/** Explains a programmatic rule-id rejection reason. */
const describeInvalidRuleId = (reason: InvalidRuleIdReason): string => {
  switch (reason) {
    case "empty":
      return "rule identifiers must not be empty";
    case "missing-namespace":
      return 'rule identifiers must use the "odw/" namespace';
    case "wrong-namespace":
      return 'rule identifiers must start with "odw/"';
    case "invalid-name":
      return "rule names must use lowercase letters, digits, and single hyphen separators";
  }
};

/** Classifies why a string does not satisfy the rule-id grammar. */
const invalidRuleIdReason = (value: string): InvalidRuleIdReason => {
  if (value.length === 0) {
    return "empty";
  }

  if (!value.includes("/")) {
    return "missing-namespace";
  }

  if (!value.startsWith(`${RULE_ID_NAMESPACE}/`)) {
    return "wrong-namespace";
  }

  return "invalid-name";
};

/**
 * Parses a string as a stable ODW rule identifier.
 *
 * @param value Candidate rule identifier.
 * @returns Discriminated parse result.
 */
export const parseRuleId = (value: string): RuleIdParseResult => {
  if (RULE_ID_PATTERN.test(value)) {
    return { ok: true, value: brandRuleId(value) };
  }

  return { ok: false, error: invalidRuleId(value, invalidRuleIdReason(value)) };
};

/**
 * Checks whether a string is a stable ODW rule identifier.
 *
 * @param value Candidate rule identifier.
 * @returns Whether the value satisfies the rule-id grammar.
 */
export const isRuleId = (value: string): value is RuleId => {
  return parseRuleId(value).ok;
};

/**
 * Creates a branded rule identifier for trusted literals.
 *
 * @param value Candidate rule identifier.
 * @returns Branded rule identifier.
 * @throws InvalidRuleIdError when the value does not satisfy the grammar.
 */
export const makeRuleId = (value: string): RuleId => {
  const result = parseRuleId(value);

  if (result.ok) {
    return result.value;
  }

  throw new InvalidRuleIdError(result.error);
};
