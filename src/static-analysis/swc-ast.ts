/**
 * @file Shared SWC AST shape helpers for parser-backed analysis rules.
 */

import type { Expression, Identifier, MemberExpression, Node } from "@swc/core";
import { isUnknownRecord, type UnknownRecord } from "./value-guards";

/**
 * Narrows an unknown value to a plain SWC node-shaped object.
 *
 * @param value - Value crossing a parser-backed traversal boundary.
 * @returns Whether the value has SWC node shape.
 */
export const isAstNode = (value: unknown): value is Node => {
  return typeof value === "object" && value !== null && "type" in value;
};

/**
 * Returns node fields that may contain semantic child nodes.
 *
 * @param value - SWC node or node-shaped wrapper to inspect.
 * @returns Child field values, excluding SWC bookkeeping fields.
 */
export const astChildValues = (value: object): readonly unknown[] => {
  return Object.entries(value)
    .filter(([key]) => isTraversableChildKey(key))
    .map(([, child]) => child);
};

/**
 * Narrows unknown wrapper contents back to a SWC expression-shaped object.
 *
 * @param value - Value crossing a parser-backed expression boundary.
 * @returns Whether the value has SWC expression shape.
 */
export const isExpression = (value: unknown): value is Expression => {
  return isAstNode(value);
};

/**
 * Narrows values to SWC identifier expressions and patterns.
 *
 * @param value - Candidate SWC node value.
 * @returns Whether the value is an `Identifier` node.
 */
export const isIdentifier = (value: unknown): value is Identifier => {
  return isAstNode(value) && value.type === "Identifier";
};

/**
 * Narrows values to SWC member expressions.
 *
 * @param value - Candidate SWC node value.
 * @returns Whether the value is a `MemberExpression` node.
 */
export const isMemberExpression = (value: unknown): value is MemberExpression => {
  return isAstNode(value) && value.type === "MemberExpression";
};

/**
 * Drives a pre-order walk over one SWC subtree, threading caller context to
 * each node's children.
 *
 * `visit` receives a node and the context inherited from its parent, then
 * returns the context for that node's own children. Array and non-node record
 * wrappers propagate the current context unchanged, because only nodes can own
 * rule-specific scope or binding transitions.
 *
 * @param root - SWC node to walk, inclusive of `root` itself.
 * @param context - Context passed to `visit(root, ...)`.
 * @param visit - Per-node callback returning the child context.
 */
export const traverseAstSubtree = <Context>(
  root: Node,
  context: Context,
  visit: (node: Node, context: Context) => Context,
): void => {
  const childContext = visit(root, context);

  for (const child of astChildValues(root)) {
    traverseAstChildValue(child, childContext, visit);
  }
};

/** Descends child wrappers while preserving the current node context. */
const traverseAstChildValue = <Context>(
  value: unknown,
  context: Context,
  visit: (node: Node, context: Context) => Context,
): void => {
  if (isAstNode(value)) {
    traverseAstSubtree(value, context, visit);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      traverseAstChildValue(item, context, visit);
    }
    return;
  }

  if (isUnknownRecord(value)) {
    for (const child of astChildValues(value)) {
      traverseAstChildValue(child, context, visit);
    }
  }
};

/**
 * Excludes scalar SWC bookkeeping fields from recursive traversal.
 */
const isTraversableChildKey = (key: string): boolean => {
  return key !== "span" && key !== "type" && key !== "ctxt";
};

export { isUnknownRecord, type UnknownRecord };
