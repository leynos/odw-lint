/**
 * @file Static SWC adapter for workflow body syntax checks.
 *
 * The adapter parses a normalized workflow body and converts parser failures
 * into project diagnostics. It never executes workflow source.
 */

import { renderMessageTemplate } from "../diagnostics/message-template";
import {
  firstReviewedRuleMessage,
  firstReviewedRuleTemplate,
  ruleDefinitionFor,
} from "../diagnostics/rule-catalogue";
import { createRuleDiagnostic } from "../diagnostics/rule-diagnostic";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic, SourceSpan } from "../diagnostics/types";
import type { WorkflowEnvelope } from "./types";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";
import { narrowedSpanForParserError } from "./workflow-body-parser-spans";
import { bodySyntaxDetail } from "./workflow-body-syntax-detail";
export type WorkflowBodyParseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

const BODY_SYNTAX_RULE = makeRuleId("odw/body-syntax");
const BODY_SYNTAX_RULE_DEFINITION = ruleDefinitionFor(BODY_SYNTAX_RULE);
const BODY_SYNTAX_MESSAGE = firstReviewedRuleMessage(BODY_SYNTAX_RULE_DEFINITION);
const BODY_SYNTAX_TEMPLATE = firstReviewedRuleTemplate(BODY_SYNTAX_RULE_DEFINITION);
/**
 * Parses one scanned workflow body and reports syntax failures as diagnostics.
 *
 * @param envelope - Scanned workflow envelope with an original-source body span.
 * @returns A frozen success result or a frozen `odw/body-syntax` diagnostic.
 */
export const parseWorkflowBody = (envelope: WorkflowEnvelope): WorkflowBodyParseResult => {
  const parseResult = parseNormalizedWorkflowBody(envelope);

  const diagnostics = bodySyntaxDiagnosticsForParse(envelope, parseResult);
  const diagnostic = diagnostics[0];

  if (diagnostic === undefined) {
    return Object.freeze({ ok: true });
  }

  return Object.freeze({ ok: false, diagnostic });
};

/**
 * Converts a shared normalized body parse result into body-syntax diagnostics.
 *
 * @param envelope - Scanned workflow envelope with an original-source body span.
 * @param parseResult - Already-normalized parse result for the same envelope.
 * @returns A frozen empty list for valid bodies, or the frozen parser diagnostic.
 */
export const bodySyntaxDiagnosticsForParse = (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult,
): readonly Diagnostic[] => {
  if (parseResult.ok) {
    return Object.freeze([]);
  }

  const span = narrowedSpanForParserError(
    parseResult.sourceFile,
    parseResult.normalized,
    parseResult.bodySpan,
    parseResult.error,
  );
  return Object.freeze([bodySyntaxDiagnostic(envelope, span, parseResult.error)]);
};

/** Builds the catalogued parser-failure diagnostic for a workflow body. */
const bodySyntaxDiagnostic = (
  envelope: WorkflowEnvelope,
  span: SourceSpan,
  error: unknown,
): Diagnostic => {
  const detail = bodySyntaxDetail(error);
  const message =
    detail.length > 0
      ? renderMessageTemplate(BODY_SYNTAX_TEMPLATE, { detail })
      : BODY_SYNTAX_MESSAGE;

  return createRuleDiagnostic({
    file: envelope.sourceFile.filePath,
    rule: BODY_SYNTAX_RULE_DEFINITION,
    severity: BODY_SYNTAX_RULE_DEFINITION.defaultSeverity,
    message,
    span,
  });
};
