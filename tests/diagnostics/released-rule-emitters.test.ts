/**
 * @file Released rule emitter invariant tests.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASED_RULE_IDS, type RuleId } from "odw-lint";

const CATALOGUE_SOURCE_PATH = join("src", "diagnostics", "rule-catalogue.ts");

// Future entries must explain why a released rule cannot carry a literal
// production emitter reference, for example a computed-id implementation.
const RELEASED_RULES_WITHOUT_EMITTER = Object.freeze([] as const satisfies readonly RuleId[]);

const RELEASED_RULES_WITHOUT_EMITTER_SET = new Set<RuleId>(RELEASED_RULES_WITHOUT_EMITTER);

/** Returns true for production TypeScript sources that can reference emitters. */
const isProductionEmitterSource = (filePath: string): boolean => {
  if (!filePath.endsWith(".ts")) {
    return false;
  }

  return filePath !== CATALOGUE_SOURCE_PATH;
};

/** Returns production TypeScript files whose rule references can emit findings. */
const productionRuleEmitterFiles = (directory: string = "src"): readonly string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...productionRuleEmitterFiles(entryPath));
      continue;
    }

    if (entry.isFile() && isProductionEmitterSource(entryPath)) {
      files.push(entryPath);
    }
  }

  return files.sort();
};

/** Finds production rule ids whose emitters no longer contain a literal id. */
const releasedRulesMissingEmitterReferences = (): readonly string[] => {
  const emitterContents = productionRuleEmitterFiles().map((filePath) => {
    return readFileSync(filePath, "utf8");
  });

  return RELEASED_RULE_IDS.filter((ruleId) => !RELEASED_RULES_WITHOUT_EMITTER_SET.has(ruleId))
    .filter((ruleId) => {
      const ruleLiteral = String(ruleId);

      return !emitterContents.some((contents) => contents.includes(ruleLiteral));
    })
    .map(String);
};

describe("released rule emitters", () => {
  it("keeps every released rule tied to a production emitter", () => {
    expect(RELEASED_RULES_WITHOUT_EMITTER).toEqual([]);
    expect(releasedRulesMissingEmitterReferences()).toEqual([]);
  });
});
