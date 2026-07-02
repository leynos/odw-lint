/**
 * @file Hostile metadata security regression tests.
 *
 * This is the fixture-driven regression surface for technical-design §11.3.
 * It lints hostile workflow source text only; it never imports or evaluates
 * any hostile fixture module.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
const HOSTILE_FILESYSTEM_MARKER_ENV = "ODW_LINT_HOSTILE_FS_MARKER_PATH";
const HOSTILE_ENV_PROBE = "ODW_LINT_HOSTILE_ENV_PROBE";
const HOSTILE_ENV_PROBE_VALUE = "hostile-env-probe-canary";
const FIXTURE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/",
  recursive: true,
} as const;
const HOSTILE_METADATA_FIXTURES = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
  (fixture) => fixture.family === "hostile-metadata",
);
const repositoryRootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const filesystemMarkerPaths = new Set<string>();

/** Clears the hostile marker so tests can detect fresh evaluation side effects. */
const clearHostileMarker = (): void => {
  Reflect.deleteProperty(globalThis, HOSTILE_MARKER_PROPERTY);
};

/** Reads the hostile marker through the same global property the fixture writes. */
const hostileMarkerValue = (): string | undefined => {
  return globalThis[HOSTILE_MARKER_PROPERTY];
};

/** Returns the deterministic temp path for the filesystem side-effect marker. */
const hostileFilesystemMarkerPath = (testName: string): string => {
  const safeTestName = testName.replaceAll(/[^a-z0-9-]/gi, "-");
  const markerPath = join(tmpdir(), `odw-lint-hostile-${process.pid}-${safeTestName}.marker`);
  filesystemMarkerPaths.add(markerPath);
  return markerPath;
};

/** Reports whether the filesystem side-effect marker exists on disk. */
const hostileFilesystemMarkerExists = (markerPath: string): boolean => {
  return existsSync(markerPath);
};

/** Removes all filesystem markers registered by this test process. */
const clearHostileFilesystemMarkers = (): void => {
  for (const markerPath of filesystemMarkerPaths) {
    rmSync(markerPath, { force: true });
  }
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
    'const { existsSync, readFileSync } = await import("node:fs");',
    `const markerFilePath = process.env.${HOSTILE_FILESYSTEM_MARKER_ENV};`,
    'if (typeof markerFilePath !== "string" || markerFilePath.length === 0) {',
    '  failFreshModuleGraphCheck({ code: "missing-marker-path", status: 2 });',
    "}",
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
      "  if (existsSync(markerFilePath)) {",
      '    failFreshModuleGraphCheck({ code: "hostile-file-written", fixturePath, status: 4 });',
      "  }",
      "}",
    ].join("\n"),
  ]);
};

describe("hostile metadata security regression", () => {
  beforeEach(() => {
    clearHostileMarker();
    clearHostileFilesystemMarkers();
  });

  afterEach(() => {
    clearHostileMarker();
    clearHostileFilesystemMarkers();
  });

  it("detects direct hostile marker writes", () => {
    globalThis.__odwLintHostileMetadataWasEvaluated = "canary";

    expect(hostileMarkerValue()).toBe("canary");
    clearHostileMarker();
    expect(hostileMarkerValue()).toBeUndefined();
  });

  it("detects direct hostile filesystem marker writes", () => {
    const markerPath = hostileFilesystemMarkerPath("filesystem-canary");

    expect(hostileFilesystemMarkerExists(markerPath)).toBeFalse();
    writeFileSync(markerPath, "canary", "utf8");
    expect(hostileFilesystemMarkerExists(markerPath)).toBeTrue();
    rmSync(markerPath, { force: true });
    expect(hostileFilesystemMarkerExists(markerPath)).toBeFalse();
  });

  it("detects simulated environment-derived marker writes", () => {
    expect(hostileMarkerValue()).toBeUndefined();
    globalThis.__odwLintHostileMetadataWasEvaluated = HOSTILE_ENV_PROBE_VALUE;
    expect(hostileMarkerValue()).toBe(HOSTILE_ENV_PROBE_VALUE);
    clearHostileMarker();
    expect(hostileMarkerValue()).toBeUndefined();
  });

  it("has at least one hostile-metadata fixture", () => {
    expect(HOSTILE_METADATA_FIXTURES.length).toBeGreaterThan(0);
  });

  it("includes a filesystem-write hostile fixture without writing the marker file", () => {
    const markerPath = hostileFilesystemMarkerPath("fs-write-fixture");
    const fixture = HOSTILE_METADATA_FIXTURES.find(
      (candidate) => candidate.fileName === "fs-write-marker.js",
    );

    expect(fixture).toBeDefined();
    if (fixture === undefined) {
      throw new Error("Expected fs-write-marker.js in the hostile metadata corpus.");
    }

    const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fixturePath);
    const classification = lintSource({ fixturePath: fixture.fixturePath, sourceText });

    expect(classification.diagnostics.length).toBeGreaterThan(0);
    expect(hostileFilesystemMarkerExists(markerPath)).toBeFalse();
  });

  it("includes an environment-read hostile fixture without setting the marker", () => {
    const fixture = HOSTILE_METADATA_FIXTURES.find(
      (candidate) => candidate.fileName === "env-read-marker.js",
    );

    expect(fixture).toBeDefined();
    if (fixture === undefined) {
      throw new Error("Expected env-read-marker.js in the hostile metadata corpus.");
    }

    const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fixturePath);
    const classification = lintSource({ fixturePath: fixture.fixturePath, sourceText });

    expect(classification.diagnostics.length).toBeGreaterThan(0);
    expect(hostileMarkerValue()).toBeUndefined();
  });

  for (const fixture of HOSTILE_METADATA_FIXTURES) {
    it(`lints ${fixture.fileName} without a side effect`, () => {
      let classification: ReturnType<typeof lintSource> | undefined;
      const markerPath = hostileFilesystemMarkerPath(`lint-${fixture.fileName}`);

      expect(hostileMarkerValue()).toBeUndefined();
      expect(hostileFilesystemMarkerExists(markerPath)).toBeFalse();
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
      expect(hostileFilesystemMarkerExists(markerPath)).toBeFalse();
    });
  }

  it("stays import-safe through the public entry in a fresh module graph", () => {
    const markerPath = hostileFilesystemMarkerPath("public-entry");
    const result = runFreshModuleGraphScript({
      cwd: repositoryRootPath,
      env: {
        ...process.env,
        [HOSTILE_FILESYSTEM_MARKER_ENV]: markerPath,
        [HOSTILE_ENV_PROBE]: HOSTILE_ENV_PROBE_VALUE,
      },
      executablePath: process.execPath,
      script: publicEntryImportSafetyScript(),
    });

    expectFreshModuleGraphSuccess(result);
    expect(hostileFilesystemMarkerExists(markerPath)).toBeFalse();
  });
});
