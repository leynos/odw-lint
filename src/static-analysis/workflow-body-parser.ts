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
  ruleDocsPath,
} from "../diagnostics/rule-catalogue";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic, SourceSpan } from "../diagnostics/types";
import type { OriginalSourceFile, WorkflowEnvelope } from "./types";
import {
  type NormalizedByteRange,
  type NormalizedWorkflowBody,
  narrowBodySyntaxSpan,
} from "./workflow-body-normalizer";
import type { NormalizedBodyParseResult } from "./workflow-body-parse";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";
import { bodySyntaxDetail } from "./workflow-body-syntax-detail";
export type WorkflowBodyParseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

const BODY_SYNTAX_RULE = makeRuleId("odw/body-syntax");
const BODY_SYNTAX_RULE_DEFINITION = ruleDefinitionFor(BODY_SYNTAX_RULE);
const BODY_SYNTAX_MESSAGE = firstReviewedRuleMessage(BODY_SYNTAX_RULE_DEFINITION);
const BODY_SYNTAX_TEMPLATE = firstReviewedRuleTemplate(BODY_SYNTAX_RULE_DEFINITION);
const STRUCTURED_RANGE_FIELDS = ["span", "byteOffset", "pos", "start", "offset"] as const;

type UnknownRecord = {
  readonly [key: string]: unknown;
};

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

/**
 * Resolves a structured normalized-source byte range from a parser error.
 *
 * The extractor deliberately reads only allow-listed machine-readable fields.
 * It never inspects rendered diagnostic prose such as `error.message`.
 *
 * @param error - Unknown value thrown by a parser.
 * @returns A normalized-source byte range when one is exposed, otherwise
 *   `undefined`.
 */
export const structuredNormalizedRangeFromParserError = (
  error: unknown,
): NormalizedByteRange | undefined => {
  if (!isUnknownRecord(error)) {
    return undefined;
  }

  for (const field of STRUCTURED_RANGE_FIELDS) {
    const range = normalizedRangeFromValue(error[field]);
    if (range !== undefined) {
      return range;
    }
  }

  return undefined;
};

/**
 * Narrows a body-syntax span from a parser error when structured offsets exist.
 *
 * @param sourceFile - Original workflow source file.
 * @param normalized - Normalized workflow body used by the parser.
 * @param bodySpan - Whole original-source body span used as fallback.
 * @param error - Unknown parser error value.
 * @returns A narrowed original-source span, or `bodySpan` when no structured
 *   range can be mapped.
 */
export const narrowedSpanForParserError = (
  sourceFile: OriginalSourceFile,
  normalized: NormalizedWorkflowBody,
  bodySpan: SourceSpan,
  error: unknown,
): SourceSpan => {
  try {
    return narrowBodySyntaxSpan(
      sourceFile,
      normalized,
      bodySpan,
      structuredNormalizedRangeFromParserError(error),
    );
  } catch {
    return bodySpan;
  }
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

  return Object.freeze({
    file: envelope.sourceFile.filePath,
    rule: BODY_SYNTAX_RULE,
    severity: BODY_SYNTAX_RULE_DEFINITION.defaultSeverity,
    message,
    span,
    docs: ruleDocsPath(BODY_SYNTAX_RULE_DEFINITION),
  });
};

/** Checks whether an unknown value can be inspected as an object record. */
const isUnknownRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

/** Checks whether an unknown value is a finite parser byte offset. */
const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

/** Resolves a normalized byte range from one structured parser field value. */
const normalizedRangeFromValue = (value: unknown): NormalizedByteRange | undefined => {
  if (!isUnknownRecord(value)) {
    return undefined;
  }
  const start = value["start"];
  const end = value["end"];
  if (!isFiniteNumber(start) || !isFiniteNumber(end)) {
    return undefined;
  }
  if (isReversedRange(start, end)) {
    return undefined;
  }

  return { start, end };
};

/** Checks whether a byte range ends before it starts. */
const isReversedRange = (start: number, end: number): boolean => {
  return end < start;
};
