/**
 * @file Strict-Claude severity promotion tests.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
  type Diagnostic,
  type DiagnosticSeverity,
  findRuleDefinition,
  makeRuleId,
  promoteStrictClaudeSeverity,
  RULE_CATALOGUE,
  type RuleDefinition,
  ruleDocsPath,
  STRICT_CLAUDE_PROMOTION_POLICY,
} from "odw-lint";

const STRICT_CLAUDE_WARNING_RULE_IDS = [
  "odw/claude-pure-meta",
  "odw/no-date-now",
  "odw/no-math-random",
  "odw/no-argless-new-date",
] as const;

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 4, line: 1, column: 5 }),
});

/** Returns a catalogued rule fixture by identifier. */
const findRule = (id: string): RuleDefinition => {
  const rule = findRuleDefinition(makeRuleId(id));

  if (rule === undefined) {
    throw new Error(`${id} must stay available in the rule catalogue.`);
  }

  return rule;
};

/** Builds a representative diagnostic for a catalogue rule. */
const diagnosticForRule = (
  rule: RuleDefinition,
  severity: DiagnosticSeverity = rule.defaultSeverity,
): Diagnostic => {
  return Object.freeze({
    file: `examples/${rule.docsSlug}.js`,
    rule: rule.id,
    severity,
    message: `${rule.id} fixture`,
    span: SPAN,
    docs: ruleDocsPath(rule),
    suggestions: Object.freeze([{ message: "Preserve this suggestion." }]),
  });
};

/** Asserts that the transform returns an untouched diagnostic reference. */
const expectUnchangedDiagnostic = (diagnostic: Diagnostic): void => {
  const result = promoteStrictClaudeSeverity([diagnostic]);

  expect(result).toEqual([diagnostic]);
  expect(result[0]).toBe(diagnostic);
};

describe("strict-Claude severity promotion", () => {
  it("promotes every Claude-compatibility warning to error", () => {
    const diagnostics = STRICT_CLAUDE_WARNING_RULE_IDS.map((ruleId) =>
      diagnosticForRule(findRule(ruleId), "warning"),
    );

    expect(
      promoteStrictClaudeSeverity(diagnostics).map((diagnostic) => diagnostic.severity),
    ).toEqual(["error", "error", "error", "error"]);
  });

  it("leaves the ODW-only validate compatibility note informational", () => {
    expectUnchangedDiagnostic(diagnosticForRule(findRule("odw/no-odw-only-validate"), "info"));
  });

  it("leaves dialect errors and dialect warnings unchanged", () => {
    expectUnchangedDiagnostic(diagnosticForRule(findRule("odw/meta-required"), "error"));
    expectUnchangedDiagnostic(
      diagnosticForRule(findRule("odw/meta-statically-unprovable"), "warning"),
    );
  });

  it("leaves non-warning Claude-compatibility diagnostics unchanged", () => {
    expectUnchangedDiagnostic(diagnosticForRule(findRule("odw/no-date-now"), "error"));
  });

  it("leaves diagnostics for uncatalogued rules unchanged", () => {
    const diagnostic = Object.freeze({
      ...diagnosticForRule(findRule("odw/meta-required"), "warning"),
      rule: makeRuleId("odw/unlisted-strict-claude-fixture"),
    });

    expectUnchangedDiagnostic(diagnostic);
  });

  it("preserves diagnostic payloads and freezes promoted outputs", () => {
    const diagnostic = diagnosticForRule(findRule("odw/no-math-random"), "warning");
    const [promoted] = promoteStrictClaudeSeverity([diagnostic]);

    expect(promoted).toEqual({ ...diagnostic, severity: "error" });
    expect(promoted).not.toBe(diagnostic);
    expect(promoted?.span).toBe(diagnostic.span);
    expect(promoted?.docs).toBe(diagnostic.docs);
    expect(promoted?.suggestions).toBe(diagnostic.suggestions);
    expect(Object.isFrozen(promoted)).toBeTrue();
  });

  it("freezes the output array", () => {
    const result = promoteStrictClaudeSeverity([
      diagnosticForRule(findRule("odw/no-date-now"), "warning"),
    ]);

    expect(Object.isFrozen(result)).toBeTrue();
  });

  it("is idempotent", () => {
    const diagnostics = [
      diagnosticForRule(findRule("odw/no-date-now"), "warning"),
      diagnosticForRule(findRule("odw/meta-required"), "error"),
    ];
    const once = promoteStrictClaudeSeverity(diagnostics);

    expect(promoteStrictClaudeSeverity(once)).toEqual(once);
  });

  it("promotes exactly catalogue-backed Claude-compatibility warnings", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RULE_CATALOGUE),
        fc.constantFrom("error", "warning", "info", "hint" satisfies DiagnosticSeverity),
        (rule, severity) => {
          const diagnostic = diagnosticForRule(rule, severity);
          const once = promoteStrictClaudeSeverity([diagnostic]);
          const twice = promoteStrictClaudeSeverity(once);
          const [actual] = once;
          const shouldPromote =
            rule.category === STRICT_CLAUDE_PROMOTION_POLICY.category &&
            diagnostic.severity === STRICT_CLAUDE_PROMOTION_POLICY.fromSeverity;

          expect(twice).toEqual(once);
          expect(actual?.severity).toBe(
            shouldPromote ? STRICT_CLAUDE_PROMOTION_POLICY.toSeverity : diagnostic.severity,
          );

          if (shouldPromote) {
            expect(actual).toEqual({ ...diagnostic, severity: "error" });
            expect(actual).not.toBe(diagnostic);
          } else {
            expect(actual).toBe(diagnostic);
          }
        },
      ),
    );
  });
});
