/**
 * @file Resolves global object references from workflow body expressions.
 */

import type { Expression, Identifier, MemberExpression, Node } from "@swc/core";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
import { isIdentifierBound } from "./workflow-ast-bindings";

const GLOBAL_OBJECT_IDENTITIES = Object.freeze(["Date", "Math", "globalThis"] as const);
export type GlobalObjectIdentity = (typeof GLOBAL_OBJECT_IDENTITIES)[number];
type TransparentWrapperExpression = Expression & {
  readonly expression: Expression;
};

const TRANSPARENT_WRAPPER_TYPES = Object.freeze([
  "ParenthesisExpression",
  "TsAsExpression",
  "TsConstAssertion",
  "TsNonNullExpression",
  "TsSatisfiesExpression",
  "TsTypeAssertion",
] as const);

/**
 * Resolves a static member key from a direct or string-literal computed access.
 *
 * @param property - SWC member-expression property node.
 * @returns The property text when it is statically visible.
 */
export const resolveStaticMemberName = (
  property: MemberExpression["property"],
): string | undefined => {
  if (property.type === "Identifier") {
    return property.value;
  }

  if (property.type === "Computed" && property.expression.type === "StringLiteral") {
    return property.expression.value;
  }

  return undefined;
};

/**
 * Resolves which global object an expression denotes, honouring lexical
 * shadowing for bare identifiers and `globalThis` roots.
 *
 * @param node - SWC expression or node to classify.
 * @param bindings - Lexical binding facts for the parsed workflow body.
 * @returns `"Date"`, `"Math"`, `"globalThis"`, or `undefined`.
 */
export const resolveGlobalObjectIdentity = (
  node: Expression | Node,
  bindings: LexicalBindingFacts,
): GlobalObjectIdentity | undefined => {
  const transparentExpression = innerTransparentExpression(node);
  if (transparentExpression !== undefined) {
    return resolveGlobalObjectIdentity(transparentExpression, bindings);
  }

  if (isIdentifier(node)) {
    return unshadowedGlobalIdentity(node.value, bindings);
  }

  if (!isMemberExpression(node)) {
    return undefined;
  }

  if (resolveGlobalObjectIdentity(node.object, bindings) !== "globalThis") {
    return undefined;
  }

  return globalObjectIdentity(resolveStaticMemberName(node.property));
};

/** Returns a recognized global identity when the bare name is not shadowed. */
const unshadowedGlobalIdentity = (
  name: string,
  bindings: LexicalBindingFacts,
): GlobalObjectIdentity | undefined => {
  if (isIdentifierBound(bindings, name)) {
    return undefined;
  }

  return globalObjectIdentity(name);
};

/** Narrows static text to the global roots this scanner intentionally supports. */
const globalObjectIdentity = (name: string | undefined): GlobalObjectIdentity | undefined => {
  if (name === undefined) {
    return undefined;
  }

  return isGlobalObjectIdentity(name) ? name : undefined;
};

/** Checks the small supported global-root vocabulary. */
const isGlobalObjectIdentity = (name: string): name is GlobalObjectIdentity => {
  return GLOBAL_OBJECT_IDENTITIES.some((identity) => identity === name);
};

/** Returns the inner expression for wrappers that do not change global identity. */
const innerTransparentExpression = (node: Expression | Node): Expression | undefined => {
  if (!isTransparentWrapperExpression(node)) {
    return undefined;
  }

  return node.expression;
};

/** Narrows parenthesized and TypeScript wrapper expressions. */
const isTransparentWrapperExpression = (
  node: Expression | Node,
): node is TransparentWrapperExpression => {
  return (
    TRANSPARENT_WRAPPER_TYPES.some((type) => type === node.type) &&
    "expression" in node &&
    isExpression(node.expression)
  );
};

/** Narrows a broad SWC node union to an identifier expression. */
const isIdentifier = (node: Expression | Node): node is Identifier => {
  return node.type === "Identifier";
};

/** Narrows a broad SWC node union to a member expression. */
const isMemberExpression = (node: Expression | Node): node is MemberExpression => {
  return node.type === "MemberExpression";
};

/** Narrows unknown wrapper contents back to a SWC expression. */
const isExpression = (value: unknown): value is Expression => {
  return typeof value === "object" && value !== null && "type" in value;
};
