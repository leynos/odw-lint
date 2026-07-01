/**
 * @file Diagnostic data-shape contract tests.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  DiagnosticSummary,
  RuleDefinition,
  RuleId,
  RuleIdParseResult,
} from "odw-lint";
import {
  DIAGNOSTIC_SCHEMA_VERSION,
  DIAGNOSTIC_SEVERITIES,
  RULE_CATALOGUE,
  ruleDocsPath,
  TOOL_NAME,
} from "odw-lint";

/** Returns the catalogued rule used by representative diagnostic examples. */
const representativeRule = (): RuleDefinition => {
  const rule = RULE_CATALOGUE.find((candidate) => String(candidate.id) === "odw/meta-required");

  if (rule === undefined) {
    throw new Error("odw/meta-required must stay available for representative diagnostics.");
  }

  return rule;
};

/** Returns the catalogued message used by representative diagnostics. */
const representativeMessage = (rule: RuleDefinition): string => {
  const [message] = rule.messages;

  if (message === undefined) {
    throw new Error("odw/meta-required must keep a representative diagnostic message.");
  }

  return message;
};

describe("diagnostics", () => {
  it("constructs a representative diagnostic with a literal source span", () => {
    const rule = representativeRule();
    const message = representativeMessage(rule);
    const diagnostic: Diagnostic = {
      file: "examples/fan-out-reduce.js",
      rule: rule.id,
      severity: "error",
      message,
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
      docs: ruleDocsPath(rule),
      suggestions: [],
    };

    expect(diagnostic).toMatchObject({
      file: "examples/fan-out-reduce.js",
      rule: "odw/meta-required",
      severity: "error",
      message,
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
