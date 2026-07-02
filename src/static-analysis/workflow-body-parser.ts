/**
 * @file Static SWC adapter for workflow body syntax checks.
 *
 * The adapter parses the original workflow body slice and converts parser
 * failures into project diagnostics. It never executes workflow source.
 */

import { type ParseOptions, parseSync } from "@swc/core";
import { RULE_CATALOGUE, type RuleDefinition, ruleDocsPath } from "../diagnostics/rule-catalogue";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic } from "../diagnostics/types";
import { sliceSourceSpan } from "./source-snippet";
import type { WorkflowEnvelope } from "./types";

export type WorkflowBodyParseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

const BODY_SYNTAX_RULE = makeRuleId("odw/body-syntax");
const BODY_SYNTAX_RULE_DEFINITION = ruleDefinitionFor(BODY_SYNTAX_RULE);
const BODY_SYNTAX_MESSAGE = firstRuleMessage(BODY_SYNTAX_RULE_DEFINITION);
const WORKFLOW_BODY_PARSE_OPTIONS: ParseOptions = {
  syntax: "ecmascript",
  jsx: false,
  topLevelAwait: true,
};

/**
 * Parses one scanned workflow body and reports syntax failures as diagnostics.
 *
 * @param envelope - Scanned workflow envelope with an original-source body span.
 * @returns A frozen success result or a frozen `odw/body-syntax` diagnostic.
 */
export const parseWorkflowBody = (envelope: WorkflowEnvelope): WorkflowBodyParseResult => {
  const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);

  try {
    parseSync(bodyText, WORKFLOW_BODY_PARSE_OPTIONS);
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

/** Returns one catalogued rule definition by identifier. */
function ruleDefinitionFor(ruleId: ReturnType<typeof makeRuleId>): RuleDefinition {
  const rule = RULE_CATALOGUE.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) {
    throw new Error(`Missing diagnostic rule catalogue entry for ${ruleId}.`);
  }

  return rule;
}

/** Returns the first reviewed catalogue message for a rule. */
function firstRuleMessage(rule: RuleDefinition): string {
  const message = rule.messages[0];
  if (message === undefined) {
    throw new Error(`Missing diagnostic message for ${rule.id}.`);
  }

  return message;
}
