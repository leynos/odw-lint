/**
 * @file Claude compatibility scanner for deterministic-time hazards.
 *
 * The scanner parses a normalized workflow body and walks the SWC AST looking
 * for syntactic `Date.now()`, `Math.random()`, and arg-less `new Date` uses. It
 * never executes workflow source.
 */

import type { CallExpression, MemberExpression, NewExpression, Node, Span } from "@swc/core";
import type { RuleDefinition } from "../diagnostics/rule-catalogue";
import {
  firstReviewedRuleMessage,
  ruleDefinitionFor,
  ruleDocsPath,
} from "../diagnostics/rule-catalogue";
import type { RuleId } from "../diagnostics/rule-id";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic } from "../diagnostics/types";
import type { WorkflowEnvelope } from "./types";
import {
  type NormalizedWorkflowBody,
  originalSpanFromNormalizedOffsets,
} from "./workflow-body-normalizer";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";

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

  const diagnostics = walkDeterministicTimeHazards(parseResult.module).map((match) => {
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
const walkDeterministicTimeHazards = (root: Node): readonly HazardMatch[] => {
  const matches: HazardMatch[] = [];

  visitNode(root, matches);

  return matches;
};

/** Visits one SWC node before its children so emitted diagnostics follow source order. */
const visitNode = (node: Node, matches: HazardMatch[]): void => {
  const match = matchDeterministicTimeHazard(node);

  if (match !== undefined) {
    matches.push(match);
  }

  for (const child of childValues(node)) {
    visitChildValue(child, matches);
  }
};

/** Visits nested SWC nodes, including wrappers such as call arguments. */
const visitChildValue = (value: unknown, matches: HazardMatch[]): void => {
  if (isNode(value)) {
    visitNode(value, matches);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitChildValue(item, matches);
    }
    return;
  }

  if (isObjectRecord(value)) {
    for (const child of childRecordValues(value)) {
      visitChildValue(child, matches);
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
const matchDeterministicTimeHazard = (node: Node): HazardMatch | undefined => {
  if (isDateNowCall(node)) {
    return { rule: DATE_NOW_RULE, span: node.callee.span };
  }

  if (isMathRandomCall(node)) {
    return { rule: MATH_RANDOM_RULE, span: node.callee.span };
  }

  if (isArglessNewDate(node)) {
    return { rule: ARGLESS_NEW_DATE_RULE, span: node.span };
  }

  return undefined;
};

/** Reports `Date.now(...)` calls, but not bare or computed references. */
const isDateNowCall = (node: Node): node is CallExpression & { callee: MemberExpression } => {
  return isNamedMemberCall(node, "Date", "now");
};

/** Reports `Math.random(...)` calls, but not bare or computed references. */
const isMathRandomCall = (node: Node): node is CallExpression & { callee: MemberExpression } => {
  return isNamedMemberCall(node, "Math", "random");
};

/** Reports `new Date` and `new Date()`, but not `new Date(value)`. */
const isArglessNewDate = (node: Node): node is NewExpression => {
  return (
    isNewExpression(node) &&
    isIdentifierWithValue(node.callee, "Date") &&
    (node.arguments === undefined || node.arguments === null || node.arguments.length === 0)
  );
};

/** Reports non-computed named member calls such as `Date.now()`. */
const isNamedMemberCall = (
  node: Node,
  objectName: string,
  propertyName: string,
): node is CallExpression & { callee: MemberExpression } => {
  return (
    isCallExpression(node) &&
    isMemberExpression(node.callee) &&
    isIdentifierWithValue(node.callee.object, objectName) &&
    isIdentifierWithValue(node.callee.property, propertyName)
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

/** Narrows values to SWC identifiers with the expected text. */
const isIdentifierWithValue = (value: unknown, expectedValue: string): boolean => {
  return (
    isNode(value) &&
    value.type === "Identifier" &&
    "value" in value &&
    value.value === expectedValue
  );
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

  return Object.freeze({
    file: envelope.sourceFile.filePath,
    rule: match.rule,
    severity: rule.defaultSeverity,
    message: firstReviewedRuleMessage(rule),
    span: originalSpanFromNormalizedOffsets(
      envelope.sourceFile,
      normalized,
      match.span.start - moduleBase,
      match.span.end - moduleBase,
    ),
    docs: ruleDocsPath(rule),
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
