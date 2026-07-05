/** @file Tests for consolidated balanced-region scanner primitives. */

import { describe, expect, it } from "bun:test";
import {
  nextInertRegionEnd,
  scanBalancedExpressionEnd,
} from "../../src/static-analysis/source-scanner-primitives";

describe("nextInertRegionEnd", () => {
  it("returns the end of a string-like region", () => {
    const sourceText = "'{ignored}' + value";

    expect(nextInertRegionEnd(sourceText, 0, sourceText.length)).toBe(11);
  });

  it("returns the end of a line comment without consuming its terminator", () => {
    const sourceText = "// } ignored\nvalue";

    expect(nextInertRegionEnd(sourceText, 0, sourceText.length)).toBe(12);
  });

  it("returns the end of a block comment", () => {
    const sourceText = "/* } ignored */value";

    expect(nextInertRegionEnd(sourceText, 0, sourceText.length)).toBe(15);
  });

  it("returns undefined for ordinary source", () => {
    expect(nextInertRegionEnd("value", 0, 5)).toBeUndefined();
  });
});

describe("scanBalancedExpressionEnd", () => {
  it("returns the index after matching nested braces", () => {
    const sourceText = "{ outer: { inner: true } } tail";

    expect(
      scanBalancedExpressionEnd(sourceText, 0, sourceText.length, {
        open: "{",
        close: "}",
      }),
    ).toBe(sourceText.indexOf(" tail"));
  });

  it("ignores braces inside inert strings and comments", () => {
    const sourceText = "{ text: '} ', block: /* } */ true, line: // }\nvalue } tail";

    expect(
      scanBalancedExpressionEnd(sourceText, 0, sourceText.length, {
        open: "{",
        close: "}",
      }),
    ).toBe(sourceText.indexOf(" tail"));
  });

  it("returns the scan bound when the expression is unterminated", () => {
    const sourceText = "{ value: { nested: true ";

    expect(
      scanBalancedExpressionEnd(sourceText, 0, sourceText.length, {
        open: "{",
        close: "}",
      }),
    ).toBe(sourceText.length);
  });

  it("supports bracket pairs", () => {
    const sourceText = "[first, [second]] tail";

    expect(
      scanBalancedExpressionEnd(sourceText, 0, sourceText.length, {
        open: "[",
        close: "]",
      }),
    ).toBe(sourceText.indexOf(" tail"));
  });

  it("supports scans that start inside an already-open expression", () => {
    const sourceText = "$" + "{ value: { nested: true } } tail";

    expect(
      scanBalancedExpressionEnd(sourceText, 2, sourceText.length, {
        open: "{",
        close: "}",
        initiallyOpen: true,
      }),
    ).toBe(sourceText.indexOf(" tail"));
  });
});
