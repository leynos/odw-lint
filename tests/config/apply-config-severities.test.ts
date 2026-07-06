/**
 * @file Configured diagnostic severity transform tests.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
  applyConfiguredRuleSeverities,
  type ConfiguredRuleSeverity,
  type Diagnostic,
  type DiagnosticSeverity,
  findRuleDefinition,
  makeRuleId,
  promoteStrictClaudeSeverity,
  RULE_CATALOGUE,
  type RuleDefinition,
  type RuleId,
  ruleDocsPath,
} from "odw-lint";

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

describe("configured rule severity application", () => {
  it("overrides a diagnostic severity", () => {
    const diagnostic = diagnosticForRule(findRule("odw/meta-required"), "error");
    const result = applyConfiguredRuleSeverities(
      [diagnostic],
      new Map([[diagnostic.rule, "hint"]]),
    );

    expect(result).toEqual([{ ...diagnostic, severity: "hint" }]);
    expect(result[0]).not.toBe(diagnostic);
    expect(result[0]?.span).toBe(diagnostic.span);
    expect(Object.isFrozen(result[0])).toBeTrue();
  });

  it("suppresses matching diagnostics and leaves others unchanged", () => {
    const suppressed = diagnosticForRule(findRule("odw/meta-required"));
    const kept = diagnosticForRule(findRule("odw/meta-statically-unprovable"));
    const result = applyConfiguredRuleSeverities(
      [suppressed, kept],
      new Map([[suppressed.rule, "off"]]),
    );

    expect(result).toEqual([kept]);
    expect(result[0]).toBe(kept);
  });

  it("leaves diagnostics unchanged when their rule is absent", () => {
    const diagnostic = diagnosticForRule(findRule("odw/meta-required"));
    const result = applyConfiguredRuleSeverities(
      [diagnostic],
      new Map([[makeRuleId("odw/bounded-loop"), "warning"]]),
    );

    expect(result).toEqual([diagnostic]);
    expect(result[0]).toBe(diagnostic);
  });

  it("returns equal-content frozen arrays for empty or missing rules", () => {
    const diagnostics = [diagnosticForRule(findRule("odw/meta-required"))];

    for (const rules of [undefined, new Map<RuleId, ConfiguredRuleSeverity>()]) {
      const result = applyConfiguredRuleSeverities(diagnostics, rules);

      expect(result).toEqual(diagnostics);
      expect(result[0]).toBe(diagnostics[0]);
      expect(Object.isFrozen(result)).toBeTrue();
    }
  });

  it("applies configured warnings before strict-Claude promotion", () => {
    const diagnostic = diagnosticForRule(findRule("odw/no-date-now"), "error");
    const configured = applyConfiguredRuleSeverities(
      [diagnostic],
      new Map([[diagnostic.rule, "warning"]]),
    );

    expect(configured.map((item) => item.severity)).toEqual(["warning"]);
    expect(promoteStrictClaudeSeverity(configured).map((item) => item.severity)).toEqual(["error"]);
  });

  it("keeps suppressed diagnostics absent under strict-Claude promotion", () => {
    const diagnostic = diagnosticForRule(findRule("odw/no-date-now"), "warning");
    const configured = applyConfiguredRuleSeverities(
      [diagnostic],
      new Map([[diagnostic.rule, "off"]]),
    );

    expect(configured).toEqual([]);
    expect(promoteStrictClaudeSeverity(configured)).toEqual([]);
  });
});

describe("configured rule severity application properties", () => {
  it("suppresses off rules and applies every remaining override exactly", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...RULE_CATALOGUE), { minLength: 0, maxLength: 12 }),
        configuredRuleSettings(),
        (rules, settings) => {
          const diagnostics = rules.map((rule) => diagnosticForRule(rule));
          const configuredRules = new Map(settings);
          const result = applyConfiguredRuleSeverities(diagnostics, configuredRules);
          const offRules = new Set(
            settings.filter(([, setting]) => setting === "off").map(([ruleId]) => ruleId),
          );

          expect(result.every((diagnostic) => !offRules.has(diagnostic.rule))).toBeTrue();

          for (const diagnostic of result) {
            const override = configuredRules.get(diagnostic.rule);

            if (override !== undefined && override !== "off") {
              expect(diagnostic.severity).toBe(override);
            }
          }
        },
      ),
      { seed: 3_321 },
    );
  });
});

/** Builds arbitrary configuration entries from catalogued rules. */
const configuredRuleSettings = (): fc.Arbitrary<
  readonly (readonly [RuleId, ConfiguredRuleSeverity])[]
> => {
  return fc.uniqueArray(
    fc.tuple(
      fc.constantFrom(...RULE_CATALOGUE.map((rule) => rule.id)),
      fc.constantFrom<ConfiguredRuleSeverity>("error", "warning", "info", "hint", "off"),
    ),
    {
      selector: ([ruleId]) => ruleId,
      maxLength: 8,
    },
  );
};
