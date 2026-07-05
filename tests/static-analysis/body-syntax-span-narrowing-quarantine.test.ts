/**
 * @file Characterization tests for the body-syntax span-narrowing quarantine.
 */

import { describe, expect, it } from "bun:test";
import { parseSync } from "@swc/core";
import * as odwLint from "odw-lint";
import { normalizeWorkflowBody, parseWorkflowBody, type WorkflowBodyParseResult } from "odw-lint";
import { structuredNormalizedRangeFromParserError } from "../../src/static-analysis/workflow-body-parser-spans";
import { envelopeForBody } from "./workflow-envelope-support";

/** Captures the real parser failure for a malformed normalized workflow body. */
const catchSwcParseError = (normalizedText: string): unknown => {
  try {
    parseSync(normalizedText, {
      syntax: "ecmascript",
      jsx: false,
    });
  } catch (error) {
    return error;
  }

  throw new Error("Expected SWC to reject the malformed normalized workflow body.");
};

/** Requires a body-syntax diagnostic result for quarantine-contract assertions. */
const expectBodySyntaxDiagnostic = (
  result: WorkflowBodyParseResult,
): Extract<WorkflowBodyParseResult, { readonly ok: false }>["diagnostic"] => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected a malformed workflow body to emit a syntax diagnostic.");
  }

  return result.diagnostic;
};

describe("body-syntax span-narrowing quarantine", () => {
  it("keeps the shipped SWC parser on the whole-body fallback", () => {
    const envelope = envelopeForBody('agent("draft"\n');
    const normalized = normalizeWorkflowBody(envelope);
    const realError = catchSwcParseError(normalized.normalizedText);
    const diagnostic = expectBodySyntaxDiagnostic(parseWorkflowBody(envelope));

    expect(structuredNormalizedRangeFromParserError(realError, normalized)).toBeUndefined();
    expect(diagnostic.span).toEqual(envelope.bodySpan);
  });

  it("keeps the dormant narrowing seam out of the public package entry", () => {
    const publicSurface = odwLint as unknown as Record<string, unknown>;

    expect(publicSurface["narrowedSpanForParserError"]).toBeUndefined();
    expect(publicSurface["structuredNormalizedRangeFromParserError"]).toBeUndefined();
    expect(publicSurface["narrowBodySyntaxSpan"]).toBeUndefined();
  });
});
