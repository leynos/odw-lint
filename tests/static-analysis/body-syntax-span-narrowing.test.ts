/**
 * @file Tests for body-syntax diagnostic span narrowing.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { normalizeWorkflowBody, sliceSourceSpan } from "odw-lint";
import { narrowBodySyntaxSpan } from "../../src/static-analysis/workflow-body-normalizer";
import { normalizedTokenRange } from "./normalized-byte-range-support";
import { envelopeForBody } from "./workflow-envelope-support";

const PROPERTY_RUNNER = {
  numRuns: 100,
} as const;

describe("narrowBodySyntaxSpan", () => {
  it("narrows a structured normalized range to the original token", () => {
    const body = 'const marker = "café";\nreturn marker;\n';
    const envelope = envelopeForBody(body);
    const normalized = normalizeWorkflowBody(envelope);
    const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);
    const range = normalizedTokenRange(bodyText, "café", normalized.prefixByteLength);
    const span = narrowBodySyntaxSpan(envelope.sourceFile, normalized, envelope.bodySpan, range);

    expect(sliceSourceSpan(envelope.sourceFile, span)).toBe("café");
    expect(span.start.offset).toBeGreaterThan(envelope.bodySpan.start.offset);
    expect(span.end.offset).toBeLessThan(envelope.bodySpan.end.offset);
  });

  it("falls back to the whole body when no range is available", () => {
    const envelope = envelopeForBody("const marker = 42;\n");
    const normalized = normalizeWorkflowBody(envelope);

    expect(narrowBodySyntaxSpan(envelope.sourceFile, normalized, envelope.bodySpan)).toEqual(
      envelope.bodySpan,
    );
  });

  it.each([
    ["wrapper prefix", { start: 0, end: 4 }],
    ["reversed range", { start: 12, end: 8 }],
  ] as const)("falls back for a %s range without throwing", (_description, range) => {
    const envelope = envelopeForBody("const marker = 42;\n");
    const normalized = normalizeWorkflowBody(envelope);

    expect(() =>
      narrowBodySyntaxSpan(envelope.sourceFile, normalized, envelope.bodySpan, range),
    ).not.toThrow();
    expect(narrowBodySyntaxSpan(envelope.sourceFile, normalized, envelope.bodySpan, range)).toEqual(
      envelope.bodySpan,
    );
  });

  it("maps any in-body range to a non-reversed body-contained span", () => {
    const body = "const marker = 42;\nreturn marker;\n";
    const envelope = envelopeForBody(body);
    const normalized = normalizeWorkflowBody(envelope);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: normalized.bodyByteLength }),
        fc.integer({ min: 0, max: normalized.bodyByteLength }),
        (firstOffset, secondOffset) => {
          const relativeStart = Math.min(firstOffset, secondOffset);
          const relativeEnd = Math.max(firstOffset, secondOffset);
          const span = narrowBodySyntaxSpan(envelope.sourceFile, normalized, envelope.bodySpan, {
            start: normalized.prefixByteLength + relativeStart,
            end: normalized.prefixByteLength + relativeEnd,
          });

          expect(span.start.offset).toBeGreaterThanOrEqual(envelope.bodySpan.start.offset);
          expect(span.end.offset).toBeLessThanOrEqual(envelope.bodySpan.end.offset);
          expect(span.start.offset).toBeLessThanOrEqual(span.end.offset);
        },
      ),
      PROPERTY_RUNNER,
    );
  });
});
