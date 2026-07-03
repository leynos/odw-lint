/**
 * @file Tests for workflow body normalization and span mapping.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import {
  type NormalizedWorkflowBody,
  normalizeWorkflowBody,
  originalSpanFromNormalizedOffsets,
  SourceOffsetError,
  sliceSourceSpan,
} from "odw-lint";
import { utf8ByteLength } from "../../src/static-analysis/utf8";
import { envelopeForBody } from "./workflow-envelope-support";

const WORKFLOW_BODY_WRAP_PREFIX = "async function __odwLintWorkflowBody__() {";
const PROPERTY_RUNNER = {
  numRuns: 100,
} as const;
const SAFE_BODY_CHARACTER = fc.constantFrom("a", "b", "c", " ", "\n", ";", "(", ")", "é", "雪");

/** Returns the UTF-8 byte length of a JavaScript string. */
const byteLength = (text: string): number => utf8ByteLength(text);

/** Returns the UTF-8 byte offset for a UTF-16 string index. */
const byteOffsetAtIndex = (text: string, index: number): number => {
  return byteLength(text.slice(0, index));
};

/** Builds a scanned workflow envelope whose body is exactly the supplied text. */
const exactBodyEnvelope = (body: string) => envelopeForBody(body, { separator: "" });

/** Converts body-relative byte offsets to normalized-source byte offsets. */
const inBodyByteRange = (
  normalized: NormalizedWorkflowBody,
  relativeStart: number,
  relativeEnd: number,
): readonly [number, number] => [
  normalized.prefixByteLength + relativeStart,
  normalized.prefixByteLength + relativeEnd,
];

describe("normalizeWorkflowBody", () => {
  it("wraps the original body in an async function", () => {
    const envelope = exactBodyEnvelope("return { done: true };\n");
    const normalized = normalizeWorkflowBody(envelope);
    const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);

    expect(normalized.normalizedText).toMatchSnapshot();
    expect(bodyText).toBe("return { done: true };\n");
    expect(normalized.prefixByteLength).toBe(byteLength(WORKFLOW_BODY_WRAP_PREFIX));
    expect(normalized.bodyByteOffset).toBe(envelope.bodySpan.start.offset);
  });

  it("maps a normalized identifier span back to original source", () => {
    const envelope = exactBodyEnvelope('const snow = "雪";\nconst marker = 42;\nreturn marker;\n');
    const normalized = normalizeWorkflowBody(envelope);
    const markerIndex = normalized.normalizedText.indexOf("marker");
    const startByte = byteOffsetAtIndex(normalized.normalizedText, markerIndex);
    const endByte = startByte + byteLength("marker");

    const span = originalSpanFromNormalizedOffsets(
      envelope.sourceFile,
      normalized,
      startByte,
      endByte,
    );

    expect(sliceSourceSpan(envelope.sourceFile, span)).toBe("marker");
  });

  it("keeps the wrapper suffix outside trailing line comments", () => {
    const envelope = exactBodyEnvelope("const x = 1;\n// trailing");
    const normalized = normalizeWorkflowBody(envelope);

    expect(normalized.normalizedText.endsWith("\n}")).toBe(true);
    expect(normalized.normalizedText).toContain("// trailing\n}");
  });

  it("rejects normalized offsets outside the original body", () => {
    const envelope = exactBodyEnvelope("const marker = 42;\n");
    const normalized = normalizeWorkflowBody(envelope);

    expect(() =>
      originalSpanFromNormalizedOffsets(
        envelope.sourceFile,
        normalized,
        normalized.prefixByteLength - 1,
        normalized.prefixByteLength,
      ),
    ).toThrow(SourceOffsetError);
    expect(() =>
      originalSpanFromNormalizedOffsets(
        envelope.sourceFile,
        normalized,
        normalized.prefixByteLength + normalized.bodyByteLength,
        normalized.prefixByteLength + normalized.bodyByteLength + 1,
      ),
    ).toThrow(SourceOffsetError);
  });

  it("returns a frozen record", () => {
    expect(Object.isFrozen(normalizeWorkflowBody(exactBodyEnvelope("const x = 1;\n")))).toBe(true);
  });

  it("maps arbitrary in-body byte slices to the same original text", () => {
    fc.assert(
      fc.property(
        fc.array(SAFE_BODY_CHARACTER, { minLength: 1, maxLength: 24 }),
        fc.integer({ min: 0, max: 64 }),
        fc.integer({ min: 0, max: 64 }),
        (bodyCharacters, firstChoice, secondChoice) => {
          const body = bodyCharacters.join("");
          const envelope = exactBodyEnvelope(body);
          const normalized = normalizeWorkflowBody(envelope);
          const firstIndex = firstChoice % (bodyCharacters.length + 1);
          const secondIndex = secondChoice % (bodyCharacters.length + 1);
          const startIndex = Math.min(firstIndex, secondIndex);
          const endIndex = Math.max(firstIndex, secondIndex);
          const start = byteLength(bodyCharacters.slice(0, startIndex).join(""));
          const end = byteLength(bodyCharacters.slice(0, endIndex).join(""));
          const [normalizedStart, normalizedEnd] = inBodyByteRange(normalized, start, end);

          const span = originalSpanFromNormalizedOffsets(
            envelope.sourceFile,
            normalized,
            normalizedStart,
            normalizedEnd,
          );

          expect(sliceSourceSpan(envelope.sourceFile, span)).toBe(
            bodyCharacters.slice(startIndex, endIndex).join(""),
          );
        },
      ),
      PROPERTY_RUNNER,
    );
  });
});
