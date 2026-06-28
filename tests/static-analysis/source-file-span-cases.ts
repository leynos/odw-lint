/**
 * @file Span-slicing cases for original source-file tests.
 */

import type { SourceSpan } from "odw-lint";

export type SourceSpanCase = {
  /** Human-readable case name. */
  readonly name: string;
  /** Original source text used to build the source-file record. */
  readonly sourceText: string;
  /** Inclusive start byte offset for the source span. */
  readonly startOffset: number;
  /** Exclusive end byte offset for the source span. */
  readonly endOffset: number;
  /** Expected validated source span. */
  readonly span: SourceSpan;
  /** Expected exact original slice for the span. */
  readonly text: string;
  /** Expected first source line text for snippets. */
  readonly lineText: string;
};

export type InvalidSpanCase = {
  /** Human-readable case name. */
  readonly name: string;
  /** Original source text used to build the source-file record. */
  readonly sourceText: string;
  /** Caller-supplied source span that should be rejected. */
  readonly span: SourceSpan;
};

/** Valid source spans that must round-trip to original text snippets. */
export const SOURCE_SPAN_CASES: readonly SourceSpanCase[] = [
  {
    name: "ASCII middle",
    sourceText: "abcdef",
    startOffset: 1,
    endOffset: 4,
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 4, line: 1, column: 5 },
    },
    text: "bcd",
    lineText: "abcdef",
  },
  {
    name: "LF multiline",
    sourceText: "ab\ncd",
    startOffset: 1,
    endOffset: 4,
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 4, line: 2, column: 2 },
    },
    text: "b\nc",
    lineText: "ab",
  },
  {
    name: "CRLF multiline",
    sourceText: "ab\r\ncd",
    startOffset: 1,
    endOffset: 5,
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 5, line: 2, column: 2 },
    },
    text: "b\r\nc",
    lineText: "ab",
  },
  {
    name: "CR multiline",
    sourceText: "ab\rcd",
    startOffset: 1,
    endOffset: 4,
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 4, line: 2, column: 2 },
    },
    text: "b\rc",
    lineText: "ab",
  },
  {
    name: "JavaScript line and paragraph separator multiline",
    sourceText: "ab\u2028cd\u2029ef",
    startOffset: 1,
    endOffset: 11,
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 11, line: 3, column: 2 },
    },
    text: "b\u2028cd\u2029e",
    lineText: "ab",
  },
  {
    name: "Unicode code point",
    sourceText: "é😀x",
    startOffset: 2,
    endOffset: 6,
    span: {
      start: { offset: 2, line: 1, column: 2 },
      end: { offset: 6, line: 1, column: 3 },
    },
    text: "😀",
    lineText: "é😀x",
  },
  {
    name: "zero-length EOF",
    sourceText: "ab",
    startOffset: 2,
    endOffset: 2,
    span: {
      start: { offset: 2, line: 1, column: 3 },
      end: { offset: 2, line: 1, column: 3 },
    },
    text: "",
    lineText: "ab",
  },
  {
    name: "trailing newline",
    sourceText: "x\n",
    startOffset: 1,
    endOffset: 2,
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 2, line: 2, column: 1 },
    },
    text: "\n",
    lineText: "x",
  },
];

/** Caller-supplied spans rejected before slicing original source text. */
export const INVALID_SOURCE_SPAN_CASES: readonly InvalidSpanCase[] = [
  {
    name: "reversed offsets",
    sourceText: "ab",
    span: {
      start: { offset: 2, line: 1, column: 3 },
      end: { offset: 1, line: 1, column: 2 },
    },
  },
  {
    name: "past EOF",
    sourceText: "ab",
    span: {
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 3, line: 1, column: 4 },
    },
  },
  {
    name: "inside CRLF terminator",
    sourceText: "a\r\nb",
    span: {
      start: { offset: 2, line: 1, column: 3 },
      end: { offset: 3, line: 2, column: 1 },
    },
  },
  {
    name: "inside JavaScript line separator terminator",
    sourceText: "a\u2028b",
    span: {
      start: { offset: 2, line: 1, column: 3 },
      end: { offset: 4, line: 2, column: 1 },
    },
  },
  {
    name: "inside JavaScript paragraph separator terminator",
    sourceText: "a\u2029b",
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 3, line: 1, column: 3 },
    },
  },
  {
    name: "inside multibyte UTF-8 code point",
    sourceText: "é",
    span: {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 2, line: 1, column: 2 },
    },
  },
  {
    name: "mismatched start line",
    sourceText: "ab",
    span: {
      start: { offset: 0, line: 2, column: 1 },
      end: { offset: 1, line: 1, column: 2 },
    },
  },
  {
    name: "mismatched end column",
    sourceText: "ab",
    span: {
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 2, line: 1, column: 99 },
    },
  },
];
