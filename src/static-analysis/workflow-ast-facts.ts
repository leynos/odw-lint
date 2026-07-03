/**
 * @file Public workflow AST fact aggregation.
 */

import type { WorkflowEnvelope } from "./types";
import { collectLexicalBindings, type LexicalBindingFacts } from "./workflow-ast-bindings";
import { type NormalizedBodyParseResult, parseNormalizedWorkflowBody } from "./workflow-body-parse";
import { buildSuppressionMasks, type WorkflowSuppressionMasks } from "./workflow-suppression-mask";

export type WorkflowAstFacts = Readonly<{
  parseSucceeded: boolean;
  lexicalBindings: LexicalBindingFacts;
  suppressionMasks: WorkflowSuppressionMasks;
}>;

const EMPTY_LEXICAL_BINDINGS: LexicalBindingFacts = Object.freeze({
  boundNames: Object.freeze([]),
});

/**
 * Collects reusable AST facts for one scanned workflow envelope.
 *
 * @param envelope - Scanned workflow envelope to analyse without execution.
 * @returns Frozen lexical-binding and source-mask facts for later rules.
 */
export const collectWorkflowAstFacts = (envelope: WorkflowEnvelope): WorkflowAstFacts => {
  return collectWorkflowAstFactsFromParseResult(envelope, parseNormalizedWorkflowBody(envelope));
};

/**
 * Collects public facts from an existing internal parse result.
 *
 * @param envelope - Scanned workflow envelope that owns the source file.
 * @param parseResult - Internal normalized-body parse result for the same
 *   envelope; callers must not mix parse results and source masks from
 *   different workflow bodies.
 * @returns Frozen parser-type-free facts for later rules.
 */
export const collectWorkflowAstFactsFromParseResult = (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult,
): WorkflowAstFacts => {
  assertParseResultMatchesEnvelope(envelope, parseResult);

  const lexicalBindings = parseResult.ok
    ? collectLexicalBindings(parseResult.module)
    : EMPTY_LEXICAL_BINDINGS;

  return Object.freeze({
    parseSucceeded: parseResult.ok,
    lexicalBindings,
    suppressionMasks: buildSuppressionMasks(envelope.sourceFile),
  });
};

/** Fails before mixing bindings and masks from different workflow bodies. */
const assertParseResultMatchesEnvelope = (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult,
): void => {
  if (!hasSameSourceFile(envelope, parseResult)) {
    throw new Error("Parse result must belong to the same workflow envelope.");
  }
  if (!hasSameBodySpan(envelope, parseResult)) {
    throw new Error("Parse result must belong to the same workflow envelope.");
  }
};

/** Checks the source-file identity part of the parse-result pairing. */
const hasSameSourceFile = (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult,
): boolean => {
  return parseResult.sourceFile === envelope.sourceFile;
};

/** Checks the body-span value part of the parse-result pairing. */
const hasSameBodySpan = (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult,
): boolean => {
  return (
    parseResult.bodySpan.start.offset === envelope.bodySpan.start.offset &&
    parseResult.bodySpan.end.offset === envelope.bodySpan.end.offset
  );
};
