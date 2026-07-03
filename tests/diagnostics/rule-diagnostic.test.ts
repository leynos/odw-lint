/**
 * @file Tests for shared rule diagnostic construction.
 */

import { describe, expect, it } from "bun:test";
import type { RuleDefinition, SourceSpan } from "odw-lint";
import { RULE_CATALOGUE } from "odw-lint";
import {
  createRuleDiagnostic,
  type RuleDiagnosticInput,
} from "../../src/diagnostics/rule-diagnostic";

const META_REQUIRED_DOCS = "docs/rules/meta-required.md";
const SAMPLE_SPAN: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

/** Returns the reviewed rule used by representative diagnostic builder tests. */
const metaRequiredRule = (): RuleDefinition => {
  const rule = RULE_CATALOGUE.find((candidate) => String(candidate.id) === "odw/meta-required");

  if (rule === undefined) {
    throw new Error("odw/meta-required must stay available for diagnostic builder tests.");
  }

  return rule;
};

describe("rule diagnostics", () => {
  it("derives the documentation path from the catalogued rule", () => {
    const rule = metaRequiredRule();
    const diagnostic = createRuleDiagnostic({
      file: "workflows/example.js",
      rule,
      severity: "warning",
      message: "Representative diagnostic.",
      span: SAMPLE_SPAN,
    });

    expect(diagnostic).toEqual({
      file: "workflows/example.js",
      rule: rule.id,
      severity: "warning",
      message: "Representative diagnostic.",
      span: SAMPLE_SPAN,
      docs: META_REQUIRED_DOCS,
    });
    expect(Object.isFrozen(diagnostic)).toBeTrue();
    expect(Object.isFrozen(diagnostic.span)).toBeTrue();
    expect(Object.isFrozen(diagnostic.span.start)).toBeTrue();
    expect(Object.isFrozen(diagnostic.span.end)).toBeTrue();
    expect(diagnostic.span).not.toBe(SAMPLE_SPAN);
  });

  it("preserves optional suggestions while deriving catalogue docs", () => {
    const rule = metaRequiredRule();
    const span = {
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 5, line: 1, column: 6 },
    };
    const suggestions = [{ message: "Add an `export const meta` declaration." }];
    const diagnostic = createRuleDiagnostic({
      file: "workflows/suggested.js",
      rule,
      severity: rule.defaultSeverity,
      message: "Workflow source must export literal metadata.",
      span,
      suggestions,
    });

    expect(diagnostic).toEqual({
      file: "workflows/suggested.js",
      rule: rule.id,
      severity: rule.defaultSeverity,
      message: "Workflow source must export literal metadata.",
      span,
      docs: META_REQUIRED_DOCS,
      suggestions,
    });
    expect(Object.isFrozen(diagnostic.suggestions)).toBeTrue();
    expect(Object.isFrozen(diagnostic.suggestions?.[0])).toBeTrue();
    expect(diagnostic.suggestions).not.toBe(suggestions);
    expect(diagnostic.suggestions?.[0]).not.toBe(suggestions[0]);
    expect(diagnostic).toMatchSnapshot();
  });

  it("rejects invalid inputs at the type boundary", () => {
    const rule = metaRequiredRule();
    const validInput = {
      file: "workflows/typed.js",
      rule,
      severity: "error",
      message: "Representative diagnostic.",
      span: SAMPLE_SPAN,
      suggestions: [{ message: "Add metadata." }],
    } satisfies RuleDiagnosticInput;

    const invalidSeverity: RuleDiagnosticInput = {
      ...validInput,
      // @ts-expect-error severity must be one of the supported diagnostic severities.
      severity: "critical",
    };
    const invalidSuggestions: RuleDiagnosticInput = {
      ...validInput,
      // @ts-expect-error suggestions must carry a reviewer-facing message.
      suggestions: [{ text: "Add metadata." }],
    };

    expect(validInput.rule.id).toBe(rule.id);
    void invalidSeverity;
    void invalidSuggestions;
  });
});
