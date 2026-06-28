/**
 * @file Public diagnostic contract for ODW static-analysis results.
 *
 * The module contains inert data shapes and pure constructors only. It does not
 * import or evaluate any ODW runtime code.
 */

export { DIAGNOSTIC_REPORT_SCHEMA } from "./diagnostic-schema";

/**
 * Version of the diagnostic JSON envelope emitted by this package.
 */
export const DIAGNOSTIC_SCHEMA_VERSION = 1;

/**
 * Stable tool name used in diagnostic reports and text output.
 */
export const TOOL_NAME = "odw-lint";

/**
 * Supported diagnostic severity values after caller-applied overrides.
 */
export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

/**
 * A source position in the original workflow file.
 */
export type SourcePosition = {
  /** Zero-based UTF-8 byte offset into the original source. */
  readonly offset: number;
  /** One-based display line number. */
  readonly line: number;
  /** One-based display column number counted in Unicode code points. */
  readonly column: number;
};

/**
 * A half-open source span in the original workflow file.
 */
export type SourceSpan = {
  /** Inclusive start position for the diagnostic. */
  readonly start: SourcePosition;
  /** Exclusive end position for the diagnostic. */
  readonly end: SourcePosition;
};

/**
 * A reviewer-facing suggestion attached to a diagnostic.
 */
export type DiagnosticSuggestion = {
  /** Human-readable suggestion text. */
  readonly message: string;
};

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
 * Diagnostic emitted by an ODW lint rule.
 */
export type Diagnostic = {
  /** File path used to locate the diagnostic for humans and machines. */
  readonly file: string;
  /** Stable rule identifier. */
  readonly rule: RuleId;
  /** Effective severity after caller-applied overrides. */
  readonly severity: DiagnosticSeverity;
  /** Human-readable diagnostic message. */
  readonly message: string;
  /** Source span in the original workflow file. */
  readonly span: SourceSpan;
  /** Optional documentation URL for the rule. */
  readonly docs?: string;
  /** Optional suggestions for resolving the diagnostic. */
  readonly suggestions?: readonly DiagnosticSuggestion[];
};

/**
 * Summary counts for a diagnostic report.
 */
export type DiagnosticSummary = {
  /** Number of files considered by the caller. */
  readonly files: number;
  /** Number of error diagnostics. */
  readonly errors: number;
  /** Number of warning diagnostics. */
  readonly warnings: number;
  /** Number of informational diagnostics. */
  readonly infos: number;
  /** Number of hint diagnostics. */
  readonly hints: number;
};

/**
 * Tool metadata embedded in a diagnostic report.
 */
export type ToolInfo = {
  /** Stable diagnostic producer name. */
  readonly name: typeof TOOL_NAME;
  /** Package version supplied by the caller. */
  readonly version: string;
};

/**
 * Versioned diagnostic report envelope.
 */
export type DiagnosticReport = {
  /** Diagnostic JSON schema version. */
  readonly schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
  /** Tool metadata for the report producer. */
  readonly tool: ToolInfo;
  /** Summary counts for the diagnostics in this report. */
  readonly summary: DiagnosticSummary;
  /** Diagnostics emitted for the analysed files. */
  readonly diagnostics: readonly Diagnostic[];
};

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

/**
 * Counts diagnostics by effective severity.
 *
 * @param input Files count and diagnostics to summarize.
 * @returns Summary counts for the supplied diagnostics.
 */
export const countDiagnostics = (input: {
  readonly files: number;
  readonly diagnostics: readonly Diagnostic[];
}): DiagnosticSummary => {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let hints = 0;

  for (const diagnostic of input.diagnostics) {
    switch (diagnostic.severity) {
      case "error":
        errors += 1;
        break;
      case "warning":
        warnings += 1;
        break;
      case "info":
        infos += 1;
        break;
      case "hint":
        hints += 1;
        break;
    }
  }

  return {
    files: input.files,
    errors,
    warnings,
    infos,
    hints,
  };
};

/**
 * Creates a versioned diagnostic report envelope.
 *
 * @param input Tool version, files count, and diagnostics to report.
 * @returns Diagnostic report envelope.
 */
export const createDiagnosticReport = (input: {
  readonly version: string;
  readonly files: number;
  readonly diagnostics: readonly Diagnostic[];
}): DiagnosticReport => {
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    tool: {
      name: TOOL_NAME,
      version: input.version,
    },
    summary: countDiagnostics(input),
    diagnostics: input.diagnostics,
  };
};

/**
 * Formats diagnostics as stable one-line text output.
 *
 * @param diagnostics Diagnostics to format.
 * @returns Text output with one line per diagnostic.
 */
export const formatTextDiagnostics = (diagnostics: readonly Diagnostic[]): string => {
  const lines = diagnostics.map((diagnostic) => {
    return `${diagnostic.file}:${diagnostic.span.start.line}:${diagnostic.span.start.column} ${diagnostic.severity} ${diagnostic.rule} ${diagnostic.message}`;
  });

  return lines.join("\n");
};
