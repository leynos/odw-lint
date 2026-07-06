/**
 * @file Shared construction for diagnostics backed by catalogued rules.
 */

import type { RuleDefinition } from "./rule-catalogue";
import { ruleDocsPath } from "./rule-catalogue";
import type { DiagnosticSeverity } from "./severity";
import { copySourcePosition, freezeSourceSpan } from "./source-coordinates";
import type { Diagnostic, DiagnosticSuggestion, SourcePosition, SourceSpan } from "./types";

/**
 * Inputs needed to build one diagnostic from a catalogued rule.
 */
export type RuleDiagnosticInput = {
  /** File path used to locate the diagnostic for humans and machines. */
  readonly file: string;
  /** Catalogued rule that owns the diagnostic. */
  readonly rule: RuleDefinition;
  /** Effective severity after caller-applied overrides. */
  readonly severity: DiagnosticSeverity;
  /** Human-readable diagnostic message. */
  readonly message: string;
  /** Source span in the original workflow file. */
  readonly span: SourceSpan;
  /** Optional suggestions for resolving the diagnostic. */
  readonly suggestions?: readonly DiagnosticSuggestion[];
};

/**
 * Builds a frozen diagnostic from a catalogued rule.
 *
 * @param input - Diagnostic fields whose rule documentation is catalogue-owned.
 * @returns Frozen diagnostic with a repository-relative documentation path.
 */
export const createRuleDiagnostic = (input: RuleDiagnosticInput): Diagnostic => {
  const diagnostic = {
    file: input.file,
    rule: input.rule.id,
    severity: input.severity,
    message: input.message,
    span: frozenSpan(input.span),
    docs: ruleDocsPath(input.rule),
    ...(input.suggestions === undefined
      ? {}
      : { suggestions: frozenSuggestions(input.suggestions) }),
  };

  return Object.freeze(diagnostic);
};

/** Copies one source position into a frozen diagnostic payload. */
const frozenPosition = (position: SourcePosition): SourcePosition => {
  return copySourcePosition(position);
};

/** Copies one source span into a frozen diagnostic payload. */
const frozenSpan = (span: SourceSpan): SourceSpan => {
  return freezeSourceSpan(frozenPosition(span.start), frozenPosition(span.end));
};

/** Copies diagnostic suggestions into a frozen diagnostic payload. */
const frozenSuggestions = (
  suggestions: readonly DiagnosticSuggestion[],
): readonly DiagnosticSuggestion[] => {
  return Object.freeze(suggestions.map((suggestion) => Object.freeze({ ...suggestion })));
};
