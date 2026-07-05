/**
 * @file Tracks bounded deterministic-time aliases in parsed workflow bodies.
 */

import type { CallExpression, Expression, MemberExpression, Module, Node, Span } from "@swc/core";
import type { RuleId } from "../diagnostics/rule-id";
import { isExpression, isIdentifier, isMemberExpression } from "./swc-ast";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
import { rootScopeOwnFacts, type ScopeOwnFacts, scopeOwnFacts } from "./workflow-ast-scopes";
import {
  type GlobalObjectIdentity,
  resolveGlobalObjectIdentity,
  resolveStaticMemberName,
} from "./workflow-global-object-reference";

type GlobalMemberAlias = {
  readonly kind: "member";
  readonly objectName: GlobalObjectIdentity;
  readonly propertyName: string;
  readonly rule: RuleId;
};
type GlobalObjectAlias = {
  readonly kind: "global";
  readonly objectName: GlobalObjectIdentity;
};
type DeterministicTimeAlias = GlobalMemberAlias | GlobalObjectAlias;

export type DeterministicTimeAliases = ReadonlyMap<string, DeterministicTimeAlias>;

export type DeterministicTimeAliasRules = {
  readonly dateNowRule: RuleId;
  readonly mathRandomRule: RuleId;
};

export type AliasHazardMatch = {
  readonly rule: RuleId;
  readonly span: Span;
};

/**
 * Builds aliases owned by the root scope of a parsed workflow body.
 *
 * Alias handling is deliberately bounded to direct declarations. Chained alias
 * inference would need scope-sensitive invalidation to avoid surprising false
 * positives.
 *
 * @param module - Parsed SWC module for a normalized workflow body.
 * @param rootBindings - Lexical binding facts visible in the root scope.
 * @param rules - Rule identifiers to attach to direct member alias calls.
 * @returns Direct alias facts visible in the root scope.
 */
export const rootAliasView = (
  module: Module,
  rootBindings: LexicalBindingFacts,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAliases => {
  return aliasViewForOwnFacts(new Map(), rootScopeOwnFacts(module), rootBindings, rules);
};

/**
 * Enters a child alias scope when `node` opens one for this analysis.
 *
 * @param parentAliases - Alias facts visible before `node`.
 * @param childBindings - Lexical binding facts visible inside `node`.
 * @param node - Candidate SWC node being entered by the scanner walk.
 * @param rules - Rule identifiers to attach to direct member alias calls.
 * @returns A child alias view for scope-opening nodes, otherwise `parentAliases`.
 */
export const enterAliasScope = (
  parentAliases: DeterministicTimeAliases,
  childBindings: LexicalBindingFacts,
  node: Node,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAliases => {
  return enterAliasScopeWithOwnFacts(parentAliases, childBindings, scopeOwnFacts(node), rules);
};

/**
 * Enters a child alias scope from facts already computed for one scanner node.
 *
 * @param parentAliases - Alias facts visible before the scanner node.
 * @param childBindings - Lexical binding facts visible inside the scanner node.
 * @param facts - Scope-owned facts for the scanner node.
 * @param rules - Rule identifiers to attach to direct member alias calls.
 * @returns A child alias view for non-empty scope facts, otherwise
 * `parentAliases`.
 */
export const enterAliasScopeWithOwnFacts = (
  parentAliases: DeterministicTimeAliases,
  childBindings: LexicalBindingFacts,
  facts: ScopeOwnFacts,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAliases => {
  if (facts.ownNames.length === 0 && facts.ownInitializers.length === 0) {
    return parentAliases;
  }

  return aliasViewForOwnFacts(parentAliases, facts, childBindings, rules);
};
/**
 * Matches calls through a direct deterministic member alias.
 *
 * @param node - SWC node to classify as a possible alias call.
 * @param aliases - Alias facts collected from the parsed workflow body.
 * @returns A hazard match when `node` calls a deterministic member alias.
 */
export const aliasCallMatch = (
  node: Node,
  aliases: DeterministicTimeAliases,
): AliasHazardMatch | undefined => {
  if (!isCallExpression(node) || !isIdentifier(node.callee)) {
    return undefined;
  }

  const alias = aliases.get(node.callee.value);

  return alias?.kind === "member" ? { rule: alias.rule, span: node.callee.span } : undefined;
};

/**
 * Resolves global identities through both direct globals and direct aliases.
 *
 * @param expression - SWC expression to classify.
 * @param bindings - Lexical binding facts for the parsed workflow body.
 * @param aliases - Alias facts collected from the parsed workflow body.
 * @returns `"Date"`, `"Math"`, `"globalThis"`, or `undefined`.
 */
export const objectIdentityForExpression = (
  expression: Expression,
  bindings: LexicalBindingFacts,
  aliases: DeterministicTimeAliases,
): GlobalObjectIdentity | undefined => {
  const identity = resolveGlobalObjectIdentity(expression, bindings);
  if (identity !== undefined) {
    return identity;
  }

  if (!isIdentifier(expression)) {
    return undefined;
  }

  const alias = aliases.get(expression.value);
  return alias?.kind === "global" ? alias.objectName : undefined;
};

/**
 * Unwraps call callees that SWC wraps for optional chaining.
 *
 * @param node - SWC node to classify as a possible member call.
 * @returns A member expression when `node` is a direct or optional member call.
 */
export const memberExpressionFromCall = (node: Node): MemberExpression | undefined => {
  if (!isCallExpression(node) || !isExpression(node.callee)) {
    return undefined;
  }

  return memberExpressionFromExpression(node.callee);
};

/** Builds one scope's alias view by shadowing and adding owned aliases. */
const aliasViewForOwnFacts = (
  parentAliases: DeterministicTimeAliases,
  facts: ScopeOwnFacts,
  bindings: LexicalBindingFacts,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAliases => {
  const aliases = new Map(parentAliases);

  for (const name of facts.ownNames) {
    aliases.delete(name);
  }

  for (const initializer of facts.ownInitializers) {
    const alias = aliasForExpression(initializer.init, bindings, rules);
    if (alias !== undefined) {
      aliases.set(initializer.name, alias);
    }
  }

  return aliases;
};

/** Classifies direct global-object and deterministic member aliases. */
const aliasForExpression = (
  expression: Expression,
  bindings: LexicalBindingFacts,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAlias | undefined => {
  const member = memberExpressionFromExpression(expression);
  if (member !== undefined) {
    return memberAliasForExpression(member, bindings, rules);
  }

  const objectName = resolveGlobalObjectIdentity(expression, bindings);
  return objectName === undefined ? undefined : { kind: "global", objectName };
};

/** Classifies `Date.now` and `Math.random` aliases. */
const memberAliasForExpression = (
  member: MemberExpression,
  bindings: LexicalBindingFacts,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAlias | undefined => {
  const objectName = resolveGlobalObjectIdentity(member.object, bindings);
  const propertyName = resolveStaticMemberName(member.property);

  if (objectName === "Date" && propertyName === "now") {
    return { kind: "member", objectName, propertyName, rule: rules.dateNowRule };
  }

  if (objectName === "Math" && propertyName === "random") {
    return { kind: "member", objectName, propertyName, rule: rules.mathRandomRule };
  }

  return undefined;
};

/** Unwraps expressions that can carry a member access without changing it. */
const memberExpressionFromExpression = (expression: Expression): MemberExpression | undefined => {
  if (isMemberExpression(expression)) {
    return expression;
  }

  if (expression.type === "OptionalChainingExpression" && isExpression(expression.base)) {
    return memberExpressionFromExpression(expression.base);
  }

  return undefined;
};

/** Narrows nodes to SWC call expressions. */
const isCallExpression = (node: Node): node is CallExpression => {
  return node.type === "CallExpression";
};
