/** @file Tests for shared source-scanner classification primitives. */

import { describe, expect, it } from "bun:test";
import {
  codePointStringAt,
  isCrLfAt,
  isSourceLineTerminator,
} from "../../src/static-analysis/source-scanner-primitives";

describe("source scanner classification primitives", () => {
  it("classifies JavaScript source line terminators", () => {
    for (const character of ["\n", "\r", "\u2028", "\u2029"]) {
      expect(isSourceLineTerminator(character)).toBeTrue();
    }

    for (const character of [" ", "\v", "\f", "\u00a0", ""]) {
      expect(isSourceLineTerminator(character)).toBeFalse();
    }
  });

  it("detects CRLF pairs at an index", () => {
    expect(isCrLfAt("\r\n", 0)).toBeTrue();
    expect(isCrLfAt("x\r\ny", 1)).toBeTrue();
    expect(isCrLfAt("\r", 0)).toBeFalse();
    expect(isCrLfAt("\n\r", 0)).toBeFalse();
    expect(isCrLfAt("x\r", 1)).toBeFalse();
  });

  it("reads full code point strings", () => {
    const astral = "a𐐀b";

    expect(codePointStringAt(astral, 0)).toBe("a");
    expect(codePointStringAt(astral, 1)).toBe("𐐀");
    expect(codePointStringAt("é", 0)).toBe("é");
    expect(codePointStringAt(astral, 2)).toBe("\udc00");
    expect(codePointStringAt(astral, astral.length)).toBe("");
  });
});
