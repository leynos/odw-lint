/**
 * @file Rule identifier contract tests.
 */

import { describe, expect, it } from "bun:test";
import { InvalidRuleIdError, isRuleId, makeRuleId, parseRuleId } from "odw-lint";
import { documentedRuleIds, invalidRuleIds } from "./fixtures";

describe("rule identifiers", () => {
  it("accepts documented rule identifiers", () => {
    for (const ruleId of documentedRuleIds) {
      const result = parseRuleId(ruleId);

      expect(result.ok).toBeTrue();
      if (!result.ok) {
        throw new Error(`Expected documented rule id to parse: ${ruleId}`);
      }
      expect(String(result.value)).toBe(ruleId);
      expect(isRuleId(ruleId)).toBeTrue();
      expect(String(makeRuleId(ruleId))).toBe(ruleId);
    }
  });

  it("returns discriminated errors for invalid rule identifiers", () => {
    for (const { value, reason } of invalidRuleIds) {
      const result = parseRuleId(value);

      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: "invalid-rule-id",
          reason,
          value,
        },
      });
      expect(isRuleId(value)).toBeFalse();
    }
  });

  it("does not throw when parsing invalid rule identifiers", () => {
    expect(() => parseRuleId("odw/meta--required")).not.toThrow();
  });

  it("throws structured errors for trusted invalid construction", () => {
    const parsed = parseRuleId("odw/meta--required");

    expect(parsed.ok).toBeFalse();
    if (parsed.ok) {
      throw new Error("Expected invalid parse result for doubled hyphen.");
    }

    expect(() => makeRuleId("odw/meta--required")).toThrow(InvalidRuleIdError);

    try {
      makeRuleId("odw/meta--required");
      throw new Error("Expected makeRuleId to throw for doubled hyphen.");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidRuleIdError);
      if (!(error instanceof InvalidRuleIdError)) {
        throw error;
      }
      expect(error.detail).toEqual(parsed.error);
    }
  });
});
