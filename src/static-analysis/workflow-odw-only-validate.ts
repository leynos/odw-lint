/**
 * @file Claude compatibility scanner for ODW-only validate calls.
 *
 * The scanner parses a normalized workflow body and walks the SWC AST looking
 * for direct calls to ODW's injected `validate(source)` primitive. It ignores
 * workflow-local shadows and never executes workflow source.
 */

import type { CallExpression, Module, Node, Span } from "@swc/core";
import { ruleDefinitionFor } from "../diagnostics/rule-catalogue";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic } from "../diagnostics/types";
import { isIdentifier, traverseAstSubtree } from "./swc-ast";
import type { WorkflowEnvelope } from "./types";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
import { isIdentifierBound } from "./workflow-ast-bindings";
import {
  enterScopeWithOwnFacts,
  rootScopeOwnFacts,
  rootScopeView,
  type ScopeOwnFacts,
  scopeOwnFacts,
} from "./workflow-ast-scopes";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";
import { diagnosticsForBodyMatches } from "./workflow-body-scanner-harness";

const ODW_ONLY_VALIDATE_RULE = makeRuleId("odw/no-odw-only-validate");
const RULE_DEFINITION = ruleDefinitionFor(ODW_ONLY_VALIDATE_RULE);
type OdwOnlyValidateMatch = {
  readonly span: Span;
};

type ValidateScanContext = {
  readonly bindings: LexicalBindingFacts;
  readonly aliases: ReadonlySet<string>;
};

/**
 * Emits Claude-compatibility notes for ODW-only `validate(source)` calls.
 *
 * @param envelope - Scanned workflow envelope with an original-source body.
 * @param parseResult - Optional already-normalized body parse to reuse.
 * @returns Frozen diagnostics, or an empty list when the body cannot parse.
 */
export const scanOdwOnlyValidateNotes = (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult = parseNormalizedWorkflowBody(envelope),
): readonly Diagnostic[] => {
  return diagnosticsForBodyMatches({
    envelope,
    parseResult,
    collectMatches: (parsedBody) => {
      const rootBindings = rootScopeView(parsedBody.module);

      return walkOdwOnlyValidateCalls(parsedBody.module, {
        bindings: rootBindings,
        aliases: rootValidateAliasView(parsedBody.module, rootBindings),
      });
    },
    ruleForMatch: () => RULE_DEFINITION,
  });
};

/** Recursively walks a SWC AST in source order and returns validate matches. */
const walkOdwOnlyValidateCalls = (
  root: Node,
  initialContext: ValidateScanContext,
): readonly OdwOnlyValidateMatch[] => {
  const matches: OdwOnlyValidateMatch[] = [];

  traverseAstSubtree(root, initialContext, (node, context) => {
    const match = matchOdwOnlyValidateCall(node, context);

    if (match !== undefined) {
      matches.push(match);
    }

    return enterValidateScanScope(context, node);
  });

  return matches;
};

/** Matches direct calls to an unshadowed bare `validate` identifier or alias. */
const matchOdwOnlyValidateCall = (
  node: Node,
  context: ValidateScanContext,
): OdwOnlyValidateMatch | undefined => {
  if (!isValidateCallExpression(node) || !isIdentifier(node.callee)) {
    return undefined;
  }

  if (node.callee.value === "validate" && !isIdentifierBound(context.bindings, "validate")) {
    return { span: node.callee.span };
  }

  if (context.aliases.has(node.callee.value)) {
    return { span: node.callee.span };
  }

  return undefined;
};

/** Enters paired binding and validate-alias scopes for one scanner node. */
const enterValidateScanScope = (context: ValidateScanContext, node: Node): ValidateScanContext => {
  const ownFacts = scopeOwnFacts(node);
  const bindings = enterScopeWithOwnFacts(context.bindings, ownFacts);

  return {
    bindings,
    aliases: enterValidateAliasScope(context.aliases, bindings, ownFacts),
  };
};
/** Narrows nodes to SWC call expressions. */
const isValidateCallExpression = (node: Node): node is CallExpression => {
  return node.type === "CallExpression";
};

/** Builds validate aliases owned by the parsed workflow body's root scope. */
const rootValidateAliasView = (
  module: Module,
  rootBindings: LexicalBindingFacts,
): ReadonlySet<string> => {
  return validateAliasesForOwnFacts(new Set(), rootScopeOwnFacts(module), rootBindings);
};

/** Enters a child validate-alias scope from already-computed own facts. */
const enterValidateAliasScope = (
  parentAliases: ReadonlySet<string>,
  childBindings: LexicalBindingFacts,
  facts: ScopeOwnFacts,
): ReadonlySet<string> => {
  if (facts.ownNames.length === 0 && facts.ownInitializers.length === 0) {
    return parentAliases;
  }

  return validateAliasesForOwnFacts(parentAliases, facts, childBindings);
};

/** Checks whether an initializer directly aliases ODW's injected validate primitive. */
const isUnshadowedValidateAliasInitializer = (
  value: unknown,
  bindings: LexicalBindingFacts,
): boolean => {
  if (!isIdentifier(value)) {
    return false;
  }

  if (value.value !== "validate") {
    return false;
  }

  return !isIdentifierBound(bindings, "validate");
};

/** Builds one scope's validate alias view by shadowing and adding direct aliases. */
const validateAliasesForOwnFacts = (
  parentAliases: ReadonlySet<string>,
  facts: ScopeOwnFacts,
  bindings: LexicalBindingFacts,
): ReadonlySet<string> => {
  const aliases = new Set(parentAliases);

  for (const name of facts.ownNames) {
    aliases.delete(name);
  }

  for (const initializer of facts.ownInitializers) {
    if (isUnshadowedValidateAliasInitializer(initializer.init, bindings)) {
      aliases.add(initializer.name);
    }
  }

  return aliases;
};
