/**
 * @file Function-scope lexical binding views for workflow AST scans.
 */

import type { Module, Node } from "@swc/core";
import { compareIdentifierNames } from "./workflow-ast-binding-patterns";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
import {
  rootScopeOwnFacts,
  type ScopeOwnFacts,
  type ScopeOwnInitializer,
  scopeOwnFacts,
} from "./workflow-ast-scope-own-facts";

export { rootScopeOwnFacts, type ScopeOwnFacts, type ScopeOwnInitializer, scopeOwnFacts };

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
 * Enters a child scope when `node` opens one for this analysis.
 *
 * @param view - Binding facts visible before `node`.
 * @param node - Candidate SWC node being entered by the scanner walk.
 * @returns A child scope view for scope-opening nodes, otherwise `view`.
 */
export const enterScope = (view: LexicalBindingFacts, node: Node): LexicalBindingFacts => {
  const facts = scopeOwnFacts(node);
  if (facts.ownNames.length === 0) {
    return view;
  }

  const boundNames = new Set(view.boundNames);
  for (const name of facts.ownNames) {
    boundNames.add(name);
  }

  return bindingFacts(boundNames);
};

/** Builds runtime-stable frozen binding facts. */
const bindingFacts = (names: ReadonlySet<string>): LexicalBindingFacts => {
  return Object.freeze({
    boundNames: Object.freeze([...names].sort(compareIdentifierNames)),
  });
};
