/**
 * @file Text diagnostic formatter tests.
 */

import { describe, expect, it } from "bun:test";
import type { Diagnostic } from "odw-lint";
import { createDiagnosticReport, formatTextDiagnostics } from "odw-lint";
import { diagnosticForSeverity } from "./fixtures";

describe("text diagnostics", () => {
  it("returns an empty string when there are no diagnostics", () => {
    expect(formatTextDiagnostics([])).toBe("");
  });

  it("formats one diagnostic with file, position, severity, rule, and message", () => {
    expect(formatTextDiagnostics([diagnosticForSeverity("error")])).toBe(
      "examples/error.js:1:1 error odw/meta-required error diagnostic",
    );
  });

  it("normalizes control whitespace in text output only", () => {
    const diagnostic: Diagnostic = {
      ...diagnosticForSeverity("warning"),
      file: "examples/control\nname.js",
      message: "first line\tsecond line\r\nthird line",
    };

    expect(formatTextDiagnostics([diagnostic])).toBe(
      "examples/control name.js:1:1 warning odw/meta-required first line second line third line",
    );
    expect(diagnostic).toMatchObject({
      file: "examples/control\nname.js",
      message: "first line\tsecond line\r\nthird line",
    });
  });

  it("normalizes Unicode line-breaking separators in text output only", () => {
    const diagnostic: Diagnostic = {
      ...diagnosticForSeverity("warning"),
      file: "examples/unicode\u2028name.js",
      message: "first\u0085second\u2029third",
    };

    expect(formatTextDiagnostics([diagnostic])).toBe(
      "examples/unicode name.js:1:1 warning odw/meta-required first second third",
    );
    expect(diagnostic.message).toBe("first\u0085second\u2029third");
  });

  it("preserves diagnostic order", () => {
    const diagnostics = [diagnosticForSeverity("warning"), diagnosticForSeverity("info")];

    expect(formatTextDiagnostics(diagnostics)).toBe(
      [
        "examples/warning.js:1:1 warning odw/meta-required warning diagnostic",
        "examples/info.js:1:1 info odw/meta-required info diagnostic",
      ].join("\n"),
    );
  });

  it("uses the same diagnostics for JSON reports and text output", () => {
    const diagnostics = [
      diagnosticForSeverity("error"),
      diagnosticForSeverity("warning"),
      diagnosticForSeverity("hint"),
    ];
    const report = createDiagnosticReport({ version: "0.1.0", files: 3, diagnostics });
    const text = formatTextDiagnostics(diagnostics);

    expect(report.diagnostics).toEqual(diagnostics);
    expect(text).toMatchSnapshot();
  });
});
