/**
 * @file Diagnostic report helper tests.
 */

import { describe, expect, it } from "bun:test";
import { countDiagnostics, createDiagnosticReport, DIAGNOSTIC_SEVERITIES } from "odw-lint";
import { diagnosticForSeverity, severitySummaryKeys } from "./fixtures";

describe("diagnostic reports", () => {
  it("counts an empty diagnostic list", () => {
    expect(countDiagnostics({ files: 0, diagnostics: [] })).toEqual({
      files: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      hints: 0,
    });
  });

  it("rejects invalid report file counts at the summary boundary", () => {
    for (const files of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => countDiagnostics({ files, diagnostics: [] })).toThrow(RangeError);
      expect(() => createDiagnosticReport({ version: "0.1.0", files, diagnostics: [] })).toThrow(
        "Report file count must be a non-negative integer",
      );
    }
  });

  it("counts every severity independently", () => {
    const diagnostics = DIAGNOSTIC_SEVERITIES.flatMap((severity) => {
      return severity === "hint"
        ? [diagnosticForSeverity(severity), diagnosticForSeverity(severity)]
        : [diagnosticForSeverity(severity)];
    });

    expect(countDiagnostics({ files: 3, diagnostics })).toEqual({
      files: 3,
      errors: 1,
      warnings: 1,
      infos: 1,
      hints: 2,
    });
  });

  it("mirrors every severity into a summary counter", () => {
    for (const severity of DIAGNOSTIC_SEVERITIES) {
      const summary = countDiagnostics({
        files: 1,
        diagnostics: [diagnosticForSeverity(severity)],
      });

      expect(summary[severitySummaryKeys[severity]]).toBe(1);
    }
  });

  it("keeps counts stable when diagnostic order changes", () => {
    const diagnostics = [
      diagnosticForSeverity("hint"),
      diagnosticForSeverity("error"),
      diagnosticForSeverity("warning"),
      diagnosticForSeverity("info"),
    ];
    const reversedDiagnostics = [...diagnostics].reverse();

    expect(countDiagnostics({ files: 2, diagnostics })).toEqual(
      countDiagnostics({ files: 2, diagnostics: reversedDiagnostics }),
    );
  });

  it("keeps hint counts separate from info counts", () => {
    const diagnostics = [diagnosticForSeverity("hint"), diagnosticForSeverity("hint")];

    expect(countDiagnostics({ files: 1, diagnostics })).toMatchObject({
      infos: 0,
      hints: 2,
    });
  });

  it("creates a versioned report envelope over the same diagnostics", () => {
    const diagnostics = [diagnosticForSeverity("error"), diagnosticForSeverity("hint")];
    const report = createDiagnosticReport({ version: "0.1.0", files: 1, diagnostics });

    expect(report).toEqual({
      schemaVersion: 1,
      tool: { name: "odw-lint", version: "0.1.0" },
      summary: {
        files: 1,
        errors: 1,
        warnings: 0,
        infos: 0,
        hints: 1,
      },
      diagnostics,
    });
    expect(report).toMatchSnapshot();
  });

  it("snapshots diagnostics before caller-owned arrays can change", () => {
    const diagnostics = [diagnosticForSeverity("error")];
    const report = createDiagnosticReport({ version: "0.1.0", files: 1, diagnostics });

    diagnostics.push(diagnosticForSeverity("hint"));

    expect(report.diagnostics).toEqual([diagnosticForSeverity("error")]);
    expect(report.summary).toEqual({
      files: 1,
      errors: 1,
      warnings: 0,
      infos: 0,
      hints: 0,
    });
  });

  it("snapshots nested diagnostic payloads before caller-owned objects can change", () => {
    const diagnostic = {
      ...diagnosticForSeverity("warning"),
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 4, line: 1, column: 5 },
      },
      suggestions: [{ message: "Add exported metadata." }],
    };
    const report = createDiagnosticReport({
      version: "0.1.0",
      files: 1,
      diagnostics: [diagnostic],
    });

    diagnostic.span.start.line = 99;
    const firstSuggestion = diagnostic.suggestions[0];
    if (firstSuggestion === undefined) {
      throw new Error("Expected suggestion fixture.");
    }
    firstSuggestion.message = "mutated";

    expect(report.diagnostics[0]?.span.start.line).toBe(1);
    expect(report.diagnostics[0]?.suggestions?.[0]?.message).toBe("Add exported metadata.");
  });
});
