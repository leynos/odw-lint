/**
 * @file Claude compatibility scanner for ODW-only validate calls.
 *
 * The scanner parses a normalized workflow body and walks the SWC AST looking
 * for direct calls to ODW's injected `validate(source)` primitive. It ignores
 * workflow-local shadows and never executes workflow source.
 */

import type { CallExpression, Node, Span } from "@swc/core";
import { ruleDefinitionFor } from "../diagnostics/rule-catalogue";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic } from "../diagnostics/types";
import { isIdentifier, traverseAstSubtree } from "./swc-ast";
import type { WorkflowEnvelope } from "./types";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
import { isIdentifierBound } from "./workflow-ast-bindings";
import { enterScopeWithOwnFacts, rootScopeView, scopeOwnFacts } from "./workflow-ast-scopes";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";
import { diagnosticsForBodyMatches } from "./workflow-body-scanner-harness";

const ODW_ONLY_VALIDATE_RULE = makeRuleId("odw/no-odw-only-validate");
const RULE_DEFINITION = ruleDefinitionFor(ODW_ONLY_VALIDATE_RULE);
type OdwOnlyValidateMatch = {
  readonly span: Span;
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
      return walkOdwOnlyValidateCalls(parsedBody.module, rootScopeView(parsedBody.module));
    },
    ruleForMatch: () => RULE_DEFINITION,
  });
};

/** Recursively walks a SWC AST in source order and returns validate matches. */
const walkOdwOnlyValidateCalls = (
  root: Node,
  initialBindings: LexicalBindingFacts,
): readonly OdwOnlyValidateMatch[] => {
  const matches: OdwOnlyValidateMatch[] = [];

  traverseAstSubtree(root, initialBindings, (node, bindings) => {
    const match = matchOdwOnlyValidateCall(node, bindings);

    if (match !== undefined) {
      matches.push(match);
    }

    return enterScopeWithOwnFacts(bindings, scopeOwnFacts(node));
  });

  return matches;
};

/** Matches direct calls to an unshadowed bare `validate` identifier. */
const matchOdwOnlyValidateCall = (
  node: Node,
  bindings: LexicalBindingFacts,
): OdwOnlyValidateMatch | undefined => {
  if (!isValidateCallExpression(node) || !isIdentifier(node.callee)) {
    return undefined;
  }

  if (node.callee.value !== "validate" || isIdentifierBound(bindings, "validate")) {
    return undefined;
  }

  return { span: node.callee.span };
};

/** Narrows nodes to SWC call expressions. */
const isValidateCallExpression = (node: Node): node is CallExpression => {
  return node.type === "CallExpression";
};
