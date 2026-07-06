/**
 * @file Text diagnostic formatter tests.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import type { Diagnostic, DiagnosticSeverity, DiagnosticSummary } from "odw-lint";
import { countDiagnostics, createDiagnosticReport, formatTextDiagnostics } from "odw-lint";
import { formatTextReport } from "../../src/diagnostics/text";
import { diagnosticForSeverity, severitySummaryKeys } from "./fixtures";

const summaryCases = [
  {
    name: "singular error",
    severities: ["error"],
    expected: "Found 1 error.",
  },
  {
    name: "plural errors and singular warning",
    severities: ["error", "error", "warning"],
    expected: "Found 2 errors, 1 warning.",
  },
  {
    name: "omits zero-count categories",
    severities: ["warning", "warning", "warning"],
    expected: "Found 3 warnings.",
  },
  {
    name: "orders all categories by severity",
    severities: ["hint", "info", "warning", "error"],
    expected: "Found 1 error, 1 warning, 1 info, 1 hint.",
  },
] as const satisfies readonly {
  readonly name: string;
  readonly severities: readonly DiagnosticSeverity[];
  readonly expected: string;
}[];

const severityOrder = ["error", "warning", "info", "hint"] as const;
const severityLabels = {
  error: ["error", "errors"],
  warning: ["warning", "warnings"],
  info: ["info", "infos"],
  hint: ["hint", "hints"],
} as const satisfies Record<DiagnosticSeverity, readonly [string, string]>;

/** Builds the independently expected footer from report summary counts. */
const expectedSummaryLine = (summary: DiagnosticSummary): string => {
  const parts = severityOrder.flatMap((severity) => {
    const count = summary[severitySummaryKeys[severity]];

    if (count === 0) {
      return [];
    }

    const [singular, plural] = severityLabels[severity];
    return [`${count} ${count === 1 ? singular : plural}`];
  });

  return `Found ${parts.join(", ")}.`;
};

/** Builds a report whose diagnostics realize the requested severity sequence. */
const reportForSeverities = (severities: readonly DiagnosticSeverity[]) => {
  const diagnostics = severities.map(diagnosticForSeverity);

  return createDiagnosticReport({
    version: "0.1.0",
    files: Math.max(1, diagnostics.length),
    diagnostics,
  });
};

/** Extracts the footer without assuming anything about diagnostic line text. */
const summaryFromTextReport = (text: string): string => text.split("\n").at(-1) ?? "";

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

  it("returns an empty string for an empty report", () => {
    const report = createDiagnosticReport({ version: "0.1.0", files: 1, diagnostics: [] });

    expect(formatTextReport(report)).toBe("");
  });

  it("formats a report with a diagnostic line and summary footer", () => {
    expect(formatTextReport(reportForSeverities(["error"]))).toBe(
      ["examples/error.js:1:1 error odw/meta-required error diagnostic", "", "Found 1 error."].join(
        "\n",
      ),
    );
  });

  for (const testCase of summaryCases) {
    it(`formats a severity summary for ${testCase.name}`, () => {
      expect(
        summaryFromTextReport(formatTextReport(reportForSeverities(testCase.severities))),
      ).toBe(testCase.expected);
    });
  }

  it("uses report summary counts for the footer", () => {
    const diagnostics = [
      diagnosticForSeverity("error"),
      diagnosticForSeverity("error"),
      diagnosticForSeverity("warning"),
      diagnosticForSeverity("hint"),
    ];
    const summary = countDiagnostics({ files: 4, diagnostics });
    const report = createDiagnosticReport({ version: "0.1.0", files: 4, diagnostics });

    expect(report.summary).toEqual(summary);
    expect(summaryFromTextReport(formatTextReport(report))).toBe(expectedSummaryLine(summary));
  });

  it("summarizes any non-empty severity multiset in fixed order", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...severityOrder), { minLength: 1, maxLength: 40 }),
        (severities) => {
          const report = reportForSeverities(severities);

          expect(summaryFromTextReport(formatTextReport(report))).toBe(
            expectedSummaryLine(report.summary),
          );
        },
      ),
    );
  });

  it("snapshots a multi-diagnostic text report", () => {
    const report = reportForSeverities(["warning", "error", "hint"]);

    expect(formatTextReport(report)).toMatchSnapshot();
  });
});
