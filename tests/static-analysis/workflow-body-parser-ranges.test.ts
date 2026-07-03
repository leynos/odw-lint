/**
 * @file Parser-error range extraction tests for workflow body diagnostics.
 */

import { describe, expect, it } from "bun:test";
import { parseSync } from "@swc/core";
import { normalizeWorkflowBody, sliceSourceSpan } from "odw-lint";
import {
  narrowedSpanForParserError,
  structuredNormalizedRangeFromParserError,
} from "../../src/static-analysis/workflow-body-parser-spans";
import { bodyRelativeRange, normalizedTokenRange } from "./normalized-byte-range-support";
import { envelopeForBody } from "./workflow-envelope-support";

/** Captures the thrown SWC parser error for a normalized source string. */
const catchSwcParseError = (normalizedText: string): unknown => {
  try {
    parseSync(normalizedText, {
      syntax: "ecmascript",
      jsx: false,
    });
  } catch (error) {
    return error;
  }

  throw new Error("Expected SWC to reject malformed normalized source.");
};

describe("parser-error ranges for body diagnostics", () => {
  it("resolves structured parser-error ranges without reading rendered prose", () => {
    const envelope = envelopeForBody('agent("draft"\n');
    const normalized = normalizeWorkflowBody(envelope);
    const realError = catchSwcParseError(normalized.normalizedText);
    const syntheticError = {
      span: { base: "normalized", start: 7, end: 12 },
      get message(): string {
        throw new Error("Parser prose must not be inspected.");
      },
    };

    expect(structuredNormalizedRangeFromParserError(realError, normalized)).toBeUndefined();
    expect(structuredNormalizedRangeFromParserError(syntheticError, normalized)).toEqual({
      start: 7,
      end: 12,
    });
  });

  it("requires parser-error ranges to declare their coordinate base", () => {
    const envelope = envelopeForBody('const marker = "café";\nreturn marker;\n');
    const normalized = normalizeWorkflowBody(envelope);
    const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);
    const range = normalizedTokenRange(bodyText, "café", normalized.prefixByteLength);

    expect(structuredNormalizedRangeFromParserError({ span: range }, normalized)).toBeUndefined();
  });

  it("normalizes body-relative and module-global parser-error ranges", () => {
    const envelope = envelopeForBody('const marker = "café";\nreturn marker;\n');
    const normalized = normalizeWorkflowBody(envelope);
    const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);
    const range = normalizedTokenRange(bodyText, "café", normalized.prefixByteLength);
    const bodyRange = bodyRelativeRange(range, normalized.prefixByteLength);
    const moduleGlobalRange = {
      start: envelope.bodySpan.start.offset + bodyRange.start,
      end: envelope.bodySpan.start.offset + bodyRange.end,
    };

    expect(
      structuredNormalizedRangeFromParserError(
        { span: { base: "body", ...bodyRange } },
        normalized,
      ),
    ).toEqual(range);
    expect(
      structuredNormalizedRangeFromParserError(
        { span: { base: "module", ...moduleGlobalRange } },
        normalized,
      ),
    ).toEqual(range);
  });

  it("synthesizes token-end ranges for scalar parser-error offsets", () => {
    const envelope = envelopeForBody("const marker = 42;\nreturn marker;\n");
    const normalized = normalizeWorkflowBody(envelope);
    const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);
    const range = normalizedTokenRange(bodyText, "42", normalized.prefixByteLength);

    expect(
      structuredNormalizedRangeFromParserError(
        {
          offset: {
            base: "body",
            offset: range.start - normalized.prefixByteLength,
          },
        },
        normalized,
      ),
    ).toEqual(range);
  });

  it("falls back when declared parser-error ranges touch the wrapper", () => {
    const envelope = envelopeForBody('const marker = "café";\nreturn marker;\n');
    const normalized = normalizeWorkflowBody(envelope);

    expect(
      narrowedSpanForParserError(envelope.sourceFile, normalized, envelope.bodySpan, {
        span: { base: "normalized", start: 0, end: 4 },
      }),
    ).toEqual(envelope.bodySpan);
  });

  it("narrows synthetic parser-error ranges and falls back for real SWC errors", () => {
    const envelope = envelopeForBody('const marker = "café";\nreturn marker;\n');
    const normalized = normalizeWorkflowBody(envelope);
    const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);
    const range = normalizedTokenRange(bodyText, "café", normalized.prefixByteLength);
    const narrowedSpan = narrowedSpanForParserError(
      envelope.sourceFile,
      normalized,
      envelope.bodySpan,
      {
        span: { base: "normalized", ...range },
      },
    );
    const realError = catchSwcParseError(
      normalizeWorkflowBody(envelopeForBody('agent("draft"\n')).normalizedText,
    );

    expect(sliceSourceSpan(envelope.sourceFile, narrowedSpan)).toBe("café");
    expect(
      narrowedSpanForParserError(envelope.sourceFile, normalized, envelope.bodySpan, realError),
    ).toEqual(envelope.bodySpan);
  });
});
