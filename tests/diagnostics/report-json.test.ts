/**
 * @file Canonical JSON diagnostic report formatter tests.
 */

import { describe, expect, it } from "bun:test";
import type { Diagnostic } from "odw-lint";
import { createDiagnosticReport, formatJsonReport } from "odw-lint";
import { diagnosticForSeverity } from "./fixtures";

/** Builds a small report fixture for JSON projection assertions. */
const reportWith = (diagnostics: readonly Diagnostic[]) => {
  return createDiagnosticReport({ version: "0.1.0", files: 2, diagnostics });
};

describe("JSON diagnostic reports", () => {
  it("projects a report into the documented JSON envelope", () => {
    const diagnostic = diagnosticForSeverity("error");
    const report = reportWith([diagnostic]);

    expect(JSON.parse(formatJsonReport(report))).toEqual({
      schemaVersion: 1,
      tool: { name: "odw-lint", version: "0.1.0" },
      summary: {
        files: 2,
        errors: 1,
        warnings: 0,
        infos: 0,
        hints: 0,
      },
      diagnostics: [
        {
          file: "examples/error.js",
          rule: "odw/meta-required",
          severity: "error",
          message: "error diagnostic",
          span: {
            start: { offset: 0, line: 1, column: 1 },
            end: { offset: 0, line: 1, column: 1 },
          },
          docs: diagnostic.docs,
          suggestions: [],
        },
      ],
    });
  });

  it("keeps the top-level and diagnostic key order canonical", () => {
    const diagnostic = diagnosticForSeverity("warning");
    const parsedReport = JSON.parse(formatJsonReport(reportWith([diagnostic])));
    const firstDiagnostic = parsedReport.diagnostics[0];

    expect(Object.keys(parsedReport)).toEqual(["schemaVersion", "tool", "summary", "diagnostics"]);
    expect(Object.keys(firstDiagnostic)).toEqual([
      "file",
      "rule",
      "severity",
      "message",
      "span",
      "docs",
      "suggestions",
    ]);
  });

  it("always emits suggestions while preserving suggestion messages", () => {
    const diagnosticWithoutSuggestions = diagnosticForSeverity("info");
    const diagnosticWithSuggestions = {
      ...diagnosticForSeverity("hint"),
      suggestions: [{ message: "Add exported metadata." }],
    } satisfies Diagnostic;
    const parsedReport = JSON.parse(
      formatJsonReport(reportWith([diagnosticWithoutSuggestions, diagnosticWithSuggestions])),
    );

    expect(parsedReport.diagnostics[0].suggestions).toEqual([]);
    expect(parsedReport.diagnostics[1].suggestions).toEqual([
      { message: "Add exported metadata." },
    ]);
  });

  it("snapshots a small multi-diagnostic JSON report", () => {
    const report = reportWith([diagnosticForSeverity("error"), diagnosticForSeverity("hint")]);

    expect(formatJsonReport(report)).toMatchSnapshot();
  });
});
