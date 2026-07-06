/**
 * @file Rule catalogue contract tests.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import {
  createMessageTemplate,
  DIAGNOSTIC_SEVERITIES,
  findRuleDefinition,
  firstReviewedRuleMessage,
  type MessageTemplate,
  makeRuleId,
  messageMatchesTemplate,
  PLANNED_RULE_IDS,
  RELEASED_RULE_IDS,
  RULE_CATALOGUE,
  RULE_CATEGORIES,
  RULE_IDS,
  RULE_RELEASE_STATUSES,
  type RuleCategory,
  type RuleDefinition,
  type RuleId,
  type RuleReleaseStatus,
  reviewedRuleMessage,
  ruleAllowsMessage,
  ruleDefinitionFor,
  ruleDocsPath,
} from "odw-lint";
import { firstReviewedRuleTemplate } from "../../src/diagnostics/rule-catalogue";

const EXPECTED_RULE_ROWS = [
  [
    "odw/meta-required",
    "dialect",
    "error",
    "meta-required",
    ["Workflow source must export literal metadata."],
    "released",
  ],
  [
    "odw/meta-object",
    "dialect",
    "error",
    "meta-object",
    [
      "Workflow metadata must be an object literal.",
      "Workflow metadata object literal must be complete.",
    ],
    "released",
  ],
  [
    "odw/meta-statically-unprovable",
    "dialect",
    "warning",
    "meta-statically-unprovable",
    ["Workflow metadata must remain statically provable without evaluation."],
    "released",
  ],
  [
    "odw/meta-name",
    "dialect",
    "error",
    "meta-name",
    ["Workflow metadata must include a non-empty name string."],
    "released",
  ],
  [
    "odw/meta-description",
    "dialect",
    "error",
    "meta-description",
    [
      "Workflow metadata must include a description string.",
      "Workflow metadata description must be a string.",
    ],
    "released",
  ],
  [
    "odw/no-import-export",
    "dialect",
    "error",
    "no-import-export",
    ["Workflow body must not add top-level imports or exports."],
    "released",
  ],
  [
    "odw/body-syntax",
    "dialect",
    "error",
    "body-syntax",
    ["Workflow body must be syntactically complete after ODW normalization."],
    "released",
  ],
  [
    "odw/claude-pure-meta",
    "claude-compatibility",
    "warning",
    "claude-pure-meta",
    [
      "Workflow metadata is not a pure literal, which Claude Code rejects because its static workflow reader cannot evaluate computed metadata.",
    ],
    "released",
  ],
  [
    "odw/no-date-now",
    "claude-compatibility",
    "warning",
    "no-date-now",
    [
      "Workflow calls Date.now(), which Claude Code rejects because it breaks deterministic run resumption.",
    ],
    "released",
  ],
  [
    "odw/no-math-random",
    "claude-compatibility",
    "warning",
    "no-math-random",
    [
      "Workflow calls Math.random(), which Claude Code rejects because it breaks deterministic run resumption.",
    ],
    "released",
  ],
  [
    "odw/no-argless-new-date",
    "claude-compatibility",
    "warning",
    "no-argless-new-date",
    [
      "Workflow constructs new Date() without arguments, which Claude Code rejects because it breaks deterministic run resumption.",
    ],
    "released",
  ],
  [
    "odw/no-odw-only-validate",
    "claude-compatibility",
    "info",
    "no-odw-only-validate",
    [
      "Workflow calls ODW-only validate(source), which Claude Code cannot run because the validate primitive is injected only by the ODW loader.",
    ],
    "released",
  ],
  ["odw/bounded-loop", "orchestration-risk", "warning", "bounded-loop", [], "planned"],
  ["odw/bounded-fanout", "orchestration-risk", "warning", "bounded-fanout", [], "planned"],
  ["odw/no-promise-race", "orchestration-risk", "warning", "no-promise-race", [], "planned"],
  [
    "odw/schema-for-structured-agent",
    "orchestration-risk",
    "info",
    "schema-for-structured-agent",
    [],
    "planned",
  ],
  [
    "odw/worktree-isolation-note",
    "orchestration-risk",
    "info",
    "worktree-isolation-note",
    [],
    "planned",
  ],
] as const;

const RULE_IDS_WITH_INVALID_FIXTURE_DIAGNOSTICS = Object.freeze([
  "odw/meta-required",
  "odw/meta-object",
  "odw/meta-statically-unprovable",
  "odw/meta-name",
  "odw/meta-description",
  "odw/no-import-export",
  "odw/body-syntax",
] as const);

const RULE_IDS_WITH_INVALID_FIXTURE_DIAGNOSTICS_SET = new Set<string>(
  RULE_IDS_WITH_INVALID_FIXTURE_DIAGNOSTICS,
);

/** Returns duplicate values from a string list while preserving first repeats. */
const duplicateValues = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates].sort();
};

/** Converts reviewed readonly rows into the mutable shape expected by matchers. */
const expectedRuleRows = (): (string | string[])[][] => {
  return EXPECTED_RULE_ROWS.map((row) => {
    const [id, category, severity, docsSlug, messages, releaseStatus] = row;

    return [id, category, severity, docsSlug, [...messages], releaseStatus];
  });
};

describe("rule catalogue", () => {
  it("exports the reviewed category and release-status domains", () => {
    expect(RULE_CATEGORIES).toEqual(["dialect", "claude-compatibility", "orchestration-risk"]);
    expect(RULE_RELEASE_STATUSES).toEqual(["planned", "released"]);
    expectTypeOf<RuleCategory>().toEqualTypeOf<(typeof RULE_CATEGORIES)[number]>();
    expectTypeOf<RuleReleaseStatus>().toEqualTypeOf<(typeof RULE_RELEASE_STATUSES)[number]>();

    // @ts-expect-error Rule categories must come from the reviewed domain.
    const invalidCategory: RuleCategory = "security";
    // @ts-expect-error Release status must be one of the reviewed lifecycle states.
    const invalidReleaseStatus: RuleReleaseStatus = "deprecated";
    // @ts-expect-error Rule identifiers must be branded before catalogue use.
    const unbrandedRuleId: RuleId = "odw/meta-required";

    expect([invalidCategory, invalidReleaseStatus, unbrandedRuleId]).toHaveLength(3);
  });

  it("contains the reviewed rule metadata in taxonomy order", () => {
    expect(
      RULE_CATALOGUE.map((rule) => [
        String(rule.id),
        rule.category,
        rule.defaultSeverity,
        rule.docsSlug,
        [...rule.messages],
        rule.releaseStatus,
      ]),
    ).toEqual(expectedRuleRows());
  });

  it("uses rule identifiers as configuration keys", () => {
    for (const rule of RULE_CATALOGUE) {
      expect(Object.isFrozen(rule)).toBeTrue();
      expect(Object.isFrozen(rule.messages)).toBeTrue();
      expect(rule.configKey).toBe(rule.id);
      expect(rule.docsSlug).toBe(String(rule.id).replace("odw/", ""));
      expect(DIAGNOSTIC_SEVERITIES).toContain(rule.defaultSeverity);
    }
  });

  it("supports non-throwing catalogue lookup", () => {
    const metaRequiredRuleId = makeRuleId("odw/meta-required");

    expect(findRuleDefinition(metaRequiredRuleId)?.id).toBe(metaRequiredRuleId);
    expect(findRuleDefinition(makeRuleId("odw/unlisted-rule-fixture"))).toBeUndefined();
  });

  it("records messages for released rules with invalid fixture diagnostics", () => {
    const releasedFixtureRules = RULE_CATALOGUE.filter((rule) => {
      return RULE_IDS_WITH_INVALID_FIXTURE_DIAGNOSTICS_SET.has(String(rule.id));
    });

    expect(releasedFixtureRules.map((rule) => String(rule.id))).toEqual([
      ...RULE_IDS_WITH_INVALID_FIXTURE_DIAGNOSTICS,
    ]);

    for (const rule of releasedFixtureRules) {
      expect(rule.releaseStatus).toBe("released");
      expect(rule.messages.length).toBeGreaterThan(0);
    }
  });

  it("records reviewed message templates for parser-backed rules", () => {
    const bodySyntaxRule = ruleDefinitionFor(makeRuleId("odw/body-syntax"));

    for (const rule of RULE_CATALOGUE) {
      expect(Array.isArray(rule.messageTemplates)).toBeTrue();
      expect(Object.isFrozen(rule.messageTemplates)).toBeTrue();

      if (rule === bodySyntaxRule) {
        expect(rule.messageTemplates).toEqual([createMessageTemplate(BODY_SYNTAX_DETAIL_TEMPLATE)]);
        expect(
          rule.messageTemplates.some((template) =>
            messageMatchesTemplate(
              template,
              "Workflow body must be syntactically complete after ODW normalization: Expected ';'",
            ),
          ),
        ).toBeTrue();
      } else {
        expect(rule.messageTemplates).toEqual([]);
      }
    }

    expectTypeOf<RuleDefinition["messageTemplates"]>().toEqualTypeOf<readonly MessageTemplate[]>();
  });

  it("matches concrete messages against the reviewed rule contract", () => {
    const bodySyntaxRule = ruleDefinitionFor(makeRuleId("odw/body-syntax"));
    const metadataRule = ruleDefinitionFor(makeRuleId("odw/meta-object"));

    expect(
      ruleAllowsMessage(
        bodySyntaxRule,
        "Workflow body must be syntactically complete after ODW normalization: Expected ';'",
      ),
    ).toBeTrue();
    expect(
      ruleAllowsMessage(
        bodySyntaxRule,
        "Workflow body must be syntactically complete after ODW normalization: ",
      ),
    ).toBeFalse();
    expect(
      ruleAllowsMessage(metadataRule, "Workflow metadata must be an object literal."),
    ).toBeTrue();
    expect(ruleAllowsMessage(metadataRule, "Workflow metadata must be an object")).toBeFalse();
  });

  it("derives public rule lists from the catalogue", () => {
    expect(RULE_IDS).toEqual(RULE_CATALOGUE.map((rule) => rule.id));
    expect(RELEASED_RULE_IDS).toEqual(
      RULE_CATALOGUE.filter((rule) => rule.releaseStatus === "released").map((rule) => rule.id),
    );
    expect(PLANNED_RULE_IDS).toEqual(
      RULE_CATALOGUE.filter((rule) => rule.releaseStatus === "planned").map((rule) => rule.id),
    );
  });

  it("keeps rule identifiers, config keys, and docs slugs unique", () => {
    expect(duplicateValues(RULE_CATALOGUE.map((rule) => String(rule.id)))).toEqual([]);
    expect(duplicateValues(RULE_CATALOGUE.map((rule) => String(rule.configKey)))).toEqual([]);
    expect(duplicateValues(RULE_CATALOGUE.map((rule) => rule.docsSlug))).toEqual([]);
  });

  it("builds repository-relative documentation paths", () => {
    expect(ruleDocsPath(RULE_CATALOGUE[0] as RuleDefinition)).toBe("docs/rules/meta-required.md");
    expectTypeOf<(typeof RULE_IDS)[number]>().toEqualTypeOf<RuleId>();
  });

  it("finds rule definitions by catalogued identifier", () => {
    expect(ruleDefinitionFor(makeRuleId("odw/meta-required"))).toBe(RULE_CATALOGUE[0]);
    expect(() => ruleDefinitionFor(makeRuleId("odw/uncatalogued-rule"))).toThrow(
      "Missing diagnostic rule catalogue entry for odw/uncatalogued-rule.",
    );
  });

  it("returns reviewed diagnostic messages by index", () => {
    const metaObjectRule = ruleDefinitionFor(makeRuleId("odw/meta-object"));
    const plannedRule = ruleDefinitionFor(makeRuleId("odw/bounded-loop"));

    expect(firstReviewedRuleMessage(metaObjectRule)).toBe(
      "Workflow metadata must be an object literal.",
    );
    expect(reviewedRuleMessage(metaObjectRule, 1)).toBe(
      "Workflow metadata object literal must be complete.",
    );
    expect(() => firstReviewedRuleMessage(plannedRule)).toThrow(
      "Missing reviewed diagnostic message 0 for odw/bounded-loop.",
    );
  });

  it("returns the first reviewed diagnostic message template", () => {
    const bodySyntaxRule = ruleDefinitionFor(makeRuleId("odw/body-syntax"));
    const plannedRule = ruleDefinitionFor(makeRuleId("odw/bounded-loop"));

    expect(firstReviewedRuleTemplate(bodySyntaxRule)).toEqual(
      createMessageTemplate(BODY_SYNTAX_DETAIL_TEMPLATE),
    );
    expect(() => firstReviewedRuleTemplate(plannedRule)).toThrow(
      "Missing reviewed diagnostic message template 0 for odw/bounded-loop.",
    );
  });
});

const BODY_SYNTAX_DETAIL_TEMPLATE =
  "Workflow body must be syntactically complete after ODW normalization: {detail}";
