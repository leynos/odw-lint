/**
 * @file Shared harness helpers for parser-backed workflow body scanners.
 *
 * Parser-backed scanners still own their AST matching rules locally. This
 * module owns the common parse-result, normalized-span, and diagnostic
 * construction path so new scanners do not copy that scaffolding.
 */

import type { Span } from "@swc/core";
import { firstReviewedRuleMessage, type RuleDefinition } from "../diagnostics/rule-catalogue";
import { createRuleDiagnostic } from "../diagnostics/rule-diagnostic";
import type { Diagnostic } from "../diagnostics/types";
import type { WorkflowEnvelope } from "./types";
import { originalSpanFromNormalizedOffsets } from "./workflow-body-normalizer";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";

export type BodyScannerMatch = {
  /** SWC span in normalized workflow-body coordinates. */
  readonly span: Span;
};

type ParsedBody = Extract<NormalizedBodyParseResult, { readonly ok: true }>;

type BodyScannerHarnessOptions<TMatch extends BodyScannerMatch> = {
  /** Scanned workflow envelope with original-source coordinates. */
  readonly envelope: WorkflowEnvelope;
  /** Optional parse result to reuse across body scanners. */
  readonly parseResult?: NormalizedBodyParseResult;
  /** Returns scanner-local matches in source order. */
  readonly collectMatches: (parseResult: ParsedBody) => readonly TMatch[];
  /** Returns the catalogue rule for one match. */
  readonly ruleForMatch: (match: TMatch) => RuleDefinition;
};

type NormalizedSpanDiagnosticOptions = {
  readonly envelope: WorkflowEnvelope;
  readonly parseResult: ParsedBody;
  readonly rule: RuleDefinition;
  readonly span: Span;
};

/**
 * Builds one diagnostic from a parser match span in normalized body source.
 *
 * @param options - Match span, parse result, and catalogue rule.
 * @param options.envelope - Scanned workflow envelope with original-source metadata.
 * @param options.parseResult - Successful normalized body parse that owns the SWC module.
 * @param options.rule - Catalogue rule to attach to the emitted diagnostic.
 * @param options.span - SWC span to map from normalized source to original source.
 * @returns A diagnostic whose span has been mapped back to original source.
 */
export const normalizedSpanDiagnostic = (options: NormalizedSpanDiagnosticOptions): Diagnostic => {
  const { envelope, parseResult, rule, span } = options;
  const moduleBase = parseResult.module.span.start;

  return createRuleDiagnostic({
    file: envelope.sourceFile.filePath,
    rule,
    severity: rule.defaultSeverity,
    message: firstReviewedRuleMessage(rule),
    span: originalSpanFromNormalizedOffsets(
      envelope.sourceFile,
      parseResult.normalized,
      span.start - moduleBase,
      span.end - moduleBase,
    ),
  });
};

/**
 * Collects parser-backed body matches and projects them to frozen diagnostics.
 *
 * @param options - Envelope, optional parse result, collector, and rule lookup.
 * @param options.envelope - Scanned workflow envelope to analyse.
 * @param options.parseResult - Optional parse result to reuse across scanners.
 * @param options.collectMatches - Scanner-local collector that returns matches in source order.
 * @param options.ruleForMatch - Rule lookup for each scanner-local match.
 * @returns Frozen diagnostics, or an empty frozen list when parsing fails.
 */
export const diagnosticsForBodyMatches = <TMatch extends BodyScannerMatch>(
  options: BodyScannerHarnessOptions<TMatch>,
): readonly Diagnostic[] => {
  const {
    envelope,
    parseResult = parseNormalizedWorkflowBody(options.envelope),
    collectMatches,
    ruleForMatch,
  } = options;

  if (!parseResult.ok) {
    return Object.freeze([]);
  }

  const diagnostics = collectMatches(parseResult).map((match) => {
    return normalizedSpanDiagnostic({
      envelope,
      parseResult,
      rule: ruleForMatch(match),
      span: match.span,
    });
  });

  return Object.freeze(diagnostics);
};
