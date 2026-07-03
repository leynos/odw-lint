/**
 * @file Tests for the accepted workflow-body parser dialect.
 */

import { describe, expect, it } from "bun:test";
import { makeRuleId, parseWorkflowBody, ruleDefinitionFor } from "odw-lint";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import { envelopeForBody } from "./workflow-envelope-support";

const BODY_SYNTAX_RULE = ruleDefinitionFor(makeRuleId("odw/body-syntax"));

const TYPESCRIPT_ONLY_BODIES = [
  ["variable type annotation", "const value: number = 1;\nreturn value;"],
  [
    "parameter type annotation",
    "function typed(value: number) { return value; }\nreturn typed(1);",
  ],
  ["interface declaration", "interface Shape { size: number }\nreturn 1;"],
  ["enum declaration", "enum Mode { On }\nreturn Mode.On;"],
  ["as type assertion", "const value = 1 as number;\nreturn value;"],
  ["satisfies operator", "const value = 1 satisfies number;\nreturn value;"],
] as const;

describe("workflow body dialect scope", () => {
  it.each(TYPESCRIPT_ONLY_BODIES)("rejects %s", (_label, body) => {
    const envelope = envelopeForBody(body);
    const normalized = parseNormalizedWorkflowBody(envelope);
    const result = parseWorkflowBody(envelope);

    expect(normalized.ok).toBeFalse();
    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected TypeScript-only syntax to produce a diagnostic.");
    }

    expect(result.diagnostic.rule).toBe(BODY_SYNTAX_RULE.id);
    expect(result.diagnostic.span).toEqual(envelope.bodySpan);
    expect(BODY_SYNTAX_RULE.category).toBe("dialect");
  });

  it("accepts plain ECMAScript source", () => {
    const envelope = envelopeForBody("const value = 1;\nreturn value;");

    expect(parseNormalizedWorkflowBody(envelope).ok).toBeTrue();
    expect(parseWorkflowBody(envelope)).toEqual({ ok: true });
  });

  it("accepts generic-call-looking source as ECMAScript comparisons", () => {
    const envelope = envelopeForBody("const value = identity<number>(1);\nreturn value;");

    // ADR 0002 records this as an accepted boundary: `<` and `>` parse as
    // relational operators, not TypeScript generic call syntax.
    expect(parseNormalizedWorkflowBody(envelope).ok).toBeTrue();
    expect(parseWorkflowBody(envelope)).toEqual({ ok: true });
  });
});
