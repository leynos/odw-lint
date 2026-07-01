/**
 * @file Diagnostic report data shapes and stable report constants.
 */

import type { RuleDocumentationPath } from "./rule-catalogue";
import type { RuleId } from "./rule-id";
import type { DiagnosticSeverity } from "./severity";

/**
 * Version of the diagnostic JSON envelope emitted by this package.
 */
export const DIAGNOSTIC_SCHEMA_VERSION = 1;

/**
 * Stable tool name used in diagnostic reports and text output.
 */
export const TOOL_NAME = "odw-lint";

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
  /** Optional repository-relative documentation path for the rule. */
  readonly docs?: RuleDocumentationPath;
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
