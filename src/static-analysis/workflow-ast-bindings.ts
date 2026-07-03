/**
 * @file Lexical binding facts collected from normalized workflow body ASTs.
 */

import type { Module } from "@swc/core";
import { WORKFLOW_BODY_WRAP_FUNCTION_NAME } from "./workflow-body-normalizer";

export type LexicalBindingFacts = {
  readonly boundNames: readonly string[];
};

type AstNode = {
  readonly type?: string;
  readonly argument?: unknown;
  readonly body?: unknown;
  readonly declarations?: unknown;
  readonly elements?: unknown;
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
type BindingCollector = (node: AstNode, boundNames: Set<string>) => void;

const EXCLUDED_BINDING_NAMES = new Set([WORKFLOW_BODY_WRAP_FUNCTION_NAME]);

const STATEMENT_BINDING_COLLECTORS: Readonly<Record<string, BindingCollector>> = {
  VariableDeclaration: collectVariableDeclarationBindings,
  FunctionDeclaration: collectNamedFunctionLikeBindings,
  FunctionExpression: collectNamedFunctionLikeBindings,
  ClassDeclaration: collectClassLikeBindings,
  ClassExpression: collectClassLikeBindings,
  ArrowFunctionExpression: collectAnonymousFunctionLikeBindings,
  Constructor: collectConstructorBindings,
  ClassMethod: collectClassMethodBindings,
  PrivateMethod: collectClassMethodBindings,
  BlockStatement: collectBlockStatementBindings,
  CatchClause: collectCatchClauseBindings,
};

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
 * Collects names declared by the original workflow body.
 *
 * @param module - Parsed SWC module for a normalized workflow body.
 * @returns Frozen lexical binding facts with sorted unique binding names.
 */
export const collectLexicalBindings = (module: Module): LexicalBindingFacts => {
  const boundNames = new Set<string>();

  for (const statement of userBodyStatements(module)) {
    collectStatementBindings(asNode(statement), boundNames);
  }

  const sortedNames = [...boundNames]
    .filter((name) => !EXCLUDED_BINDING_NAMES.has(name))
    .sort(compareIdentifierNames);

  return Object.freeze({
    boundNames: Object.freeze(sortedNames),
  });
};

/**
 * Checks whether a binding fact set contains one identifier name.
 *
 * @param facts - Lexical binding facts returned by `collectLexicalBindings`.
 * @param name - Identifier name to look up.
 * @returns `true` when `name` is declared by the workflow body.
 */
export const isIdentifierBound = (facts: LexicalBindingFacts, name: string): boolean => {
  return facts.boundNames.includes(name);
};

/** Returns user-written statements from the normalized wrapper body. */
const userBodyStatements = (module: Module): readonly unknown[] => {
  const [statement] = module.body;
  const wrapperBody = syntheticWrapperBody(module, asNode(statement));

  if (wrapperBody !== undefined) {
    return arrayValue(wrapperBody.stmts);
  }

  return module.body;
};

/** Returns the expected synthetic wrapper body when present. */
const syntheticWrapperBody = (
  module: Module,
  wrapper: AstNode | undefined,
): AstNode | undefined => {
  if (module.body.length !== 1) {
    return undefined;
  }
  if (wrapper?.type !== "FunctionDeclaration") {
    return undefined;
  }
  if (identifierName(asNode(wrapper.identifier)) !== WORKFLOW_BODY_WRAP_FUNCTION_NAME) {
    return undefined;
  }

  return asNode(wrapper.body);
};

/** Collects bindings introduced by a statement or expression subtree. */
const collectStatementBindings = (node: AstNode | undefined, boundNames: Set<string>): void => {
  if (node === undefined) {
    return;
  }

  const collector = node.type === undefined ? undefined : STATEMENT_BINDING_COLLECTORS[node.type];
  if (collector !== undefined) {
    collector(node, boundNames);
    return;
  }

  collectChildBindings(node, boundNames);
};

/** Collects bindings from a variable declaration. */
function collectVariableDeclarationBindings(node: AstNode, boundNames: Set<string>): void {
  for (const declarator of arrayValue(node.declarations)) {
    const declaratorNode = asNode(declarator);
    collectPatternBindings(declaratorNode?.id, boundNames);
    collectStatementBindings(asNode(declaratorNode?.init), boundNames);
  }
}

/** Collects bindings from named function-like declarations and expressions. */
function collectNamedFunctionLikeBindings(node: AstNode, boundNames: Set<string>): void {
  addIdentifierBinding(asNode(node.identifier), boundNames);
  collectAnonymousFunctionLikeBindings(node, boundNames);
}

/** Collects bindings from class declarations and expressions. */
function collectClassLikeBindings(node: AstNode, boundNames: Set<string>): void {
  addIdentifierBinding(asNode(node.identifier), boundNames);
  for (const member of arrayValue(node.body)) {
    collectStatementBindings(asNode(member), boundNames);
  }
}

/** Collects bindings from anonymous function-like expressions. */
function collectAnonymousFunctionLikeBindings(node: AstNode, boundNames: Set<string>): void {
  collectFunctionLikeBindings(node, boundNames);
  collectStatementBindings(asNode(node.body), boundNames);
}

/** Collects bindings from a class constructor. */
function collectConstructorBindings(node: AstNode, boundNames: Set<string>): void {
  collectFunctionLikeBindings(node, boundNames);
  collectStatementBindings(asNode(node.body), boundNames);
}

/** Collects bindings from public and private class methods. */
function collectClassMethodBindings(node: AstNode, boundNames: Set<string>): void {
  collectFunctionLikeBindings(asNode(node.function) ?? node, boundNames);
  collectStatementBindings(asNode(asNode(node.function)?.body), boundNames);
}

/** Collects bindings from a block statement. */
function collectBlockStatementBindings(node: AstNode, boundNames: Set<string>): void {
  for (const statement of arrayValue(node.stmts)) {
    collectStatementBindings(asNode(statement), boundNames);
  }
}

/** Collects bindings from a catch clause. */
function collectCatchClauseBindings(node: AstNode, boundNames: Set<string>): void {
  collectPatternBindings(node.param, boundNames);
  collectStatementBindings(asNode(node.body), boundNames);
}

/** Collects parameters for function-like AST nodes. */
const collectFunctionLikeBindings = (node: AstNode, boundNames: Set<string>): void => {
  for (const parameter of arrayValue(node.params)) {
    const parameterNode = asNode(parameter);
    collectPatternBindings(
      parameterNode?.type === "Parameter" ? parameterNode.pat : parameter,
      boundNames,
    );
  }
};

/** Collects names from binding-pattern positions only. */
const collectPatternBindings = (pattern: unknown, boundNames: Set<string>): void => {
  const node = asNode(pattern);
  if (node === undefined) {
    return;
  }

  const collector = node.type === undefined ? undefined : PATTERN_BINDING_COLLECTORS[node.type];
  if (collector !== undefined) {
    collector(node, boundNames);
  }
};

/** Collects one identifier pattern binding. */
function collectIdentifierPatternBindings(node: AstNode, boundNames: Set<string>): void {
  addIdentifierBinding(node, boundNames);
}

/** Collects bindings from an array pattern. */
function collectArrayPatternBindings(node: AstNode, boundNames: Set<string>): void {
  for (const element of arrayValue(node.elements)) {
    collectPatternBindings(element, boundNames);
  }
}

/** Collects bindings from an object pattern. */
function collectObjectPatternBindings(node: AstNode, boundNames: Set<string>): void {
  for (const property of arrayValue(node.properties)) {
    collectObjectPatternPropertyBindings(asNode(property), boundNames);
  }
}

/** Collects bindings from an assignment pattern's left side. */
function collectAssignmentPatternBindings(node: AstNode, boundNames: Set<string>): void {
  collectPatternBindings(node.left, boundNames);
  collectStatementBindings(asNode(node.right), boundNames);
}

/** Collects bindings from a rest element argument. */
function collectRestElementBindings(node: AstNode, boundNames: Set<string>): void {
  collectPatternBindings(node.argument, boundNames);
}

/** Collects bindings from one object-pattern property. */
function collectObjectPatternPropertyBindings(
  property: AstNode | undefined,
  boundNames: Set<string>,
): void {
  if (property?.type === undefined) {
    return;
  }

  OBJECT_PROPERTY_BINDING_COLLECTORS[property.type]?.(property, boundNames);
}

/** Collects a shorthand or default object pattern binding. */
function collectAssignmentPatternPropertyBindings(node: AstNode, boundNames: Set<string>): void {
  collectPatternBindings(node.key, boundNames);
  collectStatementBindings(asNode(node.value), boundNames);
}

/** Collects a renamed object pattern binding. */
function collectKeyValuePatternPropertyBindings(node: AstNode, boundNames: Set<string>): void {
  collectPatternBindings(node.value, boundNames);
}

/** Recurses through children that may contain nested declarations. */
const collectChildBindings = (node: AstNode, boundNames: Set<string>): void => {
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        collectStatementBindings(asNode(item), boundNames);
      }
      continue;
    }
    collectStatementBindings(asNode(value), boundNames);
  }
};

/** Adds one identifier binding by name. */
const addIdentifierBinding = (node: AstNode | undefined, boundNames: Set<string>): void => {
  const name = identifierName(node);
  if (isCollectableBindingName(name)) {
    boundNames.add(name);
  }
};

/** Checks whether a binding name is user-visible. */
const isCollectableBindingName = (name: string | undefined): name is string => {
  if (name === undefined) {
    return false;
  }

  return !EXCLUDED_BINDING_NAMES.has(name);
};

/** Reads a SWC identifier's string value. */
const identifierName = (node: AstNode | undefined): string | undefined => {
  if (node?.type !== "Identifier") {
    return undefined;
  }

  return typeof node.value === "string" ? node.value : undefined;
};

/** Sorts identifier names by code-unit order for runtime-stable output. */
const compareIdentifierNames = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }

  return 0;
};

/** Narrows unknown AST values to object-like nodes. */
const asNode = (value: unknown): AstNode | undefined => {
  if (typeof value !== "object") {
    return undefined;
  }
  if (value === null) {
    return undefined;
  }

  return value as AstNode;
};

/** Narrows unknown AST arrays without widening call sites to `any`. */
const arrayValue = (value: unknown): readonly unknown[] => {
  return Array.isArray(value) ? value : [];
};
