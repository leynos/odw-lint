/**
 * @file Typed catalogue of ODW lint rule metadata.
 *
 * This module is the production source of truth for rule identifiers,
 * categories, default severities, configuration keys, documentation slugs,
 * diagnostic messages, and release status. Keep it inert: importing the
 * catalogue must never evaluate workflow source or ODW runtime code.
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
 * Repository-relative Markdown documentation path for one catalogued rule.
 */
export type RuleDocumentationPath = `docs/rules/${string}.md`;
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
  /** Exact diagnostic messages this rule may emit in reviewed fixtures. */
  readonly messages: readonly string[];
  /** Whether current checker code may emit this rule. */
  readonly releaseStatus: RuleReleaseStatus;
};

/** Trusted literal metadata for one rule definition. */
type RuleDefinitionInput = {
  readonly id: string;
  readonly category: RuleCategory;
  readonly defaultSeverity: DiagnosticSeverity;
  readonly releaseStatus: RuleReleaseStatus;
  readonly messages?: readonly string[];
};

/** Builds one rule definition from trusted literal metadata. */
const ruleDefinition = ({
  id,
  category,
  defaultSeverity,
  releaseStatus,
  messages = [],
}: RuleDefinitionInput): RuleDefinition => {
  const ruleId = makeRuleId(id);

  return Object.freeze({
    id: ruleId,
    category,
    defaultSeverity,
    configKey: ruleId,
    docsSlug: id.slice("odw/".length),
    messages: Object.freeze([...messages]),
    releaseStatus,
  });
};

/**
 * Production rule metadata in the reviewed taxonomy order.
 */
export const RULE_CATALOGUE = Object.freeze([
  ruleDefinition({
    id: "odw/meta-required",
    category: "dialect",
    defaultSeverity: "error",
    releaseStatus: "released",
    messages: ["Workflow source must export literal metadata."],
  }),
  ruleDefinition({
    id: "odw/meta-object",
    category: "dialect",
    defaultSeverity: "error",
    releaseStatus: "released",
    messages: [
      "Workflow metadata must be an object literal.",
      "Workflow metadata object literal must be complete.",
    ],
  }),
  ruleDefinition({
    id: "odw/meta-statically-unprovable",
    category: "dialect",
    defaultSeverity: "warning",
    releaseStatus: "released",
    messages: ["Workflow metadata must remain statically provable without evaluation."],
  }),
  ruleDefinition({
    id: "odw/meta-name",
    category: "dialect",
    defaultSeverity: "error",
    releaseStatus: "released",
    messages: ["Workflow metadata must include a non-empty name string."],
  }),
  ruleDefinition({
    id: "odw/meta-description",
    category: "dialect",
    defaultSeverity: "error",
    releaseStatus: "released",
    messages: [
      "Workflow metadata must include a description string.",
      "Workflow metadata description must be a string.",
    ],
  }),
  ruleDefinition({
    id: "odw/no-import-export",
    category: "dialect",
    defaultSeverity: "error",
    releaseStatus: "released",
    messages: ["Workflow body must not add top-level imports or exports."],
  }),
  ruleDefinition({
    id: "odw/body-syntax",
    category: "dialect",
    defaultSeverity: "error",
    releaseStatus: "released",
    messages: ["Workflow body must be syntactically complete after ODW normalization."],
  }),
  ruleDefinition({
    id: "odw/claude-pure-meta",
    category: "claude-compatibility",
    defaultSeverity: "warning",
    releaseStatus: "released",
  }),
  ruleDefinition({
    id: "odw/no-date-now",
    category: "claude-compatibility",
    defaultSeverity: "warning",
    releaseStatus: "released",
  }),
  ruleDefinition({
    id: "odw/no-math-random",
    category: "claude-compatibility",
    defaultSeverity: "warning",
    releaseStatus: "released",
  }),
  ruleDefinition({
    id: "odw/no-argless-new-date",
    category: "claude-compatibility",
    defaultSeverity: "warning",
    releaseStatus: "released",
  }),
  ruleDefinition({
    id: "odw/no-odw-only-validate",
    category: "claude-compatibility",
    defaultSeverity: "info",
    releaseStatus: "released",
  }),
  ruleDefinition({
    id: "odw/bounded-loop",
    category: "orchestration-risk",
    defaultSeverity: "warning",
    releaseStatus: "planned",
  }),
  ruleDefinition({
    id: "odw/bounded-fanout",
    category: "orchestration-risk",
    defaultSeverity: "warning",
    releaseStatus: "planned",
  }),
  ruleDefinition({
    id: "odw/no-promise-race",
    category: "orchestration-risk",
    defaultSeverity: "warning",
    releaseStatus: "planned",
  }),
  ruleDefinition({
    id: "odw/schema-for-structured-agent",
    category: "orchestration-risk",
    defaultSeverity: "info",
    releaseStatus: "planned",
  }),
  ruleDefinition({
    id: "odw/worktree-isolation-note",
    category: "orchestration-risk",
    defaultSeverity: "info",
    releaseStatus: "planned",
  }),
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
export const ruleDocsPath = (rule: RuleDefinition): RuleDocumentationPath => {
  return `docs/rules/${rule.docsSlug}.md`;
};
