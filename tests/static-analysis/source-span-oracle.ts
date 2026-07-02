/**
 * @file Shared UTF-8 byte-offset assertions for source-span tests.
 */

import { expect } from "bun:test";
import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";
import type { SourceSpan } from "odw-lint";

const SPAN_DECODER = new TextDecoder("utf-8", { fatal: true });

/**
 * Decodes a UTF-8 byte range from source text.
 *
 * @param sourceText - Full original source text that owns the span.
 * @param span - Source span whose byte offsets select the decoded range.
 * @returns The source text covered by the UTF-8 byte range.
 */
export const decodeSpanText = (sourceText: string, span: SourceSpan): string => {
  const sourceBytes = Buffer.from(sourceText, "utf8");

  return SPAN_DECODER.decode(sourceBytes.subarray(span.start.offset, span.end.offset));
};

/**
 * Converts a UTF-8 byte offset into one-based line and Unicode-code-point column.
 *
 * @param sourceText - Full original source text that owns the offset.
 * @param offset - Zero-based UTF-8 byte offset to recompute.
 * @returns The source position that corresponds to the byte offset.
 */
export const positionForOffset = (sourceText: string, offset: number): SourceSpan["start"] => {
  const prefix = Buffer.from(sourceText, "utf8").subarray(0, offset);
  const prefixText = SPAN_DECODER.decode(prefix);
  const lines = prefixText.split("\n");
  const finalLine = lines.at(-1) ?? "";

  return {
    offset,
    line: lines.length,
    column: Array.from(finalLine).length + 1,
  };
};

/**
 * Asserts that a source span matches the repository UTF-8 byte-offset contract.
 *
 * @param sourceText - Full original source text that owns the span.
 * @param span - Source span to check against the original bytes.
 * @param expectedSpanText - Expected decoded source text for the span.
 */
export const expectSpanToMatchSource = (
  sourceText: string,
  span: SourceSpan,
  expectedSpanText: string,
): void => {
  const sourceByteLength = Buffer.byteLength(sourceText, "utf8");

  expect(span.start.offset).toBeGreaterThanOrEqual(0);
  expect(span.end.offset).toBeGreaterThanOrEqual(span.start.offset);
  expect(span.end.offset).toBeLessThanOrEqual(sourceByteLength);
  expect(positionForOffset(sourceText, span.start.offset)).toEqual(span.start);
  expect(positionForOffset(sourceText, span.end.offset)).toEqual(span.end);
  expect(decodeSpanText(sourceText, span)).toBe(expectedSpanText);
};
