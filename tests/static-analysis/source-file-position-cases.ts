/**
 * @file Position-mapping cases for original source-file tests.
 */

import type { SourcePosition } from "odw-lint";

export type SourcePositionCase = {
  /** Human-readable case name. */
  readonly name: string;
  /** Original source text used to build the source-file record. */
  readonly sourceText: string;
  /** Offset to convert into a display position. */
  readonly offset: number;
  /** Expected display position. */
  readonly position: SourcePosition;
};

export type InvalidOffsetCase = {
  /** Human-readable case name. */
  readonly name: string;
  /** Original source text used to build the source-file record. */
  readonly sourceText: string;
  /** Invalid offset that should be rejected. */
  readonly offset: number;
};

/** Valid byte-offset to display-position examples. */
export const SOURCE_POSITION_CASES: readonly SourcePositionCase[] = [
  {
    name: "empty source starts at line one column one",
    sourceText: "",
    offset: 0,
    position: { offset: 0, line: 1, column: 1 },
  },
  {
    name: "ASCII start",
    sourceText: "ab",
    offset: 0,
    position: { offset: 0, line: 1, column: 1 },
  },
  {
    name: "ASCII second code point",
    sourceText: "ab",
    offset: 1,
    position: { offset: 1, line: 1, column: 2 },
  },
  {
    name: "ASCII EOF",
    sourceText: "ab",
    offset: 2,
    position: { offset: 2, line: 1, column: 3 },
  },
  {
    name: "LF terminator start",
    sourceText: "ab\nc",
    offset: 2,
    position: { offset: 2, line: 1, column: 3 },
  },
  {
    name: "after LF terminator",
    sourceText: "ab\nc",
    offset: 3,
    position: { offset: 3, line: 2, column: 1 },
  },
  {
    name: "CRLF terminator start",
    sourceText: "ab\r\nc",
    offset: 2,
    position: { offset: 2, line: 1, column: 3 },
  },
  {
    name: "after CRLF terminator",
    sourceText: "ab\r\nc",
    offset: 4,
    position: { offset: 4, line: 2, column: 1 },
  },
  {
    name: "CR terminator start",
    sourceText: "ab\rc",
    offset: 2,
    position: { offset: 2, line: 1, column: 3 },
  },
  {
    name: "after CR terminator",
    sourceText: "ab\rc",
    offset: 3,
    position: { offset: 3, line: 2, column: 1 },
  },
  {
    name: "JavaScript line separator terminator start",
    sourceText: "ab\u2028c",
    offset: 2,
    position: { offset: 2, line: 1, column: 3 },
  },
  {
    name: "after JavaScript line separator",
    sourceText: "ab\u2028c",
    offset: 5,
    position: { offset: 5, line: 2, column: 1 },
  },
  {
    name: "JavaScript paragraph separator terminator start",
    sourceText: "ab\u2029c",
    offset: 2,
    position: { offset: 2, line: 1, column: 3 },
  },
  {
    name: "after JavaScript paragraph separator",
    sourceText: "ab\u2029c",
    offset: 5,
    position: { offset: 5, line: 2, column: 1 },
  },
  {
    name: "BMP Unicode code point end",
    sourceText: "é",
    offset: 2,
    position: { offset: 2, line: 1, column: 2 },
  },
  {
    name: "non-BMP code point end",
    sourceText: "😀",
    offset: 4,
    position: { offset: 4, line: 1, column: 2 },
  },
  {
    name: "trailing newline EOF",
    sourceText: "x\n",
    offset: 2,
    position: { offset: 2, line: 2, column: 1 },
  },
];

/** Invalid source offsets rejected by original-source position helpers. */
export const INVALID_OFFSET_CASES: readonly InvalidOffsetCase[] = [
  {
    name: "negative offset",
    sourceText: "ab",
    offset: -1,
  },
  {
    name: "non-integer offset",
    sourceText: "ab",
    offset: 1.5,
  },
  {
    name: "past EOF",
    sourceText: "ab",
    offset: 3,
  },
  {
    name: "inside BMP UTF-8 code point",
    sourceText: "é",
    offset: 1,
  },
  {
    name: "inside non-BMP UTF-8 code point",
    sourceText: "😀",
    offset: 2,
  },
  {
    name: "inside CRLF terminator",
    sourceText: "a\r\nb",
    offset: 2,
  },
  {
    name: "inside JavaScript line separator terminator",
    sourceText: "a\u2028b",
    offset: 2,
  },
  {
    name: "inside JavaScript paragraph separator terminator",
    sourceText: "a\u2029b",
    offset: 3,
  },
];
