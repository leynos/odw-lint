/**
 * @file Shared fixture diagnostic projection helpers.
 *
 * Manifest-driven diagnostic parity suites compare diagnostics through this
 * one shape so individual assertions cannot drift into separate field
 * contracts.
 */

import {
  type DiagnosticSeverity,
  type OriginalSourceFile,
  type RuleDocumentationPath,
  type SourceSpan,
  sliceSourceSpan,
} from "odw-lint";

/**
 * Canonical reviewer-facing diagnostic shape used by fixture parity tests.
 */
export interface ComparableFixtureDiagnosticBase {
  readonly rule: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly docs: RuleDocumentationPath;
  readonly span: SourceSpan;
}

/**
 * Canonical reviewer-facing diagnostic shape, extending the base fields with
 * the source text covered by the diagnostic's span.
 */
export interface ComparableFixtureDiagnostic extends ComparableFixtureDiagnosticBase {
  readonly spanText: string;
}

/**
 * Minimum live diagnostic fields needed for fixture parity comparison.
 */
export interface LiveComparableInput {
  readonly rule: unknown;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly docs?: RuleDocumentationPath;
  readonly span: SourceSpan;
}

/**
 * Minimum manifest diagnostic fields needed for fixture parity comparison.
 */
export type ManifestComparableInput = ComparableFixtureDiagnostic;

type ProjectableDiagnostic = Omit<ComparableFixtureDiagnosticBase, "rule"> & {
  readonly rule: unknown;
};

/** Builds the shared comparable diagnostic fields before span text is attached. */
const comparableDiagnosticFields = (
  diagnostic: ProjectableDiagnostic,
): ComparableFixtureDiagnosticBase => {
  return {
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    message: diagnostic.message,
    docs: diagnostic.docs,
    span: diagnostic.span,
  };
};

/**
 * Projects one manifest diagnostic to the canonical comparable shape.
 *
 * @param diagnostic - Manifest-owned expected diagnostic to project.
 * @returns Diagnostic fields used for fixture parity comparison.
 */
export const manifestDiagnosticToComparable = (
  diagnostic: ManifestComparableInput,
): ComparableFixtureDiagnostic => {
  return {
    ...comparableDiagnosticFields(diagnostic),
    spanText: diagnostic.spanText,
  };
};

/**
 * Projects one live diagnostic to the canonical comparable shape.
 *
 * @param diagnostic - Live emitted diagnostic to project.
 * @param sourceFile - Original source file used to derive `spanText`.
 * @returns Diagnostic fields used for fixture parity comparison.
 * @throws Error when the live diagnostic does not carry a documentation path.
 */
export const liveDiagnosticToComparable = (
  diagnostic: LiveComparableInput,
  sourceFile: OriginalSourceFile,
): ComparableFixtureDiagnostic => {
  if (diagnostic.docs === undefined) {
    throw new Error(`Live diagnostic ${String(diagnostic.rule)} is missing a docs path.`);
  }

  return {
    ...comparableDiagnosticFields({ ...diagnostic, docs: diagnostic.docs }),
    spanText: sliceSourceSpan(sourceFile, diagnostic.span),
  };
};
