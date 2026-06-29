/**
 * @file Shared diagnostic test fixtures.
 *
 * Focused diagnostic suites use these fixtures to preserve package-entry
 * coverage without repeating representative diagnostic data.
 */

import type { Diagnostic, DiagnosticSeverity, DiagnosticSummary } from "odw-lint";
import { makeRuleId, RULE_IDS } from "odw-lint";

export const documentedRuleIds = RULE_IDS;

export const invalidRuleIds = [
  { value: "", reason: "empty" },
  { value: "meta-required", reason: "missing-namespace" },
  { value: "custom/meta-required", reason: "wrong-namespace" },
  { value: "odw/MetaRequired", reason: "invalid-name" },
  { value: "odw/meta required", reason: "invalid-name" },
  { value: "odw//meta-required", reason: "invalid-name" },
  { value: "odw/meta--required", reason: "invalid-name" },
  { value: "odw/meta-required-", reason: "invalid-name" },
  { value: "odw/../meta-required", reason: "invalid-name" },
] as const;

export const severitySummaryKeys = {
  error: "errors",
  warning: "warnings",
  info: "infos",
  hint: "hints",
} as const satisfies Record<DiagnosticSeverity, keyof DiagnosticSummary>;

/**
 * Builds a diagnostic fixture with the requested severity.
 *
 * @param severity Severity to embed in the diagnostic fixture.
 * @returns Diagnostic fixture for report and text assertions.
 */
export const diagnosticForSeverity = (severity: DiagnosticSeverity): Diagnostic => {
  return {
    file: `examples/${severity}.js`,
    rule: makeRuleId("odw/meta-required"),
    severity,
    message: `${severity} diagnostic`,
    span: {
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 0, line: 1, column: 1 },
    },
  };
};
