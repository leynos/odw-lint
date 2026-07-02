/** @file Tests for shared JavaScript identifier character predicates. */

import { describe, expect, it } from "bun:test";
import {
  isIdentifierPartCharacter,
  isIdentifierStartCharacter,
} from "../../src/static-analysis/javascript-identifiers";

describe("JavaScript identifier character predicates", () => {
  it("classifies identifier starts", () => {
    expect(isIdentifierStartCharacter("$")).toBeTrue();
    expect(isIdentifierStartCharacter("_")).toBeTrue();
    expect(isIdentifierStartCharacter("a")).toBeTrue();
    expect(isIdentifierStartCharacter("𐐀")).toBeTrue();
    expect(isIdentifierStartCharacter("0")).toBeFalse();
    expect(isIdentifierStartCharacter("\u200c")).toBeFalse();
    expect(isIdentifierStartCharacter("\u200d")).toBeFalse();
    expect(isIdentifierStartCharacter("-")).toBeFalse();
    expect(isIdentifierStartCharacter("a1")).toBeFalse();
    expect(isIdentifierStartCharacter(undefined)).toBeFalse();
  });

  it("classifies identifier parts", () => {
    expect(isIdentifierPartCharacter("$")).toBeTrue();
    expect(isIdentifierPartCharacter("_")).toBeTrue();
    expect(isIdentifierPartCharacter("a")).toBeTrue();
    expect(isIdentifierPartCharacter("𐐀")).toBeTrue();
    expect(isIdentifierPartCharacter("0")).toBeTrue();
    expect(isIdentifierPartCharacter("\u200c")).toBeTrue();
    expect(isIdentifierPartCharacter("\u200d")).toBeTrue();
    expect(isIdentifierPartCharacter("-")).toBeFalse();
    expect(isIdentifierPartCharacter("a1")).toBeFalse();
    expect(isIdentifierPartCharacter(undefined)).toBeFalse();
  });
});
