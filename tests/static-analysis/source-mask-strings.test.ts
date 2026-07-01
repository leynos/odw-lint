/**
 * @file Focused tests for source-mask quoted-string scanning.
 *
 * These tests pin string scanner edge cases without depending on facade-level
 * masking behaviour.
 */

import { describe, expect, it } from "bun:test";
import {
  scanQuotedStringEnd,
  scanQuotedStringRange,
} from "../../src/static-analysis/source-mask-strings";

describe("source-mask quoted-string scanner", () => {
  it("skips escaped delimiters", () => {
    expect(scanQuotedStringEnd("'\\''", 0, "'")).toBe(4);
  });

  it("returns the source end for unterminated strings without line terminators", () => {
    expect(scanQuotedStringEnd("'open", 0, "'")).toBe(5);
  });

  it("stops before unescaped line terminators", () => {
    expect(scanQuotedStringEnd("'open\nnext", 0, "'")).toBe(5);
    expect(scanQuotedStringEnd("'open\r\nnext", 0, "'")).toBe(5);
    expect(scanQuotedStringEnd("'open\u2028next", 0, "'")).toBe(5);
    expect(scanQuotedStringEnd("'open\u2029next", 0, "'")).toBe(5);
  });

  it("consumes escaped CRLF line continuations", () => {
    expect(scanQuotedStringEnd("'a\\\r\nb'", 0, "'")).toBe(7);
  });

  it("uses the quoted-string end for mask ranges", () => {
    expect(scanQuotedStringRange("'open\nconst next = 1;", 0, "'")).toEqual({
      kind: "string",
      startIndex: 0,
      endIndex: 5,
    });
  });
});
