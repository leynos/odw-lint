/**
 * @file Diagnostic data-shape contract tests.
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
import { DIAGNOSTIC_SCHEMA_VERSION, DIAGNOSTIC_SEVERITIES, makeRuleId, TOOL_NAME } from "odw-lint";

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
    expect(DIAGNOSTIC_SEVERITIES).toEqual(["error", "warning", "info", "hint"]);
    expect(Object.isFrozen(DIAGNOSTIC_SEVERITIES)).toBeTrue();
    expect(TOOL_NAME).toBe("odw-lint");
  });

  it("exposes the expected public types", () => {
    expectTypeOf<DiagnosticSeverity>().toEqualTypeOf<(typeof DIAGNOSTIC_SEVERITIES)[number]>();
    expectTypeOf<RuleId>().toMatchTypeOf<string>();
    expectTypeOf<RuleIdParseResult>().toEqualTypeOf<
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
    expectTypeOf<Diagnostic>().toEqualTypeOf<{
      readonly file: string;
      readonly rule: RuleId;
      readonly severity: DiagnosticSeverity;
      readonly message: string;
      readonly span: {
        readonly start: {
          readonly offset: number;
          readonly line: number;
          readonly column: number;
        };
        readonly end: {
          readonly offset: number;
          readonly line: number;
          readonly column: number;
        };
      };
      readonly docs?: string;
      readonly suggestions?: readonly {
        readonly message: string;
      }[];
    }>();
    expectTypeOf<DiagnosticSummary>().toEqualTypeOf<{
      readonly files: number;
      readonly errors: number;
      readonly warnings: number;
      readonly infos: number;
      readonly hints: number;
    }>();
    expectTypeOf<DiagnosticReport>().toEqualTypeOf<{
      readonly schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
      readonly tool: {
        readonly name: typeof TOOL_NAME;
        readonly version: string;
      };
      readonly summary: DiagnosticSummary;
      readonly diagnostics: readonly Diagnostic[];
    }>();
  });
});
