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
import type { OriginalSourceFile, WorkflowEnvelope } from "./types";
import { isFiniteNumber, isUnknownRecord, type UnknownRecord } from "./value-guards";
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

const PARSER_COORDINATE_BASES = ["normalized", "body", "module"] as const;

type ParserCoordinateBase = (typeof PARSER_COORDINATE_BASES)[number];
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
 * @param normalized - Normalized workflow body used to resolve declared
 *   parser-error coordinate bases.
 * @returns A normalized-source byte range when one is exposed, otherwise
 *   `undefined`.
 */
export const structuredNormalizedRangeFromParserError = (
  error: unknown,
  normalized: NormalizedWorkflowBody,
): NormalizedByteRange | undefined => {
  if (!isUnknownRecord(error)) {
    return undefined;
  }

  for (const field of STRUCTURED_RANGE_FIELDS) {
    const range = normalizedRangeFromValue(error[field], normalized);
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
      structuredNormalizedRangeFromParserError(error, normalized),
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

  return createRuleDiagnostic({
    file: envelope.sourceFile.filePath,
    rule: BODY_SYNTAX_RULE_DEFINITION,
    severity: BODY_SYNTAX_RULE_DEFINITION.defaultSeverity,
    message,
    span,
  });
};
/** Resolves a normalized byte range from one structured parser field value. */
const normalizedRangeFromValue = (
  value: unknown,
  normalized: NormalizedWorkflowBody,
): NormalizedByteRange | undefined => {
  if (!isUnknownRecord(value)) {
    return undefined;
  }
  const offsetRecord = value as ParserOffsetRecord;
  const base = parserCoordinateBase(offsetRecord);
  if (base === undefined) {
    return undefined;
  }
  const { start, end } = offsetRecord;
  if (isFiniteNumber(start) && isFiniteNumber(end)) {
    return normalizedRangeFromParserOffsets(start, end, base, normalized);
  }

  const { offset } = offsetRecord;
  if (!isFiniteNumber(offset)) {
    return undefined;
  }

  return normalizedScalarOffsetRange(offset, base, normalized);
};

/** Checks whether a byte range ends before it starts. */
const isReversedRange = (start: number, end: number): boolean => {
  return end < start;
};

/** Reads the explicit coordinate base required for parser error offsets. */
const parserCoordinateBase = (value: ParserOffsetRecord): ParserCoordinateBase | undefined => {
  const base = value.base ?? value.coordinateBase;
  if (typeof base !== "string") {
    return undefined;
  }

  return PARSER_COORDINATE_BASES.includes(base as ParserCoordinateBase)
    ? (base as ParserCoordinateBase)
    : undefined;
};

/** Converts one parser offset to the normalized-source coordinate space. */
const normalizedOffsetFromParserOffset = (
  offset: number,
  base: ParserCoordinateBase,
  normalized: NormalizedWorkflowBody,
): number | undefined => {
  switch (base) {
    case "normalized":
      return offset;
    case "body":
      return normalized.prefixByteLength + offset;
    case "module":
      return offset - normalized.bodyByteOffset + normalized.prefixByteLength;
  }
};

const TEXT_ENCODER = new TextEncoder();

/** Returns the text index after one Unicode code point. */
const nextCharacterIndex = (sourceText: string, index: number): number => {
  const codePoint = sourceText.codePointAt(index);
  if (codePoint === undefined) {
    return sourceText.length;
  }

  return index + String.fromCodePoint(codePoint).length;
};

/** Checks whether one ASCII byte can be part of a JavaScript identifier. */
const isIdentifierByteCharacter = (character: string): boolean => {
  return /^[0-9A-Za-z_$]$/.test(character);
};

/** Returns the UTF-8 byte length of a text slice. */
const byteLength = (text: string): number => {
  return TEXT_ENCODER.encode(text).byteLength;
};

type ParserOffsetRecord = UnknownRecord & {
  readonly base?: unknown;
  readonly coordinateBase?: unknown;
  readonly end?: unknown;
  readonly offset?: unknown;
  readonly start?: unknown;
};

/** Normalizes parser offsets from their declared coordinate base. */
const normalizedRangeFromParserOffsets = (
  start: number,
  end: number,
  base: ParserCoordinateBase,
  normalized: NormalizedWorkflowBody,
): NormalizedByteRange | undefined => {
  const normalizedStart = normalizedOffsetFromParserOffset(start, base, normalized);
  const normalizedEnd = normalizedOffsetFromParserOffset(end, base, normalized);
  if (normalizedStart === undefined || normalizedEnd === undefined) {
    return undefined;
  }
  if (isReversedRange(normalizedStart, normalizedEnd)) {
    return undefined;
  }

  return { start: normalizedStart, end: normalizedEnd };
};

/** Synthesizes a small token range from a scalar parser caret offset. */
const normalizedScalarOffsetRange = (
  offset: number,
  base: ParserCoordinateBase,
  normalized: NormalizedWorkflowBody,
): NormalizedByteRange | undefined => {
  const start = normalizedOffsetFromParserOffset(offset, base, normalized);
  if (start === undefined) {
    return undefined;
  }
  const end = normalizedTokenEndByte(normalized.normalizedText, start);
  if (end === undefined) {
    return undefined;
  }

  return { start, end };
};

/** Returns the end index of an ASCII identifier-like token. */
const identifierEndIndex = (sourceText: string, startIndex: number): number => {
  let index = startIndex;
  while (index < sourceText.length && isIdentifierByteCharacter(sourceText[index] ?? "")) {
    index += 1;
  }

  return index;
};

/** Finds the byte offset after the token touched by a parser caret offset. */
const normalizedTokenEndByte = (sourceText: string, startByte: number): number | undefined => {
  const startIndex = textIndexAtByteOffset(sourceText, startByte);
  if (startIndex === undefined || startIndex >= sourceText.length) {
    return undefined;
  }

  const firstCharacter = sourceText[startIndex] ?? "";
  const endIndex = isIdentifierByteCharacter(firstCharacter)
    ? identifierEndIndex(sourceText, startIndex)
    : nextCharacterIndex(sourceText, startIndex);

  return startByte + byteLength(sourceText.slice(startIndex, endIndex));
};

/** Finds the UTF-16 text index for a normalized-source byte offset. */
const textIndexAtByteOffset = (sourceText: string, byteOffset: number): number | undefined => {
  if (!Number.isInteger(byteOffset) || byteOffset < 0) {
    return undefined;
  }

  let bytesSeen = 0;
  for (let index = 0; index < sourceText.length; index = nextCharacterIndex(sourceText, index)) {
    if (bytesSeen === byteOffset) {
      return index;
    }
    bytesSeen += byteLength(sourceText.slice(index, nextCharacterIndex(sourceText, index)));
    if (bytesSeen > byteOffset) {
      return undefined;
    }
  }

  return bytesSeen === byteOffset ? sourceText.length : undefined;
};
