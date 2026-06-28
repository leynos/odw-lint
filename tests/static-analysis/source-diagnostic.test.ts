/**
 * @file Source-span diagnostic integration tests.
 */

import { describe, expect, it } from "bun:test";
import type { Diagnostic, SourcePosition } from "odw-lint";
import {
  createDiagnosticReport,
  createOriginalSourceFile,
  DIAGNOSTIC_REPORT_SCHEMA,
  DIAGNOSTIC_SEVERITIES,
  formatTextDiagnostics,
  makeRuleId,
  spanFromOffsets,
} from "odw-lint";

const diagnosticSchema = DIAGNOSTIC_REPORT_SCHEMA.properties.diagnostics.items;
const sourceSpanSchema = diagnosticSchema.properties.span;

describe("source spans in diagnostics", () => {
  it("threads original source spans through reports, schema checks, and text output", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "meta\nbody",
    });
    const span = spanFromOffsets(sourceFile, 5, 9);
    const callerSpan = {
      start: { ...span.start },
      end: { ...span.end },
    };
    const diagnostic = {
      file: sourceFile.filePath,
      rule: makeRuleId("odw/meta-required"),
      severity: "warning",
      message: "body missing metadata",
      span: callerSpan,
    } satisfies Diagnostic;
    const expectedDiagnostic = structuredClone(diagnostic);

    const report = createDiagnosticReport({
      version: "0.1.0",
      files: 1,
      diagnostics: [diagnostic],
    });
    callerSpan.start.line = 99;
    const reportDiagnostic = requiredReportDiagnostic(report.diagnostics[0]);

    expect(Object.keys(report).sort()).toEqual([...DIAGNOSTIC_REPORT_SCHEMA.required].sort());
    expect(report.diagnostics).toEqual([expectedDiagnostic]);
    expectRequiredDiagnosticKeys(reportDiagnostic);
    expect(DIAGNOSTIC_SEVERITIES).toContain(reportDiagnostic.severity);
    expectPositionSatisfiesMinimums(reportDiagnostic.span.start, sourceSpanSchema.properties.start);
    expectPositionSatisfiesMinimums(reportDiagnostic.span.end, sourceSpanSchema.properties.end);
    expect(report).toEqual({
      schemaVersion: 1,
      tool: { name: "odw-lint", version: "0.1.0" },
      summary: {
        files: 1,
        errors: 0,
        warnings: 1,
        infos: 0,
        hints: 0,
      },
      diagnostics: [expectedDiagnostic],
    });
    expect(formatTextDiagnostics(report.diagnostics)).toBe(
      "workflows/example.js:2:1 warning odw/meta-required body missing metadata",
    );
    expect(report.diagnostics[0]?.span).toEqual(span);
  });
});

/** Asserts every schema-required diagnostic key is present. */
const expectRequiredDiagnosticKeys = (diagnostic: Diagnostic): void => {
  for (const key of diagnosticSchema.required) {
    expect(Object.hasOwn(diagnostic, key)).toBeTrue();
  }
};

/** Returns the cloned diagnostic under test after narrowing indexed access. */
const requiredReportDiagnostic = (diagnostic: Diagnostic | undefined): Diagnostic => {
  if (diagnostic === undefined) {
    throw new Error("Diagnostic report should include the source-span diagnostic.");
  }

  return diagnostic;
};

/** Asserts source positions satisfy the exported schema minimums. */
const expectPositionSatisfiesMinimums = (
  position: SourcePosition,
  positionSchema: typeof sourceSpanSchema.properties.start,
): void => {
  expect(position.offset).toBeGreaterThanOrEqual(positionSchema.properties.offset.minimum);
  expect(position.line).toBeGreaterThanOrEqual(positionSchema.properties.line.minimum);
  expect(position.column).toBeGreaterThanOrEqual(positionSchema.properties.column.minimum);
};
