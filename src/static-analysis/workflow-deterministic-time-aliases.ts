/**
 * @file Tracks bounded deterministic-time aliases in parsed workflow bodies.
 */

import type {
  CallExpression,
  Expression,
  Identifier,
  MemberExpression,
  Module,
  Node,
  Span,
  VariableDeclarator,
} from "@swc/core";
import type { RuleId } from "../diagnostics/rule-id";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
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
 * Collects direct aliases such as `const now = Date.now` and `const D = Date`.
 *
 * Alias handling is deliberately bounded to direct declarations. Chained alias
 * inference would need scope-sensitive invalidation to avoid surprising false
 * positives.
 *
 * @param module - Parsed SWC module for a normalized workflow body.
 * @param bindings - Lexical binding facts for the parsed workflow body.
 * @param rules - Rule identifiers to attach to direct member alias calls.
 * @returns Direct alias facts keyed by the declared alias name.
 */
export const collectDeterministicTimeAliases = (
  module: Module,
  bindings: LexicalBindingFacts,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAliases => {
  const aliases = new Map<string, DeterministicTimeAlias>();

  collectAliasesFromNode(module, bindings, aliases, rules);

  return aliases;
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

/** Walks the parsed body looking for static, direct alias declarations. */
const collectAliasesFromNode = (
  node: Node,
  bindings: LexicalBindingFacts,
  aliases: Map<string, DeterministicTimeAlias>,
  rules: DeterministicTimeAliasRules,
): void => {
  if (isVariableDeclarator(node)) {
    collectAliasFromDeclarator(node, bindings, aliases, rules);
  }

  for (const child of childValues(node)) {
    collectAliasesFromChild(child, bindings, aliases, rules);
  }
};

/** Visits nested fields while collecting aliases. */
const collectAliasesFromChild = (
  value: unknown,
  bindings: LexicalBindingFacts,
  aliases: Map<string, DeterministicTimeAlias>,
  rules: DeterministicTimeAliasRules,
): void => {
  if (isNode(value)) {
    collectAliasesFromNode(value, bindings, aliases, rules);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAliasesFromChild(item, bindings, aliases, rules);
    }
  }
};

/** Records one direct deterministic-time alias when the initializer is static. */
const collectAliasFromDeclarator = (
  declarator: VariableDeclarator,
  bindings: LexicalBindingFacts,
  aliases: Map<string, DeterministicTimeAlias>,
  rules: DeterministicTimeAliasRules,
): void => {
  if (!isIdentifier(declarator.id) || !isExpression(declarator.init)) {
    return;
  }

  const alias = aliasForExpression(declarator.init, bindings, rules);
  if (alias !== undefined) {
    aliases.set(declarator.id.value, alias);
  }
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

/** Returns object field values that can contain semantic child nodes. */
const childValues = (node: Node): readonly unknown[] => {
  return Object.entries(node)
    .filter(([key]) => key !== "span" && key !== "type" && key !== "ctxt")
    .map(([, value]) => value);
};

/** Narrows nodes to SWC call expressions. */
const isCallExpression = (node: Node): node is CallExpression => {
  return node.type === "CallExpression";
};

/** Narrows values to SWC variable declarators. */
const isVariableDeclarator = (node: Node): node is VariableDeclarator => {
  return node.type === "VariableDeclarator";
};

/** Narrows values to SWC identifier expressions and patterns. */
const isIdentifier = (value: unknown): value is Identifier => {
  return isNode(value) && value.type === "Identifier";
};

/** Narrows values to SWC member expressions. */
const isMemberExpression = (value: unknown): value is MemberExpression => {
  return isNode(value) && value.type === "MemberExpression";
};

/** Narrows unknown values to SWC expression-shaped objects. */
const isExpression = (value: unknown): value is Expression => {
  return isNode(value);
};

/** Narrows values to plain SWC node-shaped objects. */
const isNode = (value: unknown): value is Node => {
  return typeof value === "object" && value !== null && "type" in value;
};
