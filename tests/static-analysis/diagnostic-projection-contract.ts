/**
 * @file Type-only contracts for shared fixture diagnostic projection helpers.
 */

import type { ComparableFixtureDiagnostic } from "./fixtures/diagnostic-projection";
import { manifestDiagnosticToComparable } from "./fixtures/diagnostic-projection";
import type { InvalidWorkflowFixtureDiagnostic } from "./fixtures/invalid-workflows/manifest-types";

declare const manifestDiagnostic: InvalidWorkflowFixtureDiagnostic;

const comparableDiagnosticContract = {
  ...manifestDiagnosticToComparable(manifestDiagnostic),
} satisfies ComparableFixtureDiagnostic;

// @ts-expect-error: `docs` is mandatory in comparable diagnostics.
const missingDocsContract: ComparableFixtureDiagnostic = {
  rule: comparableDiagnosticContract.rule,
  severity: comparableDiagnosticContract.severity,
  message: comparableDiagnosticContract.message,
  span: comparableDiagnosticContract.span,
  spanText: comparableDiagnosticContract.spanText,
};

void comparableDiagnosticContract;
void missingDocsContract;
