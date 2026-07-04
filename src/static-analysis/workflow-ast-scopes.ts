/**
 * @file Function-scope lexical binding views for workflow AST scans.
 */

import type { Module, Node } from "@swc/core";
import { astChildValues } from "./swc-ast";
import {
  type AstNode,
  addIdentifierBinding,
  arrayValue,
  asNode,
  collectFunctionParamBindings,
  collectPatternBindings,
  compareIdentifierNames,
  EXCLUDED_BINDING_NAMES,
  userBodyStatements,
} from "./workflow-ast-binding-patterns";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";

const FUNCTION_LIKE_SCOPE_TYPES: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "Constructor",
  "ClassMethod",
  "PrivateMethod",
  "MethodProperty",
  "GetterProperty",
  "SetterProperty",
]);
const NAMED_CLASS_EXPRESSION_SCOPE_TYPES: ReadonlySet<string> = new Set(["ClassExpression"]);
const BLOCK_LIKE_SCOPE_TYPES: ReadonlySet<string> = new Set([
  "BlockStatement",
  "CatchClause",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
]);

/**
 * Builds the scope binding view for the top level of a parsed module.
 *
 * @param module - Parsed SWC module for a normalized workflow body.
 * @returns Frozen lexical binding facts for the root workflow scope.
 */
export const rootScopeView = (module: Module): LexicalBindingFacts => {
  const boundNames = new Set<string>();

  for (const statement of userBodyStatements(module)) {
    collectOwnNamesFromNode(asNode(statement), boundNames, undefined);
  }

  return bindingFacts(boundNames);
};

/**
 * Enters a child scope when `node` opens one for this analysis.
 *
 * @param view - Binding facts visible before `node`.
 * @param node - Candidate SWC node being entered by the scanner walk.
 * @returns A child scope view for scope-opening nodes, otherwise `view`.
 */
export const enterScope = (view: LexicalBindingFacts, node: Node): LexicalBindingFacts => {
  const scopeNode = asNode(node);
  if (!isScopeOpeningNode(scopeNode)) {
    return view;
  }

  const boundNames = new Set(view.boundNames);
  collectOwnNamesForScope(scopeNode, boundNames);

  return bindingFacts(boundNames);
};

/** Collects names owned by one scope-opening node. */
const collectOwnNamesForScope = (scopeNode: AstNode, boundNames: Set<string>): void => {
  addIdentifierBinding(asNode(scopeNode.identifier), boundNames);
  if (isFunctionLikeScope(scopeNode)) {
    collectScopeParameters(scopeNode, boundNames);
    collectOwnNamesFromNode(scopeBodyNode(scopeNode), boundNames, scopeNode);
    return;
  }

  if (scopeNode.type === "CatchClause") {
    collectPatternBindingNames(scopeNode.param, boundNames);
    return;
  }

  collectDirectOwnNames(scopeNode, boundNames, scopeNode);
};

/** Collects parameters for the supported function-like scope node shapes. */
const collectScopeParameters = (scopeNode: AstNode, boundNames: Set<string>): void => {
  if (scopeNode.type === "SetterProperty") {
    collectPatternBindingNames(scopeNode.param, boundNames);
    return;
  }

  collectFunctionParamBindings(
    asNode(scopeNode.function) ?? scopeNode,
    boundNames,
    (child) => collectOwnNamesFromNode(child, boundNames, scopeNode),
    EXCLUDED_BINDING_NAMES,
  );
};

/** Returns the node whose children form the executable body for one scope. */
const scopeBodyNode = (scopeNode: AstNode): AstNode | undefined => {
  if (scopeNode.type === "ClassMethod" || scopeNode.type === "PrivateMethod") {
    return asNode(asNode(scopeNode.function)?.body);
  }

  return asNode(scopeNode.body);
};

/** Collects direct declarations for the current scope without entering children. */
const collectOwnNamesFromNode = (
  node: AstNode | undefined,
  boundNames: Set<string>,
  currentScope: AstNode | undefined,
): void => {
  if (node === undefined) {
    return;
  }

  if (node !== currentScope && isScopeOpeningNode(node)) {
    if (node.type === "FunctionDeclaration") {
      addIdentifierBinding(asNode(node.identifier), boundNames);
    }
    return;
  }

  collectDirectOwnNames(node, boundNames, currentScope);
};

/** Collects declarations from non-scope-boundary nodes. */
const collectDirectOwnNames = (
  node: AstNode,
  boundNames: Set<string>,
  currentScope: AstNode | undefined,
): void => {
  if (node.type === "VariableDeclaration") {
    collectVariableDeclarationNames(node, boundNames, currentScope);
    return;
  }

  if (node.type === "ClassDeclaration") {
    addIdentifierBinding(asNode(node.identifier), boundNames);
  }

  if (node.type === "CatchClause") {
    collectPatternBindingNames(node.param, boundNames);
  }

  collectChildOwnNames(node, boundNames, currentScope);
};

/** Collects names introduced by variable declarators and their initializers. */
const collectVariableDeclarationNames = (
  node: AstNode,
  boundNames: Set<string>,
  currentScope: AstNode | undefined,
): void => {
  for (const declarator of arrayValue(node.declarations)) {
    const declaratorNode = asNode(declarator);
    collectPatternBindingNames(declaratorNode?.id, boundNames);
    collectOwnNamesFromNode(asNode(declaratorNode?.init), boundNames, currentScope);
  }
};

/** Collects one binding pattern using this scope collector's recursion policy. */
const collectPatternBindingNames = (pattern: unknown, boundNames: Set<string>): void => {
  collectPatternBindings(
    pattern,
    boundNames,
    (child) => collectOwnNamesFromNode(child, boundNames, undefined),
    EXCLUDED_BINDING_NAMES,
  );
};

/** Recurses through child fields that can contain declarations in this scope. */
const collectChildOwnNames = (
  node: AstNode,
  boundNames: Set<string>,
  currentScope: AstNode | undefined,
): void => {
  for (const value of astChildValues(node)) {
    collectOwnNamesFromValue(value, boundNames, currentScope);
  }
};

/** Recurses through one child value. */
const collectOwnNamesFromValue = (
  value: unknown,
  boundNames: Set<string>,
  currentScope: AstNode | undefined,
): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectOwnNamesFromValue(item, boundNames, currentScope);
    }
    return;
  }

  collectOwnNamesFromNode(asNode(value), boundNames, currentScope);
};

/** Builds runtime-stable frozen binding facts. */
const bindingFacts = (names: ReadonlySet<string>): LexicalBindingFacts => {
  return Object.freeze({
    boundNames: Object.freeze([...names].sort(compareIdentifierNames)),
  });
};

/** Checks whether a node opens a function-like scope for this analysis. */
const isFunctionLikeScope = (node: AstNode | undefined): boolean => {
  return node?.type !== undefined && FUNCTION_LIKE_SCOPE_TYPES.has(node.type);
};

/** Checks whether a node owns a child binding view for this analysis. */
const isScopeOpeningNode = (node: AstNode | undefined): node is AstNode => {
  const nodeType = node?.type;
  return (
    nodeType !== undefined &&
    (FUNCTION_LIKE_SCOPE_TYPES.has(nodeType) ||
      NAMED_CLASS_EXPRESSION_SCOPE_TYPES.has(nodeType) ||
      BLOCK_LIKE_SCOPE_TYPES.has(nodeType))
  );
};
