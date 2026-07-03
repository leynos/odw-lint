/**
 * @file Tests for the internal normalized workflow body parse helper.
 */

import { describe, expect, it } from "bun:test";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import { envelopeForBody } from "./workflow-envelope-support";

describe("parseNormalizedWorkflowBody", () => {
  it("returns the parsed SWC module for a valid body", () => {
    const envelope = envelopeForBody("const value = 1;\nreturn value;\n");
    const result = parseNormalizedWorkflowBody(envelope);

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected the normalized body to parse.");
    }
    expect(Object.isFrozen(result)).toBeTrue();
    expect(result.sourceFile).toBe(envelope.sourceFile);
    expect(result.bodySpan).toBe(envelope.bodySpan);
    expect(result.module.type).toBe("Module");
  });

  it("returns a frozen failure marker for an invalid body", () => {
    const envelope = envelopeForBody("if (args.ready) {\n");
    const result = parseNormalizedWorkflowBody(envelope);

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected the normalized body parse to fail.");
    }
    expect(result.error).toBeDefined();
    expect(result.sourceFile).toBe(envelope.sourceFile);
    expect(result.bodySpan).toBe(envelope.bodySpan);
    expect(Object.isFrozen(result)).toBeTrue();
  });
});
