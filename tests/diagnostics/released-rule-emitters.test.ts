/**
 * @file Released rule emitter invariant tests.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASED_RULE_IDS, type RuleId } from "odw-lint";
import { lintWorkflowSource } from "../../src/static-analysis/workflow-lint";

const CATALOGUE_SOURCE_PATH = join("src", "diagnostics", "rule-catalogue.ts");

type EmissionFixture = {
  readonly name: string;
  readonly sourceText: string;
};

const RELEASED_RULE_EMISSION_FIXTURES = Object.freeze([
  {
    name: "missing-meta",
    sourceText: ["phase('Run');", "await agent('Draft status.');"].join("\n"),
  },
  {
    name: "invalid-meta-shape",
    sourceText: ["export const meta = 'not an object';", "await agent('Draft status.');"].join(
      "\n",
    ),
  },
  {
    name: "invalid-metadata-fields",
    sourceText: [
      "export const meta = { name: '', description: 123 };",
      "await agent('Draft status.');",
    ].join("\n"),
  },
  {
    name: "computed-meta",
    sourceText: [
      "export const meta = {",
      "  name: 'computed-meta',",
      "  description: 'Computed ' + 'description.',",
      "};",
      "await agent('Draft status.');",
    ].join("\n"),
  },
  {
    name: "claude-impure-meta",
    sourceText: [
      "export const meta = {",
      "  name: 'claude-impure-meta',",
      "  description: 'Claude impure metadata fixture.',",
      "  retries: 1 - 2,",
      "};",
      "await agent('Draft status.');",
    ].join("\n"),
  },
  {
    name: "unsupported-import",
    sourceText: [
      "import { helper } from './helper.js';",
      "export const meta = { name: 'unsupported-import', description: 'Import fixture.' };",
      "await agent(helper);",
    ].join("\n"),
  },
  {
    name: "body-syntax",
    sourceText: [
      "export const meta = { name: 'body-syntax', description: 'Broken body fixture.' };",
      "await agent('draft'",
    ].join("\n"),
  },
  {
    name: "deterministic-time-and-validate",
    sourceText: [
      "export const meta = {",
      "  name: 'deterministic-time-and-validate',",
      "  description: 'Clock and validation fixture.',",
      "};",
      "const timestamp = Date.now();",
      "const sample = Math.random();",
      "const startedAt = new Date();",
      "const validation = validate(args.generatedWorkflowSource);",
      "await agent(String(timestamp) + sample + startedAt + validation.ok);",
    ].join("\n"),
  },
] as const satisfies readonly EmissionFixture[]);

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

/** Runs the shared production pipeline over the released-rule fixtures. */
const emittedRuleIdsFromProductionPipeline = (): readonly string[] => {
  const emittedRuleIds = new Set<RuleId>();

  for (const fixture of RELEASED_RULE_EMISSION_FIXTURES) {
    const result = lintWorkflowSource({
      filePath: `fixtures/${fixture.name}.js`,
      sourceText: fixture.sourceText,
    });

    for (const diagnostic of result.diagnostics) {
      emittedRuleIds.add(diagnostic.rule);
    }
  }

  return [...emittedRuleIds].map(String).sort();
};

describe("released rule emitters", () => {
  it("keeps every released rule tied to a production emitter", () => {
    expect(RELEASED_RULES_WITHOUT_EMITTER).toEqual([]);
    expect(releasedRulesMissingEmitterReferences()).toEqual([]);
  });

  it("keeps every released rule emitted by the production pipeline", () => {
    expect(emittedRuleIdsFromProductionPipeline()).toEqual(RELEASED_RULE_IDS.map(String).sort());
  });
});
