/**
 * @file Tests for shared compact-operator token handling.
 */

import { describe, expect, it } from "bun:test";
import { compactOperatorTokenEndingAt } from "../../src/static-analysis/source-scanner-primitives";

describe("compactOperatorTokenEndingAt", () => {
  it("recognizes doubled increment and decrement operators", () => {
    expect(compactOperatorTokenEndingAt("a++", 2)).toBe("++");
    expect(compactOperatorTokenEndingAt("a--", 2)).toBe("--");
  });

  it("keeps single-character operators unchanged", () => {
    expect(compactOperatorTokenEndingAt("a+b", 1)).toBe("+");
    expect(compactOperatorTokenEndingAt("+", 0)).toBe("+");
  });
});
