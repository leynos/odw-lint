/**
 * @file Static SWC adapter for workflow body syntax checks.
 *
 * The adapter parses a normalized workflow body and converts parser failures
 * into project diagnostics. It never executes workflow source.
 */

import { type ParseOptions, parseSync } from "@swc/core";
import {
  firstReviewedRuleMessage,
  ruleDefinitionFor,
  ruleDocsPath,
} from "../diagnostics/rule-catalogue";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic } from "../diagnostics/types";
import type { WorkflowEnvelope } from "./types";
import { normalizeWorkflowBody } from "./workflow-body-normalizer";

export type WorkflowBodyParseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

const BODY_SYNTAX_RULE = makeRuleId("odw/body-syntax");
const BODY_SYNTAX_RULE_DEFINITION = ruleDefinitionFor(BODY_SYNTAX_RULE);
const BODY_SYNTAX_MESSAGE = firstReviewedRuleMessage(BODY_SYNTAX_RULE_DEFINITION);
const WORKFLOW_BODY_PARSE_OPTIONS: ParseOptions = {
  syntax: "ecmascript",
  jsx: false,
};

/**
 * Parses one scanned workflow body and reports syntax failures as diagnostics.
 *
 * @param envelope - Scanned workflow envelope with an original-source body span.
 * @returns A frozen success result or a frozen `odw/body-syntax` diagnostic.
 */
export const parseWorkflowBody = (envelope: WorkflowEnvelope): WorkflowBodyParseResult => {
  const normalized = normalizeWorkflowBody(envelope);

  try {
    parseSync(normalized.normalizedText, WORKFLOW_BODY_PARSE_OPTIONS);
    return Object.freeze({ ok: true });
  } catch {
    return Object.freeze({
      ok: false,
      diagnostic: bodySyntaxDiagnostic(envelope),
    });
  }
};

/** Builds the catalogued parser-failure diagnostic for a workflow body. */
const bodySyntaxDiagnostic = (envelope: WorkflowEnvelope): Diagnostic => {
  return Object.freeze({
    file: envelope.sourceFile.filePath,
    rule: BODY_SYNTAX_RULE,
    severity: BODY_SYNTAX_RULE_DEFINITION.defaultSeverity,
    message: BODY_SYNTAX_MESSAGE,
    span: envelope.bodySpan,
    docs: ruleDocsPath(BODY_SYNTAX_RULE_DEFINITION),
  });
};
