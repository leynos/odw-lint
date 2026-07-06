/**
 * @file Focused tests for parser-backed body-scanner harness helpers.
 */

import { describe, expect, it } from "bun:test";
import { firstReviewedRuleMessage, makeRuleId, ruleDefinitionFor } from "odw-lint";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import {
  type BodyScannerMatch,
  diagnosticsForBodyMatches,
} from "../../src/static-analysis/workflow-body-scanner-harness";
import { envelopeForBody, spanTextFor } from "./workflow-envelope-support";

const DATE_NOW_RULE = makeRuleId("odw/no-date-now");

/** Returns one normalized-source match for the given ASCII text. */
const matchForNormalizedText = (
  parseResult: Extract<ReturnType<typeof parseNormalizedWorkflowBody>, { readonly ok: true }>,
  matchedText: string,
): BodyScannerMatch => {
  const start = parseResult.normalized.normalizedText.indexOf(matchedText);

  if (start < 0) {
    throw new Error(`Expected normalized text to contain ${matchedText}.`);
  }

  return Object.freeze({
    span: Object.freeze({
      start: parseResult.module.span.start + start,
      end: parseResult.module.span.start + start + matchedText.length,
      ctxt: parseResult.module.span.ctxt,
    }),
  });
};

describe("parser-backed body scanner harness", () => {
  it("builds frozen diagnostics from normalized-source body matches", () => {
    const envelope = envelopeForBody("const timestamp = Date.now();");
    const parseResult = parseNormalizedWorkflowBody(envelope);
    const rule = ruleDefinitionFor(DATE_NOW_RULE);

    expect(parseResult.ok).toBeTrue();
    if (!parseResult.ok) {
      throw new Error("Expected workflow body to parse.");
    }

    const diagnostics = diagnosticsForBodyMatches({
      envelope,
      parseResult,
      collectMatches: (parsedBody) => [matchForNormalizedText(parsedBody, "Date.now")],
      ruleForMatch: () => rule,
    });

    expect(Object.isFrozen(diagnostics)).toBeTrue();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.rule).toBe(DATE_NOW_RULE);
    expect(diagnostics[0]?.severity).toBe(rule.defaultSeverity);
    expect(diagnostics[0]?.message).toBe(firstReviewedRuleMessage(rule));
    expect(diagnostics[0] && spanTextFor(envelope.sourceFile, diagnostics[0].span)).toBe(
      "Date.now",
    );
  });

  it("returns a frozen empty diagnostic list when body parsing fails", () => {
    const envelope = envelopeForBody("if (");
    const parseResult = parseNormalizedWorkflowBody(envelope);
    let didCollectMatches = false;

    const diagnostics = diagnosticsForBodyMatches({
      envelope,
      parseResult,
      collectMatches: () => {
        didCollectMatches = true;
        return [];
      },
      ruleForMatch: () => ruleDefinitionFor(DATE_NOW_RULE),
    });

    expect(parseResult.ok).toBeFalse();
    expect(diagnostics).toEqual([]);
    expect(Object.isFrozen(diagnostics)).toBeTrue();
    expect(didCollectMatches).toBeFalse();
  });
});
