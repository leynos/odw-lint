/**
 * @file Tests for the accepted workflow-body parser dialect.
 */

import { describe, expect, it } from "bun:test";
import { makeRuleId, parseWorkflowBody, ruleDefinitionFor } from "odw-lint";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import {
  ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES,
  TYPESCRIPT_ONLY_DIALECT_BODIES,
} from "./typescript-only-dialect-bodies";
import { envelopeForBody } from "./workflow-envelope-support";

const BODY_SYNTAX_RULE = ruleDefinitionFor(makeRuleId("odw/body-syntax"));

describe("workflow body dialect scope", () => {
  it.each(TYPESCRIPT_ONLY_DIALECT_BODIES)("rejects %s", (_label, body) => {
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

  it.each(ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES)("accepts %s", (_label, body) => {
    const envelope = envelopeForBody(body);

    expect(parseNormalizedWorkflowBody(envelope).ok).toBeTrue();
    expect(parseWorkflowBody(envelope)).toEqual({ ok: true });
  });
});
