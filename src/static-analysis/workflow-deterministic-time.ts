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
import { traverseAstSubtree } from "./swc-ast";
import type { WorkflowEnvelope } from "./types";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
import { enterScope, rootScopeView } from "./workflow-ast-scopes";
import {
  type NormalizedWorkflowBody,
  originalSpanFromNormalizedOffsets,
} from "./workflow-body-normalizer";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";
import {
  aliasCallMatch,
  type DeterministicTimeAliases,
  type DeterministicTimeAliasRules,
  enterAliasScope,
  memberExpressionFromCall,
  objectIdentityForExpression,
  rootAliasView,
} from "./workflow-deterministic-time-aliases";
import { resolveStaticMemberName } from "./workflow-global-object-reference";

const DATE_NOW_RULE = makeRuleId("odw/no-date-now");
const MATH_RANDOM_RULE = makeRuleId("odw/no-math-random");
const ARGLESS_NEW_DATE_RULE = makeRuleId("odw/no-argless-new-date");
const ALIAS_RULES: DeterministicTimeAliasRules = {
  dateNowRule: DATE_NOW_RULE,
  mathRandomRule: MATH_RANDOM_RULE,
};
type HazardMatch = {
  readonly rule: RuleId;
  readonly span: Span;
};
type DeterministicTimeContext = {
  readonly bindings: LexicalBindingFacts;
  readonly aliases: DeterministicTimeAliases;
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

  const rootBindings = rootScopeView(parseResult.module);
  const diagnostics = walkDeterministicTimeHazards(parseResult.module, {
    bindings: rootBindings,
    aliases: rootAliasView(parseResult.module, rootBindings, ALIAS_RULES),
  }).map((match) => {
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
  initialContext: DeterministicTimeContext,
): readonly HazardMatch[] => {
  const matches: HazardMatch[] = [];

  traverseAstSubtree(root, initialContext, (node, context) => {
    const match = matchDeterministicTimeHazard(node, context);

    if (match !== undefined) {
      matches.push(match);
    }

    return enterDeterministicTimeScope(context, node);
  });

  return matches;
};

/** Matches one of the syntactic deterministic-time hazards on a node. */
const matchDeterministicTimeHazard = (
  node: Node,
  context: DeterministicTimeContext,
): HazardMatch | undefined => {
  const aliasCall = aliasCallMatch(node, context.aliases);
  if (aliasCall !== undefined) {
    return aliasCall;
  }

  if (isDateNowCall(node, context.bindings, context.aliases)) {
    return { rule: DATE_NOW_RULE, span: node.callee.span };
  }

  if (isMathRandomCall(node, context.bindings, context.aliases)) {
    return { rule: MATH_RANDOM_RULE, span: node.callee.span };
  }

  if (isArglessNewDate(node, context.bindings, context.aliases)) {
    return { rule: ARGLESS_NEW_DATE_RULE, span: node.span };
  }

  return undefined;
};

/** Enters paired binding and alias scopes for one scanner node. */
const enterDeterministicTimeScope = (
  context: DeterministicTimeContext,
  node: Node,
): DeterministicTimeContext => {
  const bindings = enterScope(context.bindings, node);

  return {
    bindings,
    aliases: enterAliasScope(context.aliases, bindings, node, ALIAS_RULES),
  };
};

/** Reports global `Date.now(...)` calls, including string-key and `globalThis` forms. */
const isDateNowCall = (
  node: Node,
  bindings: LexicalBindingFacts,
  aliases: DeterministicTimeAliases,
): node is CallExpression & { callee: MemberExpression } => {
  return isGlobalMemberCall(node, bindings, aliases, "Date", "now");
};

/** Reports global `Math.random(...)` calls, including string-key and `globalThis` forms. */
const isMathRandomCall = (
  node: Node,
  bindings: LexicalBindingFacts,
  aliases: DeterministicTimeAliases,
): node is CallExpression & { callee: MemberExpression } => {
  return isGlobalMemberCall(node, bindings, aliases, "Math", "random");
};

/** Reports global `new Date` and `new Date()`, but not `new Date(value)`. */
const isArglessNewDate = (
  node: Node,
  bindings: LexicalBindingFacts,
  aliases: DeterministicTimeAliases,
): node is NewExpression => {
  return (
    isNewExpression(node) &&
    objectIdentityForExpression(node.callee, bindings, aliases) === "Date" &&
    (node.arguments === undefined || node.arguments === null || node.arguments.length === 0)
  );
};

/** Reports calls on recognized global objects and static member names. */
const isGlobalMemberCall = (
  node: Node,
  bindings: LexicalBindingFacts,
  aliases: DeterministicTimeAliases,
  objectName: string,
  propertyName: string,
): node is CallExpression & { callee: MemberExpression } => {
  const member = memberExpressionFromCall(node);

  return (
    member !== undefined &&
    objectIdentityForExpression(member.object, bindings, aliases) === objectName &&
    resolveStaticMemberName(member.property) === propertyName
  );
};

/** Narrows nodes to SWC constructor expressions. */
const isNewExpression = (node: Node): node is NewExpression => {
  return node.type === "NewExpression";
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
