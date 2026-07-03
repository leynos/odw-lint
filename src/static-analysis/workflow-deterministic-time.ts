/**
 * @file Claude compatibility scanner for deterministic-time hazards.
 *
 * The scanner parses a normalized workflow body and walks the SWC AST looking
 * for global `Date.now()`, `Math.random()`, and arg-less `new Date` uses. It
 * ignores workflow-local shadows and never executes workflow source.
 */

import type { CallExpression, MemberExpression, NewExpression, Node, Span } from "@swc/core";
import type { RuleDefinition } from "../diagnostics/rule-catalogue";
import { firstReviewedRuleMessage, ruleDefinitionFor } from "../diagnostics/rule-catalogue";
import { createRuleDiagnostic } from "../diagnostics/rule-diagnostic";
import type { RuleId } from "../diagnostics/rule-id";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic } from "../diagnostics/types";
import type { WorkflowEnvelope } from "./types";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
import { collectLexicalBindings } from "./workflow-ast-bindings";
import {
  type NormalizedWorkflowBody,
  originalSpanFromNormalizedOffsets,
} from "./workflow-body-normalizer";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";
import {
  resolveGlobalObjectIdentity,
  resolveStaticMemberName,
} from "./workflow-global-object-reference";

const DATE_NOW_RULE = makeRuleId("odw/no-date-now");
const MATH_RANDOM_RULE = makeRuleId("odw/no-math-random");
const ARGLESS_NEW_DATE_RULE = makeRuleId("odw/no-argless-new-date");
type HazardMatch = {
  readonly rule: RuleId;
  readonly span: Span;
};

const RULE_DEFINITIONS = Object.freeze(
  new Map<RuleId, RuleDefinition>([
    [DATE_NOW_RULE, ruleDefinitionFor(DATE_NOW_RULE)],
    [MATH_RANDOM_RULE, ruleDefinitionFor(MATH_RANDOM_RULE)],
    [ARGLESS_NEW_DATE_RULE, ruleDefinitionFor(ARGLESS_NEW_DATE_RULE)],
  ]),
);

/**
 * Emits Claude-compatibility warnings for wall-clock and randomness primitives.
 *
 * @param envelope - Scanned workflow envelope with an original-source body.
 * @param parseResult - Optional already-normalized body parse to reuse.
 * @returns Frozen diagnostics, or an empty list when the body cannot parse.
 */
export const scanDeterministicTimeWarnings = (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult = parseNormalizedWorkflowBody(envelope),
): readonly Diagnostic[] => {
  if (!parseResult.ok) {
    return Object.freeze([]);
  }

  const bindings = collectLexicalBindings(parseResult.module);
  const diagnostics = walkDeterministicTimeHazards(parseResult.module, bindings).map((match) => {
    return diagnosticForMatch(
      envelope,
      parseResult.normalized,
      parseResult.module.span.start,
      match,
    );
  });

  return Object.freeze(diagnostics);
};

/** Recursively walks a SWC AST in source order and returns hazard matches. */
const walkDeterministicTimeHazards = (
  root: Node,
  bindings: LexicalBindingFacts,
): readonly HazardMatch[] => {
  const matches: HazardMatch[] = [];

  visitNode(root, bindings, matches);

  return matches;
};

/** Visits one SWC node before its children so emitted diagnostics follow source order. */
const visitNode = (node: Node, bindings: LexicalBindingFacts, matches: HazardMatch[]): void => {
  const match = matchDeterministicTimeHazard(node, bindings);

  if (match !== undefined) {
    matches.push(match);
  }

  for (const child of childValues(node)) {
    visitChildValue(child, bindings, matches);
  }
};

/** Visits nested SWC nodes, including wrappers such as call arguments. */
const visitChildValue = (
  value: unknown,
  bindings: LexicalBindingFacts,
  matches: HazardMatch[],
): void => {
  if (isNode(value)) {
    visitNode(value, bindings, matches);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitChildValue(item, bindings, matches);
    }
    return;
  }

  if (isObjectRecord(value)) {
    for (const child of childRecordValues(value)) {
      visitChildValue(child, bindings, matches);
    }
  }
};

/** Returns child fields that may contain nested SWC nodes. */
const childValues = (node: Node): readonly unknown[] => {
  return childRecordValues(node);
};

/** Returns object field values that can contain semantic child nodes. */
const childRecordValues = (value: object): readonly unknown[] => {
  return Object.entries(value)
    .filter(([key]) => isTraversableChildKey(key))
    .map(([, value]) => value);
};

/** Excludes scalar SWC bookkeeping fields from recursive traversal. */
const isTraversableChildKey = (key: string): boolean => {
  return key !== "span" && key !== "type" && key !== "ctxt";
};

/** Matches one of the syntactic deterministic-time hazards on a node. */
const matchDeterministicTimeHazard = (
  node: Node,
  bindings: LexicalBindingFacts,
): HazardMatch | undefined => {
  if (isDateNowCall(node, bindings)) {
    return { rule: DATE_NOW_RULE, span: node.callee.span };
  }

  if (isMathRandomCall(node, bindings)) {
    return { rule: MATH_RANDOM_RULE, span: node.callee.span };
  }

  if (isArglessNewDate(node, bindings)) {
    return { rule: ARGLESS_NEW_DATE_RULE, span: node.span };
  }

  return undefined;
};

/** Reports global `Date.now(...)` calls, including string-key and `globalThis` forms. */
const isDateNowCall = (
  node: Node,
  bindings: LexicalBindingFacts,
): node is CallExpression & { callee: MemberExpression } => {
  return isGlobalMemberCall(node, bindings, "Date", "now");
};

/** Reports global `Math.random(...)` calls, including string-key and `globalThis` forms. */
const isMathRandomCall = (
  node: Node,
  bindings: LexicalBindingFacts,
): node is CallExpression & { callee: MemberExpression } => {
  return isGlobalMemberCall(node, bindings, "Math", "random");
};

/** Reports global `new Date` and `new Date()`, but not `new Date(value)`. */
const isArglessNewDate = (node: Node, bindings: LexicalBindingFacts): node is NewExpression => {
  return (
    isNewExpression(node) &&
    resolveGlobalObjectIdentity(node.callee, bindings) === "Date" &&
    (node.arguments === undefined || node.arguments === null || node.arguments.length === 0)
  );
};

/** Reports calls on recognized global objects and static member names. */
const isGlobalMemberCall = (
  node: Node,
  bindings: LexicalBindingFacts,
  objectName: string,
  propertyName: string,
): node is CallExpression & { callee: MemberExpression } => {
  return (
    isCallExpression(node) &&
    isMemberExpression(node.callee) &&
    resolveGlobalObjectIdentity(node.callee.object, bindings) === objectName &&
    resolveStaticMemberName(node.callee.property) === propertyName
  );
};

/** Narrows nodes to SWC call expressions. */
const isCallExpression = (node: Node): node is CallExpression => {
  return node.type === "CallExpression";
};

/** Narrows nodes to SWC constructor expressions. */
const isNewExpression = (node: Node): node is NewExpression => {
  return node.type === "NewExpression";
};

/** Narrows values to SWC member expressions. */
const isMemberExpression = (value: unknown): value is MemberExpression => {
  return isNode(value) && value.type === "MemberExpression";
};

/** Narrows values to plain SWC node-shaped objects. */
const isNode = (value: unknown): value is Node => {
  return typeof value === "object" && value !== null && "type" in value;
};

/** Narrows values to object records that may wrap SWC nodes. */
const isObjectRecord = (value: unknown): value is object => {
  return typeof value === "object" && value !== null;
};

/** Builds a project diagnostic for one matched AST span. */
const diagnosticForMatch = (
  envelope: WorkflowEnvelope,
  normalized: NormalizedWorkflowBody,
  moduleBase: number,
  match: HazardMatch,
): Diagnostic => {
  const rule = definitionFor(match.rule);

  return createRuleDiagnostic({
    file: envelope.sourceFile.filePath,
    rule,
    severity: rule.defaultSeverity,
    message: firstReviewedRuleMessage(rule),
    span: originalSpanFromNormalizedOffsets(
      envelope.sourceFile,
      normalized,
      match.span.start - moduleBase,
      match.span.end - moduleBase,
    ),
  });
};

/** Returns the preloaded rule definition for a deterministic-time rule. */
const definitionFor = (ruleId: RuleId): RuleDefinition => {
  const rule = RULE_DEFINITIONS.get(ruleId);

  if (rule === undefined) {
    throw new Error(`Missing deterministic-time rule definition for ${String(ruleId)}.`);
  }

  return rule;
};
