/**
 * @file Function-scope lexical binding views for workflow AST scans.
 */

import type { Expression, Module, Node } from "@swc/core";
import { astChildValues, isAstNode } from "./swc-ast";
import {
  type AstNode,
  addIdentifierBinding,
  arrayValue,
  asNode,
  collectFunctionParamBindings,
  collectPatternBindings,
  compareIdentifierNames,
  EXCLUDED_BINDING_NAMES,
  identifierName,
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

export type ScopeOwnInitializer = {
  readonly name: string;
  readonly init: Expression;
};
/**
 * Builds the scope binding view for the top level of a parsed module.
 *
 * @param module - Parsed SWC module for a normalized workflow body.
 * @returns Frozen lexical binding facts for the root workflow scope.
 */
export const rootScopeView = (module: Module): LexicalBindingFacts => {
  return bindingFacts(new Set(rootScopeOwnFacts(module).ownNames));
};

/**
 * Returns declarations owned by the root workflow scope.
 *
 * @param module - Parsed SWC module for a normalized workflow body.
 * @returns Frozen names and simple initializers owned directly by the root.
 */
export const rootScopeOwnFacts = (module: Module): ScopeOwnFacts => {
  const facts = newMutableScopeOwnFacts();

  for (const statement of userBodyStatements(module)) {
    collectOwnFactsFromNode(asNode(statement), facts, undefined);
  }

  return freezeScopeOwnFacts(facts);
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
  for (const name of scopeOwnFacts(scopeNode).ownNames) {
    boundNames.add(name);
  }

  return bindingFacts(boundNames);
};

/**
 * Returns declarations owned by one scope-opening node.
 *
 * @param node - Candidate SWC node.
 * @returns Frozen own facts, or empty facts when `node` does not open a scope.
 */
export const scopeOwnFacts = (node: Node | AstNode): ScopeOwnFacts => {
  const scopeNode = asNode(node);
  if (!isScopeOpeningNode(scopeNode)) {
    return emptyScopeOwnFacts();
  }

  const facts = newMutableScopeOwnFacts();
  collectOwnFactsForScope(scopeNode, facts);

  return freezeScopeOwnFacts(facts);
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
    (child) =>
      collectOwnFactsFromNode(child, { ownNames: boundNames, ownInitializers: [] }, scopeNode),
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
const collectOwnFactsFromNode = (
  node: AstNode | undefined,
  facts: MutableScopeOwnFacts,
  currentScope: AstNode | undefined,
): void => {
  if (node === undefined) {
    return;
  }

  if (node !== currentScope && isScopeOpeningNode(node)) {
    if (node.type === "FunctionDeclaration") {
      addIdentifierBinding(asNode(node.identifier), facts.ownNames);
    }
    return;
  }

  collectDirectOwnFacts(node, facts, currentScope);
};
/** Collects one binding pattern using this scope collector's recursion policy. */
const collectPatternBindingNames = (pattern: unknown, boundNames: Set<string>): void => {
  collectPatternBindings(
    pattern,
    boundNames,
    (child) =>
      collectOwnFactsFromNode(child, { ownNames: boundNames, ownInitializers: [] }, undefined),
    EXCLUDED_BINDING_NAMES,
  );
};

/** Recurses through child fields that can contain declarations in this scope. */
const collectChildOwnFacts = (
  node: AstNode,
  facts: MutableScopeOwnFacts,
  currentScope: AstNode | undefined,
): void => {
  for (const value of astChildValues(node)) {
    collectOwnFactsFromValue(value, facts, currentScope);
  }
};

/** Builds runtime-stable frozen binding facts. */
const bindingFacts = (names: ReadonlySet<string>): LexicalBindingFacts => {
  return Object.freeze({
    boundNames: Object.freeze([...names].sort(compareIdentifierNames)),
  });
};

/** Builds a mutable accumulator for one scope's own facts. */
const newMutableScopeOwnFacts = (): MutableScopeOwnFacts => {
  return { ownNames: new Set(), ownInitializers: [] };
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

/** Narrows unknown values to SWC expression-shaped objects. */
const isExpression = (value: unknown): value is Expression => {
  return isAstNode(value);
};

type MutableScopeOwnFacts = {
  readonly ownNames: Set<string>;
  readonly ownInitializers: ScopeOwnInitializer[];
};

/** Builds empty frozen own facts. */
const emptyScopeOwnFacts = (): ScopeOwnFacts => {
  return Object.freeze({
    ownNames: Object.freeze([]),
    ownInitializers: Object.freeze([]),
  });
};

/** Collects declarations from non-scope-boundary nodes. */
const collectDirectOwnFacts = (
  node: AstNode,
  facts: MutableScopeOwnFacts,
  currentScope: AstNode | undefined,
): void => {
  if (node.type === "VariableDeclaration") {
    collectVariableDeclarationFacts(node, facts, currentScope);
    return;
  }

  if (node.type === "ClassDeclaration") {
    addIdentifierBinding(asNode(node.identifier), facts.ownNames);
  }

  if (node.type === "CatchClause") {
    collectPatternBindingNames(node.param, facts.ownNames);
  }

  collectChildOwnFacts(node, facts, currentScope);
};

export type ScopeOwnFacts = {
  readonly ownNames: readonly string[];
  readonly ownInitializers: readonly ScopeOwnInitializer[];
};

/** Freezes own facts into runtime-stable output. */
const freezeScopeOwnFacts = (facts: MutableScopeOwnFacts): ScopeOwnFacts => {
  return Object.freeze({
    ownNames: Object.freeze([...facts.ownNames].sort(compareIdentifierNames)),
    ownInitializers: Object.freeze([...facts.ownInitializers]),
  });
};

/** Records a simple identifier initializer declared directly in this scope. */
const collectSimpleInitializer = (
  declarator: AstNode | undefined,
  facts: MutableScopeOwnFacts,
): void => {
  const name = identifierName(asNode(declarator?.id));
  const init = declarator?.init;

  if (name === undefined || EXCLUDED_BINDING_NAMES.has(name)) {
    return;
  }

  if (!isExpression(init)) {
    return;
  }

  facts.ownInitializers.push({ name, init });
};

/** Recurses through one child value. */
const collectOwnFactsFromValue = (
  value: unknown,
  facts: MutableScopeOwnFacts,
  currentScope: AstNode | undefined,
): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectOwnFactsFromValue(item, facts, currentScope);
    }
    return;
  }

  collectOwnFactsFromNode(asNode(value), facts, currentScope);
};

/** Collects declarations owned by one scope-opening node. */
const collectOwnFactsForScope = (scopeNode: AstNode, facts: MutableScopeOwnFacts): void => {
  addIdentifierBinding(asNode(scopeNode.identifier), facts.ownNames);
  if (isFunctionLikeScope(scopeNode)) {
    collectScopeParameters(scopeNode, facts.ownNames);
    collectOwnFactsFromNode(scopeBodyNode(scopeNode), facts, scopeNode);
    return;
  }

  if (scopeNode.type === "CatchClause") {
    collectPatternBindingNames(scopeNode.param, facts.ownNames);
    return;
  }

  collectDirectOwnFacts(scopeNode, facts, scopeNode);
};

/** Collects names introduced by variable declarators and their initializers. */
const collectVariableDeclarationFacts = (
  node: AstNode,
  facts: MutableScopeOwnFacts,
  currentScope: AstNode | undefined,
): void => {
  for (const declarator of arrayValue(node.declarations)) {
    const declaratorNode = asNode(declarator);
    collectPatternBindingNames(declaratorNode?.id, facts.ownNames);
    collectSimpleInitializer(declaratorNode, facts);
    collectOwnFactsFromNode(asNode(declaratorNode?.init), facts, currentScope);
  }
};
