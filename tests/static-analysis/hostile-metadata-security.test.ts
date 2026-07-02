/**
 * @file Hostile metadata security regression tests.
 *
 * This is the fixture-driven regression surface for technical-design §11.3.
 * It lints hostile workflow source text only; it never imports or evaluates
 * any hostile fixture module.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import { scanWorkflowEnvelope } from "../../src/static-analysis/workflow-envelope";
import { classifyWorkflowMetadata } from "../../src/static-analysis/workflow-metadata";
import { readFixtureSource } from "./fixtures/corpus-support";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./fixtures/invalid-workflows";
import {
  expectFreshModuleGraphSuccess,
  freshModuleGraphScript,
  runFreshModuleGraphScript,
} from "./fresh-module-graph";

declare global {
  // The hostile fixture writes this marker only if source is evaluated.
  var __odwLintHostileMetadataWasEvaluated: string | undefined;
}

const HOSTILE_MARKER_PROPERTY = "__odwLintHostileMetadataWasEvaluated";
const FIXTURE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/",
  recursive: true,
} as const;
const HOSTILE_METADATA_FIXTURES = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
  (fixture) => fixture.family === "hostile-metadata",
);
const repositoryRootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Clears the hostile marker so tests can detect fresh evaluation side effects. */
const clearHostileMarker = (): void => {
  Reflect.deleteProperty(globalThis, HOSTILE_MARKER_PROPERTY);
};

/** Reads the hostile marker through the same global property the fixture writes. */
const hostileMarkerValue = (): string | undefined => {
  return globalThis[HOSTILE_MARKER_PROPERTY];
};

/** Lints hostile fixture source through the real static scan and classify path. */
const lintSource = (fixture: { readonly fixturePath: string; readonly sourceText: string }) => {
  const sourceFile = createOriginalSourceFile({
    filePath: fixture.fixturePath,
    sourceText: fixture.sourceText,
  });

  return classifyWorkflowMetadata(scanWorkflowEnvelope(sourceFile));
};

/** Builds the child-process script that imports only the public lint surface. */
const publicEntryImportSafetyScript = (): string => {
  return freshModuleGraphScript([
    `globalThis.${HOSTILE_MARKER_PROPERTY} = undefined;`,
    'const { readFileSync } = await import("node:fs");',
    [
      "const {",
      "  createOriginalSourceFile,",
      "  scanWorkflowEnvelope,",
      "  classifyWorkflowMetadata,",
      '} = await import("odw-lint");',
    ].join("\n"),
    `const fixturePaths = ${JSON.stringify(
      HOSTILE_METADATA_FIXTURES.map((fixture) => fixture.fixturePath),
    )};`,
    [
      "for (const fixturePath of fixturePaths) {",
      '  const sourceText = readFileSync(fixturePath, "utf8");',
      "  const sourceFile = createOriginalSourceFile({ filePath: fixturePath, sourceText });",
      "  const classification = classifyWorkflowMetadata(scanWorkflowEnvelope(sourceFile));",
      "  if (classification.diagnostics.length === 0) {",
      '    failFreshModuleGraphCheck({ code: "missing-diagnostics", fixturePath, status: 2 });',
      "  }",
      `  if (globalThis.${HOSTILE_MARKER_PROPERTY} !== undefined) {`,
      '    failFreshModuleGraphCheck({ code: "hostile-marker-set", fixturePath, status: 3 });',
      "  }",
      "}",
    ].join("\n"),
  ]);
};

describe("hostile metadata security regression", () => {
  beforeEach(() => {
    clearHostileMarker();
  });

  afterEach(() => {
    clearHostileMarker();
  });

  it("detects direct hostile marker writes", () => {
    globalThis.__odwLintHostileMetadataWasEvaluated = "canary";

    expect(hostileMarkerValue()).toBe("canary");
    clearHostileMarker();
    expect(hostileMarkerValue()).toBeUndefined();
  });

  it("has at least one hostile-metadata fixture", () => {
    expect(HOSTILE_METADATA_FIXTURES.length).toBeGreaterThan(0);
  });

  for (const fixture of HOSTILE_METADATA_FIXTURES) {
    it(`lints ${fixture.fileName} without a side effect`, () => {
      let classification: ReturnType<typeof lintSource> | undefined;

      expect(hostileMarkerValue()).toBeUndefined();
      const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fixturePath);

      expect(() => {
        classification = lintSource({ fixturePath: fixture.fixturePath, sourceText });
      }).not.toThrow();

      expect(classification).toBeDefined();
      expect(classification?.diagnostics.length).toBeGreaterThan(0);
      expect(classification?.diagnostics).toEqual(
        fixture.expectedDiagnostics.map((diagnostic) => ({
          file: fixture.fixturePath,
          rule: diagnostic.rule,
          severity: diagnostic.severity,
          message: diagnostic.message,
          span: diagnostic.span,
        })),
      );
      expect(hostileMarkerValue()).toBeUndefined();
    });
  }

  it("stays import-safe through the public entry in a fresh module graph", () => {
    const result = runFreshModuleGraphScript({
      cwd: repositoryRootPath,
      executablePath: process.execPath,
      script: publicEntryImportSafetyScript(),
    });

    expectFreshModuleGraphSuccess(result);
  });
});
