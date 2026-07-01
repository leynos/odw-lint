/**
 * @file Focused tests for source-mask regex scanning.
 *
 * These tests pin regex scanner edge cases without depending only on the
 * facade-level source-mask contract tests.
 */

import { describe, expect, it } from "bun:test";
import {
  isLeadingRegexClassClose,
  isRegexAllowedAfter,
  isRegexClassClose,
  scanRegexEnd,
  scanRegexFlagsEnd,
  scanRegexRange,
} from "../../src/static-analysis/source-mask-regex";

describe("source-mask regex scanner", () => {
  it("applies prefix keyword and postfix token heuristics", () => {
    expect(isRegexAllowedAfter("n", "return")).toBeTrue();
    expect(isRegexAllowedAfter("+", "++")).toBeFalse();
    expect(scanRegexRange("/x/", 0, "/", "n", "return")).toEqual({
      kind: "regex",
      startIndex: 0,
      endIndex: 3,
    });
    expect(scanRegexRange("/x/", 0, "/", "+", "++")).toBeUndefined();
  });

  it("scans escaped slashes and flags", () => {
    expect(scanRegexEnd("/a\\/b/g", 0)).toBe(7);
    expect(scanRegexFlagsEnd("/x/gim;", 3)).toBe(6);
  });

  it("rejects line terminators and empty regex bodies", () => {
    expect(scanRegexEnd("/abc\nnext/", 0)).toBeUndefined();
    expect(scanRegexEnd("//", 0)).toBeUndefined();
    expect(scanRegexRange("//", 0, "/", "(", "(")).toBeUndefined();
  });

  it("keeps leading class-close literals inside character classes", () => {
    const sourceText = "/[]/]/g";

    expect(isLeadingRegexClassClose(sourceText, 2)).toBeTrue();
    expect(isRegexClassClose(sourceText, 2, true)).toBeFalse();
    expect(isRegexClassClose(sourceText, 4, true)).toBeTrue();
    expect(scanRegexEnd(sourceText, 0)).toBe(sourceText.length);
  });
});
