/**
 * @file Public diagnostic consumer fixture.
 *
 * This suite keeps a package-entry-only consumer compiling against the
 * diagnostic fields that downstream callers rely on.
 */

import { describe, expect, it } from "bun:test";
import type { Diagnostic, DiagnosticReport, DiagnosticSummary } from "odw-lint";
import { createDiagnosticReport, DIAGNOSTIC_SCHEMA_VERSION, makeRuleId, TOOL_NAME } from "odw-lint";

describe("public diagnostic consumer", () => {
  it("can construct and read required diagnostic report fields", () => {
    const diagnostic = {
      file: "workflows/example.js",
      rule: makeRuleId("odw/meta-required"),
      severity: "error",
      message: "workflow must export const meta",
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
    } satisfies Diagnostic;

    const summary = {
      files: 1,
      errors: 1,
      warnings: 0,
      infos: 0,
      hints: 0,
    } satisfies DiagnosticSummary;

    const report = createDiagnosticReport({
      version: "0.1.0",
      files: summary.files,
      diagnostics: [diagnostic],
    }) satisfies DiagnosticReport;

    expect(report.schemaVersion).toBe(DIAGNOSTIC_SCHEMA_VERSION);
    expect(report.tool).toEqual({ name: TOOL_NAME, version: "0.1.0" });
    expect(report.summary).toEqual(summary);
    expect(report.diagnostics[0]?.span.start.line).toBe(1);
  });
});
