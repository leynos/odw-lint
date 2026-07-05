/**
 * @file Shared loader-parity harness helpers for passive workflow fixtures.
 *
 * The harness intentionally drives the public `odw-lint` static pipeline only.
 * It compares statuses and rule classes without importing or executing ODW
 * runtime loader paths.
 */

import { type DiagnosticSeverity, lintWorkflowSource, type WorkflowSource } from "odw-lint";
import type {
  InvalidWorkflowFixtureDiagnostic,
  InvalidWorkflowFixtureStatus,
} from "./invalid-workflows/manifest-types";

/**
 * Compact status used when comparing live lint results with fixture manifests.
 */
export type LoaderParityStatus = "no-error" | "warning" | "error";

/**
 * Reduced facts compared between the live static pipeline and fixture manifests.
 */
export interface LoaderParityOutcome {
  /** Highest warning-or-error status observed for parity-relevant diagnostics. */
  readonly status: LoaderParityStatus;

  /** Sorted unique rule ids for all warning- or error-severity parity diagnostics. */
  readonly ruleClasses: readonly string[];

  /** Sorted unique rule ids for error diagnostics that reject before execution. */
  readonly dialectErrorRules: readonly string[];
}

type ParityDiagnostic = {
  readonly severity: DiagnosticSeverity;
  readonly rule: unknown;
};

/**
 * Runs the static lint pipeline and reduces diagnostics to loader-parity facts.
 *
 * @param source - Passive workflow source text and its diagnostic path.
 * @returns Highest status plus sorted unique rule-class sets.
 */
export const loaderParityOutcome = (source: WorkflowSource): LoaderParityOutcome => {
  const { diagnostics } = lintWorkflowSource(source);

  return loaderParityOutcomeFromDiagnostics(diagnostics);
};

/**
 * Returns the manifest outcome expected from clean trusted ODW examples.
 *
 * @returns Empty no-error parity outcome.
 */
export const expectedNoErrorOutcome = (): LoaderParityOutcome => {
  return Object.freeze({
    status: "no-error",
    ruleClasses: Object.freeze([]),
    dialectErrorRules: Object.freeze([]),
  });
};

/**
 * Returns the manifest outcome expected from dialect errors that reject early.
 *
 * @param ruleClasses - Expected sorted unique rule classes.
 * @returns Error parity outcome for rules that all reject before execution.
 * @throws Error when no rejecting rule class is supplied.
 */
export const expectedErrorOutcome = (ruleClasses: readonly string[]): LoaderParityOutcome => {
  const sortedRuleClasses = uniqueSortedStrings(ruleClasses);
  if (sortedRuleClasses.length === 0) {
    throw new Error("expectedErrorOutcome requires at least one rule class.");
  }

  return Object.freeze({
    status: "error",
    ruleClasses: sortedRuleClasses,
    dialectErrorRules: sortedRuleClasses,
  });
};

/**
 * Returns the manifest outcome expected from one invalid workflow fixture.
 *
 * @param status - Highest rejection status declared by the fixture manifest.
 * @param diagnostics - Manifest diagnostics expected from the static pipeline.
 * @returns Loader-parity outcome reduced from manifest diagnostics.
 * @throws Error when the manifest status disagrees with diagnostic severities.
 */
export const expectedInvalidFixtureOutcome = (
  status: InvalidWorkflowFixtureStatus,
  diagnostics: readonly InvalidWorkflowFixtureDiagnostic[],
): LoaderParityOutcome => {
  const outcome = loaderParityOutcomeFromDiagnostics(diagnostics);
  if (outcome.status !== status) {
    throw new Error(
      `Fixture status ${status} does not match diagnostics-derived status ${outcome.status}.`,
    );
  }

  return outcome;
};

const STATUS_BY_DIAGNOSTIC_SEVERITY = {
  error: "error",
  warning: "warning",
  info: "no-error",
  hint: "no-error",
} as const satisfies Record<DiagnosticSeverity, LoaderParityStatus>;

const LOADER_PARITY_STATUS_RANK = {
  "no-error": 0,
  warning: 1,
  error: 2,
} as const satisfies Record<LoaderParityStatus, number>;

/** Reduces any parity-shaped diagnostic list to the public outcome shape. */
const loaderParityOutcomeFromDiagnostics = (
  diagnostics: readonly ParityDiagnostic[],
): LoaderParityOutcome => {
  const parityDiagnostics = diagnostics.filter(isParityDiagnostic);

  return Object.freeze({
    status: statusFromDiagnostics(parityDiagnostics),
    ruleClasses: uniqueSortedRules(parityDiagnostics),
    dialectErrorRules: uniqueSortedRules(parityDiagnostics.filter(isErrorDiagnostic)),
  });
};

/** Maps parity diagnostics to the compact loader-parity status. */
const statusFromDiagnostics = (
  diagnostics: readonly { readonly severity: DiagnosticSeverity }[],
): LoaderParityStatus => {
  let status: LoaderParityStatus = "no-error";

  for (const diagnostic of diagnostics) {
    status = higherStatus(status, STATUS_BY_DIAGNOSTIC_SEVERITY[diagnostic.severity]);
  }

  return status;
};

/** Preserves the highest status seen in canonical severity order. */
const higherStatus = (
  currentStatus: LoaderParityStatus,
  nextStatus: LoaderParityStatus,
): LoaderParityStatus => {
  return LOADER_PARITY_STATUS_RANK[nextStatus] > LOADER_PARITY_STATUS_RANK[currentStatus]
    ? nextStatus
    : currentStatus;
};

/** Checks whether a parity diagnostic rejects before workflow execution. */
const isErrorDiagnostic = (diagnostic: { readonly severity: DiagnosticSeverity }): boolean => {
  return STATUS_BY_DIAGNOSTIC_SEVERITY[diagnostic.severity] === "error";
};

/** Keeps only diagnostics that affect loader-parity status. */
const isParityDiagnostic = (diagnostic: { readonly severity: DiagnosticSeverity }): boolean => {
  return STATUS_BY_DIAGNOSTIC_SEVERITY[diagnostic.severity] !== "no-error";
};

/** Builds a stable rule-class set from diagnostics. */
const uniqueSortedRules = (
  diagnostics: readonly { readonly rule: unknown }[],
): readonly string[] => {
  return uniqueSortedStrings(diagnostics.map((diagnostic) => String(diagnostic.rule)));
};

/** Builds a stable unique string set for parity comparison. */
const uniqueSortedStrings = (values: readonly string[]): readonly string[] => {
  return Object.freeze([...new Set(values)].sort());
};
