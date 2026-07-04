/** @file Tests for shared source-scanner escape primitives. */

import { describe, expect, it } from "bun:test";
import { indexAfterEscapedUnit } from "../../src/static-analysis/source-scanner-primitives";

describe("source scanner escape primitives", () => {
  it("advances past escaped units without interpreting them", () => {
    expect(indexAfterEscapedUnit(String.raw`a\"b`, 1)).toBe(3);
    expect(indexAfterEscapedUnit(String.raw`'\'`, 1)).toBe(3);
  });

  it("treats escaped astral characters as one UTF-16 unit", () => {
    const escapedAstralText = "\\😀";

    expect(escapedAstralText.length).toBe(3);
    expect(indexAfterEscapedUnit(escapedAstralText, 0)).toBe(2);
  });

  it("preserves the caller-owned EOF contract", () => {
    expect(indexAfterEscapedUnit("\\", 0)).toBe(2);
  });
});
