/**
 * @file Rule catalogue contract tests.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import {
  DIAGNOSTIC_SEVERITIES,
  type MessageTemplate,
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
  ruleDocsPath,
} from "odw-lint";

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
  ["odw/claude-pure-meta", "claude-compatibility", "warning", "claude-pure-meta", [], "released"],
  ["odw/no-date-now", "claude-compatibility", "warning", "no-date-now", [], "released"],
  ["odw/no-math-random", "claude-compatibility", "warning", "no-math-random", [], "released"],
  [
    "odw/no-argless-new-date",
    "claude-compatibility",
    "warning",
    "no-argless-new-date",
    [],
    "released",
  ],
  [
    "odw/no-odw-only-validate",
    "claude-compatibility",
    "info",
    "no-odw-only-validate",
    [],
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

  it("records empty reviewed message templates for current rules", () => {
    for (const rule of RULE_CATALOGUE) {
      expect(Array.isArray(rule.messageTemplates)).toBeTrue();
      expect(Object.isFrozen(rule.messageTemplates)).toBeTrue();
      expect(rule.messageTemplates).toEqual([]);
    }

    expectTypeOf<RuleDefinition["messageTemplates"]>().toEqualTypeOf<readonly MessageTemplate[]>();
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
});
