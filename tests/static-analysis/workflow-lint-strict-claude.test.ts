/**
 * @file Strict-Claude tests for the merged static workflow lint entry point.
 */

import { describe, expect, it } from "bun:test";
import { createDiagnosticReport, type Diagnostic } from "odw-lint";
import { lintWorkflowSource } from "../../src/static-analysis/workflow-lint";

const STRICT_CLAUDE_SOURCE = [
  "export const meta = { name: 'example', description: 'ok', retries: 1 - 2 };",
  "const timestamp = Date.now();",
  "const sample = Math.random();",
].join("\n");

/** Returns rule identifiers that became errors in the observed diagnostics. */
const promotedRules = (diagnostics: readonly Diagnostic[]): readonly string[] => {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.rule);
};

/** Indexes severities by rule for compact assertions over unique findings. */
const severitiesByRule = (
  diagnostics: readonly Diagnostic[],
): ReadonlyMap<string, Diagnostic["severity"]> => {
  return new Map(diagnostics.map((diagnostic) => [diagnostic.rule, diagnostic.severity]));
};

/** Lints source text under the shared strict-Claude fixture path. */
const lintSource = (sourceText: string, options?: { readonly strictClaude?: boolean }) => {
  return lintWorkflowSource(
    {
      filePath: "workflows/strict-claude.js",
      sourceText,
    },
    options,
  );
};

describe("lintWorkflowSource strict-Claude promotion", () => {
  it("keeps the default merged diagnostic severities and concatenation contract", () => {
    const result = lintSource(STRICT_CLAUDE_SOURCE);

    expect(result.diagnostics).toEqual([
      ...result.scan.diagnostics,
      ...result.classification.diagnostics,
      ...result.bodySyntax,
      ...result.claudeCompatibility,
    ]);
    expect(severitiesByRule(result.diagnostics)).toEqual(
      new Map([
        ["odw/claude-pure-meta", "warning"],
        ["odw/no-date-now", "warning"],
        ["odw/no-math-random", "warning"],
      ]),
    );
  });

  it("promotes Claude-compatibility warnings only in merged diagnostics", () => {
    const result = lintSource(STRICT_CLAUDE_SOURCE, { strictClaude: true });

    expect(promotedRules(result.diagnostics)).toEqual([
      "odw/claude-pure-meta",
      "odw/no-date-now",
      "odw/no-math-random",
    ]);
    expect(severitiesByRule(result.classification.diagnostics)).toEqual(
      new Map([["odw/claude-pure-meta", "warning"]]),
    );
    expect(severitiesByRule(result.claudeCompatibility)).toEqual(
      new Map([
        ["odw/no-date-now", "warning"],
        ["odw/no-math-random", "warning"],
      ]),
    );
  });

  it("leaves dialect diagnostics unchanged under strict-Claude mode", () => {
    const result = lintSource(
      [
        "import helper from './helper.js';",
        "export const meta = { name: 'example', description: 'ok' };",
        "if (args.ready) {",
      ].join("\n"),
      { strictClaude: true },
    );

    expect(severitiesByRule(result.diagnostics)).toEqual(
      new Map([
        ["odw/no-import-export", "error"],
        ["odw/body-syntax", "error"],
      ]),
    );
  });

  it("feeds promoted severities into diagnostic report summaries", () => {
    const defaultReport = createDiagnosticReport({
      version: "0.0.0-test",
      files: 1,
      diagnostics: lintSource(STRICT_CLAUDE_SOURCE).diagnostics,
    });
    const strictReport = createDiagnosticReport({
      version: "0.0.0-test",
      files: 1,
      diagnostics: lintSource(STRICT_CLAUDE_SOURCE, { strictClaude: true }).diagnostics,
    });

    expect(defaultReport.summary.errors).toBe(0);
    expect(defaultReport.summary.warnings).toBe(3);
    expect(strictReport.summary.errors).toBe(3);
    expect(strictReport.summary.warnings).toBe(0);
  });
});
