/**
 * @file Reusable binding-pattern collectors for workflow AST analysis.
 */

import { isUnknownRecord } from "./swc-ast";

export type AstNode = {
  readonly type?: string;
  readonly argument?: unknown;
  readonly body?: unknown;
  readonly declarations?: unknown;
  readonly elements?: unknown;
  readonly expr?: unknown;
  readonly id?: unknown;
  readonly identifier?: unknown;
  readonly init?: unknown;
  readonly key?: unknown;
  readonly left?: unknown;
  readonly param?: unknown;
  readonly params?: unknown;
  readonly pat?: unknown;
  readonly properties?: unknown;
  readonly right?: unknown;
  readonly stmts?: unknown;
  readonly value?: unknown;
  readonly function?: unknown;
  readonly [key: string]: unknown;
};

export type ExpressionRecursion = (node: AstNode | undefined) => void;

type BindingCollector = (
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
) => void;

const PATTERN_BINDING_COLLECTORS: Readonly<Record<string, BindingCollector>> = {
  Identifier: collectIdentifierPatternBindings,
  ArrayPattern: collectArrayPatternBindings,
  ObjectPattern: collectObjectPatternBindings,
  AssignmentPattern: collectAssignmentPatternBindings,
  RestElement: collectRestElementBindings,
};

const OBJECT_PROPERTY_BINDING_COLLECTORS: Readonly<Record<string, BindingCollector>> = {
  AssignmentPatternProperty: collectAssignmentPatternPropertyBindings,
  KeyValuePatternProperty: collectKeyValuePatternPropertyBindings,
  RestElement: collectRestElementBindings,
};

/**
 * Narrows unknown AST values to object-like nodes.
 *
 * @param value - Unknown value from a SWC AST field.
 * @returns The value as an AST node, or `undefined` for non-object values.
 */
export const asNode = (value: unknown): AstNode | undefined => {
  return isUnknownRecord(value) ? (value as AstNode) : undefined;
};

/**
 * Narrows unknown AST arrays without widening call sites to `any`.
 *
 * @param value - Unknown value from a SWC AST field.
 * @returns The value as a readonly array, or an empty array for non-arrays.
 */
export const arrayValue = (value: unknown): readonly unknown[] => {
  return Array.isArray(value) ? value : [];
};

/**
 * Reads a SWC identifier's string value.
 *
 * @param node - Candidate identifier node.
 * @returns The identifier value, or `undefined` when `node` is not an identifier.
 */
export const identifierName = (node: AstNode | undefined): string | undefined => {
  if (node?.type !== "Identifier") {
    return undefined;
  }

  return typeof node.value === "string" ? node.value : undefined;
};

/**
 * Collects names from binding-pattern positions only.
 *
 * @param pattern - Candidate SWC binding pattern.
 * @param boundNames - Mutable set receiving discovered names.
 * @param recurse - Callback for walking initializer expressions.
 * @param excluded - Binding names ignored by the caller.
 */
export const collectPatternBindings = (
  pattern: unknown,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void => {
  const node = asNode(pattern);
  if (node === undefined) {
    return;
  }

  const collector = node.type === undefined ? undefined : PATTERN_BINDING_COLLECTORS[node.type];
  if (collector !== undefined) {
    collector(node, boundNames, recurse, excluded);
  }
};

/**
 * Collects parameter-pattern bindings for a function-like node.
 *
 * @param node - Function-like SWC node whose `params` field should be scanned.
 * @param boundNames - Mutable set receiving discovered names.
 * @param recurse - Callback for walking parameter initializer expressions.
 * @param excluded - Binding names ignored by the caller.
 */
export const collectFunctionParamBindings = (
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void => {
  for (const parameter of arrayValue(node.params)) {
    const parameterNode = asNode(parameter);
    collectPatternBindings(
      parameterNode?.type === "Parameter" ? parameterNode.pat : parameter,
      boundNames,
      recurse,
      excluded,
    );
  }
};

/** Collects one identifier pattern binding. */
function collectIdentifierPatternBindings(
  node: AstNode,
  boundNames: Set<string>,
  _recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  addIdentifierBinding(node, boundNames, excluded);
}

/** Collects bindings from an array pattern. */
function collectArrayPatternBindings(
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  for (const element of arrayValue(node.elements)) {
    collectPatternBindings(element, boundNames, recurse, excluded);
  }
}

/** Collects bindings from an object pattern. */
function collectObjectPatternBindings(
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  for (const property of arrayValue(node.properties)) {
    collectObjectPatternPropertyBindings(asNode(property), boundNames, recurse, excluded);
  }
}

/** Collects bindings from an assignment pattern's left side. */
function collectAssignmentPatternBindings(
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  collectPatternBindings(node.left, boundNames, recurse, excluded);
  recurse(asNode(node.right));
}

/** Collects bindings from a rest element argument. */
function collectRestElementBindings(
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  collectPatternBindings(node.argument, boundNames, recurse, excluded);
}

/** Collects bindings from one object-pattern property. */
function collectObjectPatternPropertyBindings(
  property: AstNode | undefined,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  if (property?.type === undefined) {
    return;
  }

  OBJECT_PROPERTY_BINDING_COLLECTORS[property.type]?.(property, boundNames, recurse, excluded);
}

/** Collects a shorthand or default object pattern binding. */
function collectAssignmentPatternPropertyBindings(
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  collectPatternBindings(node.key, boundNames, recurse, excluded);
  recurse(asNode(node.value));
}

/** Collects a renamed object pattern binding. */
function collectKeyValuePatternPropertyBindings(
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
): void {
  recurse(asNode(asNode(node.key)?.expr));
  collectPatternBindings(node.value, boundNames, recurse, excluded);
}

/** Adds one identifier binding by name. */
const addIdentifierBinding = (
  node: AstNode | undefined,
  boundNames: Set<string>,
  excluded: ReadonlySet<string>,
): void => {
  const name = identifierName(node);
  if (isCollectableBindingName(name, excluded)) {
    boundNames.add(name);
  }
};

/** Checks whether a binding name is user-visible. */
const isCollectableBindingName = (
  name: string | undefined,
  excluded: ReadonlySet<string>,
): name is string => {
  if (name === undefined) {
    return false;
  }

  return !excluded.has(name);
};
