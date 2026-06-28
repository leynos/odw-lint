/**
 * @file Public diagnostic contract tests.
 *
 * The suite imports through the package entry point to keep package
 * self-reference covered while the diagnostic model grows.
 */
import { describe, expect, expectTypeOf, it } from "bun:test";
import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  DiagnosticSummary,
  RuleId,
  RuleIdParseResult,
} from "odw-lint";
import {
  countDiagnostics,
  createDiagnosticReport,
  DIAGNOSTIC_REPORT_SCHEMA,
  DIAGNOSTIC_SCHEMA_VERSION,
  formatTextDiagnostics,
  InvalidRuleIdError,
  isRuleId,
  makeRuleId,
  parseRuleId,
  TOOL_NAME,
} from "odw-lint";

const documentedRuleIds = [
  "odw/meta-required",
  "odw/meta-object",
  "odw/meta-statically-unprovable",
  "odw/meta-name",
  "odw/meta-description",
  "odw/no-import-export",
  "odw/body-syntax",
  "odw/claude-pure-meta",
  "odw/no-date-now",
  "odw/no-math-random",
  "odw/no-argless-new-date",
  "odw/no-odw-only-validate",
  "odw/bounded-loop",
  "odw/bounded-fanout",
  "odw/no-promise-race",
  "odw/schema-for-structured-agent",
  "odw/worktree-isolation-note",
] as const;

const invalidRuleIds = [
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

/** Builds a diagnostic fixture with the requested severity. */
const diagnosticForSeverity = (severity: DiagnosticSeverity): Diagnostic => {
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

/** Returns the diagnostic item schema from the report schema. */
const diagnosticItemSchema = DIAGNOSTIC_REPORT_SCHEMA.properties.diagnostics.items;

/** Returns the source span schema from the diagnostic item schema. */
const sourceSpanSchema = diagnosticItemSchema.properties.span;

describe("rule identifiers", () => {
  it("accepts documented rule identifiers", () => {
    for (const ruleId of documentedRuleIds) {
      const result = parseRuleId(ruleId);

      expect(result.ok).toBeTrue();
      if (!result.ok) {
        throw new Error(`Expected documented rule id to parse: ${ruleId}`);
      }
      expect(String(result.value)).toBe(ruleId);
      expect(isRuleId(ruleId)).toBeTrue();
      expect(String(makeRuleId(ruleId))).toBe(ruleId);
    }
  });

  it("returns discriminated errors for invalid rule identifiers", () => {
    for (const { value, reason } of invalidRuleIds) {
      const result = parseRuleId(value);

      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: "invalid-rule-id",
          reason,
          value,
        },
      });
      expect(isRuleId(value)).toBeFalse();
    }
  });

  it("does not throw when parsing invalid rule identifiers", () => {
    expect(() => parseRuleId("odw/meta--required")).not.toThrow();
  });

  it("throws structured errors for trusted invalid construction", () => {
    const parsed = parseRuleId("odw/meta--required");

    expect(parsed.ok).toBeFalse();
    if (parsed.ok) {
      throw new Error("Expected invalid parse result for doubled hyphen.");
    }

    expect(() => makeRuleId("odw/meta--required")).toThrow(InvalidRuleIdError);

    try {
      makeRuleId("odw/meta--required");
      throw new Error("Expected makeRuleId to throw for doubled hyphen.");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidRuleIdError);
      if (!(error instanceof InvalidRuleIdError)) {
        throw error;
      }
      expect(error.detail).toEqual(parsed.error);
    }
  });
});

describe("diagnostics", () => {
  it("constructs a representative diagnostic with a literal source span", () => {
    const diagnostic: Diagnostic = {
      file: "examples/fan-out-reduce.js",
      rule: makeRuleId("odw/meta-required"),
      severity: "error",
      message: "workflow must export const meta",
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
      docs: "https://github.com/leynos/odw-lint/docs/rules/meta-required.md",
      suggestions: [],
    };

    expect(diagnostic).toMatchObject({
      file: "examples/fan-out-reduce.js",
      rule: "odw/meta-required",
      severity: "error",
      message: "workflow must export const meta",
    });
  });

  it("exposes stable diagnostic constants", () => {
    expect(DIAGNOSTIC_SCHEMA_VERSION).toBe(1);
    expect(TOOL_NAME).toBe("odw-lint");
  });

  it("exposes the expected public types", () => {
    expectTypeOf<DiagnosticSeverity>().toEqualTypeOf<"error" | "warning" | "info" | "hint">();
    expectTypeOf<RuleId>().toMatchTypeOf<string>();
    expectTypeOf<RuleIdParseResult>().toMatchTypeOf<
      | { readonly ok: true; readonly value: RuleId }
      | {
          readonly ok: false;
          readonly error: {
            readonly kind: "invalid-rule-id";
            readonly reason: "empty" | "missing-namespace" | "wrong-namespace" | "invalid-name";
            readonly value: string;
            readonly message: string;
          };
        }
    >();
    expectTypeOf<Diagnostic>().toMatchTypeOf<{
      readonly file: string;
      readonly rule: RuleId;
      readonly severity: DiagnosticSeverity;
      readonly message: string;
    }>();
    expectTypeOf<DiagnosticSummary>().toMatchTypeOf<{
      readonly files: number;
      readonly errors: number;
      readonly warnings: number;
      readonly infos: number;
      readonly hints: number;
    }>();
    expectTypeOf<DiagnosticReport>().toMatchTypeOf<{
      readonly schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
      readonly diagnostics: readonly Diagnostic[];
    }>();
  });
});

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

  it("counts every severity independently", () => {
    const diagnostics = [
      diagnosticForSeverity("error"),
      diagnosticForSeverity("warning"),
      diagnosticForSeverity("info"),
      diagnosticForSeverity("hint"),
      diagnosticForSeverity("hint"),
    ];

    expect(countDiagnostics({ files: 3, diagnostics })).toEqual({
      files: 3,
      errors: 1,
      warnings: 1,
      infos: 1,
      hints: 2,
    });
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

    expect(createDiagnosticReport({ version: "0.1.0", files: 1, diagnostics })).toEqual({
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
  });
});

describe("diagnostic JSON Schema", () => {
  it("uses the same severity values as the TypeScript model", () => {
    const severityValues = [
      "error",
      "warning",
      "info",
      "hint",
    ] as const satisfies readonly DiagnosticSeverity[];

    expect(diagnosticItemSchema.properties.severity.enum).toEqual(severityValues);
  });

  it("requires the documented top-level envelope keys", () => {
    expect(DIAGNOSTIC_REPORT_SCHEMA.required).toEqual([
      "schemaVersion",
      "tool",
      "summary",
      "diagnostics",
    ]);
  });

  it("matches the summary shape and constrains counts to non-negative integers", () => {
    const summarySchema = DIAGNOSTIC_REPORT_SCHEMA.properties.summary;

    expect(summarySchema.required).toEqual(["files", "errors", "warnings", "infos", "hints"]);
    expect(Object.keys(summarySchema.properties)).toEqual([
      "files",
      "errors",
      "warnings",
      "infos",
      "hints",
    ]);

    for (const countSchema of Object.values(summarySchema.properties)) {
      expect(countSchema).toEqual({ type: "integer", minimum: 0 });
    }
  });

  it("encodes source-position minimums for start and end positions", () => {
    for (const positionSchema of [
      sourceSpanSchema.properties.start,
      sourceSpanSchema.properties.end,
    ]) {
      expect(positionSchema.properties.offset.minimum).toBe(0);
      expect(positionSchema.properties.line.minimum).toBe(1);
      expect(positionSchema.properties.column.minimum).toBe(1);
    }
  });

  it("rejects additional properties on every owned object schema", () => {
    const ownedObjectSchemas = [
      DIAGNOSTIC_REPORT_SCHEMA,
      DIAGNOSTIC_REPORT_SCHEMA.properties.tool,
      DIAGNOSTIC_REPORT_SCHEMA.properties.summary,
      diagnosticItemSchema,
      sourceSpanSchema,
      sourceSpanSchema.properties.start,
      sourceSpanSchema.properties.end,
      diagnosticItemSchema.properties.suggestions.items,
    ];

    for (const objectSchema of ownedObjectSchemas) {
      expect(objectSchema.additionalProperties).toBeFalse();
    }
  });

  it("matches the reviewed schema snapshot", () => {
    expect(DIAGNOSTIC_REPORT_SCHEMA).toMatchSnapshot();
  });
});

describe("text diagnostics", () => {
  it("returns an empty string when there are no diagnostics", () => {
    expect(formatTextDiagnostics([])).toBe("");
  });

  it("formats one diagnostic with file, position, severity, rule, and message", () => {
    expect(formatTextDiagnostics([diagnosticForSeverity("error")])).toBe(
      "examples/error.js:1:1 error odw/meta-required error diagnostic",
    );
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

    expect(report.diagnostics).toBe(diagnostics);
    expect(text).toMatchSnapshot();
  });
});
