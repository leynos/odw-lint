/**
 * @file Linter configuration schema validation tests.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { CONFIGURED_RULE_SEVERITIES, RULE_IDS, type RuleId, validateLinterConfig } from "odw-lint";

const KNOWN_CONFIG_KEYS = new Set(["include", "exclude", "strictClaude", "rules"]);
const RULE_ID_SET = new Set<string>(RULE_IDS);

describe("linter configuration validation", () => {
  it("validates the canonical configuration example", () => {
    const result = validateLinterConfig({
      include: [".odw/workflows/**/*.js", "workflows/**/*.js"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      strictClaude: false,
      rules: {
        "odw/bounded-loop": "warning",
        "odw/schema-for-structured-agent": "off",
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected canonical config to validate.");
    }

    expect(result.warnings).toEqual([]);
    expect(result.config.include).toEqual([".odw/workflows/**/*.js", "workflows/**/*.js"]);
    expect(result.config.exclude).toEqual(["**/node_modules/**", "**/dist/**"]);
    expect(result.config.strictClaude).toBeFalse();
    expect(result.config.rules).toBeInstanceOf(Map);
    expect(result.config.rules?.get("odw/bounded-loop" as RuleId)).toBe("warning");
    expect(result.config.rules?.get("odw/schema-for-structured-agent" as RuleId)).toBe("off");
  });

  it("validates an empty object to an empty configuration", () => {
    const result = validateLinterConfig({});

    expect(result).toEqual({ ok: true, config: {}, warnings: [] });
  });

  it("fails unknown rule identifiers with the offending identifier", () => {
    const result = validateLinterConfig({ rules: { "odw/not-a-real-rule": "warning" } });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected unknown rule id to fail.");
    }
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        kind: "unknown-rule-id",
        key: "odw/not-a-real-rule",
      }),
    );
  });

  it("fails invalid configured rule severities", () => {
    const result = validateLinterConfig({ rules: { "odw/bounded-loop": "fatal" } });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected invalid severity to fail.");
    }
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        kind: "invalid-rule-severity",
        key: "odw/bounded-loop",
        value: "fatal",
      }),
    );
  });

  it("fails invalid include and exclude values", () => {
    const cases = [
      { value: { include: "workflows/**/*.js" }, kind: "invalid-include" },
      { value: { include: [""] }, kind: "invalid-include" },
      { value: { include: [7] }, kind: "invalid-include" },
      { value: { exclude: "**/dist/**" }, kind: "invalid-exclude" },
      { value: { exclude: [""] }, kind: "invalid-exclude" },
      { value: { exclude: [false] }, kind: "invalid-exclude" },
    ] as const;

    for (const validationCase of cases) {
      const result = validateLinterConfig(validationCase.value);

      expect(result.ok).toBeFalse();
      if (result.ok) {
        throw new Error(`Expected ${validationCase.kind} to fail.`);
      }
      expect(result.errors).toContainEqual(expect.objectContaining({ kind: validationCase.kind }));
    }
  });

  it("fails non-boolean strictClaude values", () => {
    const result = validateLinterConfig({ strictClaude: "true" });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected non-boolean strictClaude to fail.");
    }
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: "invalid-strict-claude", value: "true" }),
    );
  });

  it("fails non-object top-level values", () => {
    for (const value of [undefined, null, true, 42, "config", []]) {
      const result = validateLinterConfig(value);

      expect(result.ok).toBeFalse();
      if (result.ok) {
        throw new Error("Expected non-object top-level value to fail.");
      }
      expect(result.errors).toContainEqual(expect.objectContaining({ kind: "not-an-object" }));
    }
  });

  it("warns for unknown top-level keys while preserving a valid config", () => {
    const result = validateLinterConfig({
      include: ["workflows/**/*.js"],
      futureOption: true,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected unknown top-level key to warn without failing.");
    }
    expect(result.config.include).toEqual(["workflows/**/*.js"]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ kind: "unknown-key", key: "futureOption" }),
    ]);
  });

  it("exposes configured rule severities without mutating diagnostic severities", () => {
    expect(CONFIGURED_RULE_SEVERITIES).toEqual(["error", "warning", "info", "hint", "off"]);
  });
});

describe("linter configuration validation properties", () => {
  it("accepts objects containing only unknown keys and warns once per key", () => {
    fc.assert(
      fc.property(unknownConfigOnlyObject(), (value) => {
        const result = validateLinterConfig(value);
        const keys = Object.keys(value);

        expect(result.ok).toBeTrue();
        if (!result.ok) {
          throw new Error("Expected unknown-only config object to validate.");
        }
        expect(result.warnings.map((warning) => warning.key).sort()).toEqual(keys.sort());
      }),
      { seed: 3_301 },
    );
  });

  it("rejects arbitrary strings outside the rule catalogue as unknown rule ids", () => {
    fc.assert(
      fc.property(unknownRuleIdentifier(), (ruleId) => {
        const result = validateLinterConfig({ rules: { [ruleId]: "warning" } });

        expect(result.ok).toBeFalse();
        if (result.ok) {
          throw new Error(`Expected unknown rule id to fail: ${ruleId}`);
        }
        expect(result.errors).toContainEqual(
          expect.objectContaining({ kind: "unknown-rule-id", key: ruleId }),
        );
      }),
      { seed: 3_302 },
    );
  });
});

/** Builds top-level keys outside the current configuration schema. */
const unknownConfigKey = (): fc.Arbitrary<string> => {
  return fc
    .string({ minLength: 1, maxLength: 16 })
    .filter((key) => !KNOWN_CONFIG_KEYS.has(key) && key !== "__proto__");
};

/** Builds objects whose own keys are all unknown to the current schema. */
const unknownConfigOnlyObject = (): fc.Arbitrary<Record<string, unknown>> => {
  return fc
    .uniqueArray(fc.tuple(unknownConfigKey(), fc.anything()), {
      selector: ([key]) => key,
      maxLength: 8,
    })
    .map((entries) => Object.fromEntries(entries));
};

/** Builds strings that are not catalogued ODW rule identifiers. */
const unknownRuleIdentifier = (): fc.Arbitrary<string> => {
  return fc
    .string({ minLength: 1, maxLength: 32 })
    .filter((ruleId) => !RULE_ID_SET.has(ruleId) && ruleId !== "__proto__");
};
