/**
 * @file Typed catalogue of ODW lint rule metadata.
 *
 * This module is the production source of truth for rule identifiers,
 * categories, default severities, configuration keys, documentation slugs, and
 * release status. Keep it inert: importing the catalogue must never evaluate
 * workflow source or ODW runtime code.
 */

import { makeRuleId, type RuleId } from "./rule-id";
import type { DiagnosticSeverity } from "./severity";

/**
 * Rule families used by documentation, configuration, and diagnostic output.
 */
export const RULE_CATEGORIES = Object.freeze([
  "dialect",
  "claude-compatibility",
  "orchestration-risk",
] as const);

/**
 * Rule families used by documentation, configuration, and diagnostic output.
 */
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

/**
 * Lifecycle states for rules in the public catalogue.
 */
export const RULE_RELEASE_STATUSES = Object.freeze(["planned", "released"] as const);

/**
 * Lifecycle states for rules in the public catalogue.
 */
export type RuleReleaseStatus = (typeof RULE_RELEASE_STATUSES)[number];

/**
 * Complete metadata for one diagnostic rule.
 */
export type RuleDefinition = {
  /** Stable diagnostic rule identifier. */
  readonly id: RuleId;
  /** User-facing taxonomy bucket for this rule. */
  readonly category: RuleCategory;
  /** Severity used before caller configuration overrides apply. */
  readonly defaultSeverity: DiagnosticSeverity;
  /** Configuration key used to override this rule. */
  readonly configKey: RuleId;
  /** Markdown page slug under `docs/rules/`. */
  readonly docsSlug: string;
  /** Whether current checker code may emit this rule. */
  readonly releaseStatus: RuleReleaseStatus;
};

/** Builds one rule definition from trusted literal metadata. */
const ruleDefinition = (
  id: string,
  category: RuleCategory,
  defaultSeverity: DiagnosticSeverity,
  releaseStatus: RuleReleaseStatus,
): RuleDefinition => {
  const ruleId = makeRuleId(id);

  return Object.freeze({
    id: ruleId,
    category,
    defaultSeverity,
    configKey: ruleId,
    docsSlug: id.slice("odw/".length),
    releaseStatus,
  });
};

/**
 * Production rule metadata in the reviewed taxonomy order.
 */
export const RULE_CATALOGUE = Object.freeze([
  ruleDefinition("odw/meta-required", "dialect", "error", "released"),
  ruleDefinition("odw/meta-object", "dialect", "error", "released"),
  ruleDefinition("odw/meta-statically-unprovable", "dialect", "warning", "released"),
  ruleDefinition("odw/meta-name", "dialect", "error", "released"),
  ruleDefinition("odw/meta-description", "dialect", "error", "released"),
  ruleDefinition("odw/no-import-export", "dialect", "error", "released"),
  ruleDefinition("odw/body-syntax", "dialect", "error", "released"),
  ruleDefinition("odw/claude-pure-meta", "claude-compatibility", "warning", "released"),
  ruleDefinition("odw/no-date-now", "claude-compatibility", "warning", "released"),
  ruleDefinition("odw/no-math-random", "claude-compatibility", "warning", "released"),
  ruleDefinition("odw/no-argless-new-date", "claude-compatibility", "warning", "released"),
  ruleDefinition("odw/no-odw-only-validate", "claude-compatibility", "info", "released"),
  ruleDefinition("odw/bounded-loop", "orchestration-risk", "warning", "planned"),
  ruleDefinition("odw/bounded-fanout", "orchestration-risk", "warning", "planned"),
  ruleDefinition("odw/no-promise-race", "orchestration-risk", "warning", "planned"),
  ruleDefinition("odw/schema-for-structured-agent", "orchestration-risk", "info", "planned"),
  ruleDefinition("odw/worktree-isolation-note", "orchestration-risk", "info", "planned"),
] as const satisfies readonly RuleDefinition[]);

/**
 * Every catalogued rule identifier, in taxonomy order.
 */
export const RULE_IDS = Object.freeze(RULE_CATALOGUE.map((rule) => rule.id));

/**
 * Rule identifiers that current checker implementations may emit.
 */
export const RELEASED_RULE_IDS = Object.freeze(
  RULE_CATALOGUE.filter((rule) => rule.releaseStatus === "released").map((rule) => rule.id),
);

/**
 * Rule identifiers reserved by design but not yet emitted by the checker.
 */
export const PLANNED_RULE_IDS = Object.freeze(
  RULE_CATALOGUE.filter((rule) => rule.releaseStatus === "planned").map((rule) => rule.id),
);

/**
 * Returns the repository-relative documentation page path for a rule.
 *
 * @param rule Catalogued rule definition.
 * @returns Markdown page path under `docs/rules/`.
 */
export const ruleDocsPath = (rule: RuleDefinition): `docs/rules/${string}.md` => {
  return `docs/rules/${rule.docsSlug}.md`;
};
