/**
 * @file Loader-parity harness tests for trusted ODW workflow examples.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkflowSource } from "odw-lint";
import { importArchitectureFactsFromSource } from "../diagnostics/import-edge-extraction";
import { isForbiddenOdwImport } from "../diagnostics/odw-import-policy";
import { readFixtureSource } from "./fixtures/corpus-support";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./fixtures/invalid-workflows";
import {
  expectedInvalidFixtureOutcome,
  expectedNoErrorOutcome,
  loaderParityOutcome,
} from "./fixtures/loader-parity";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./fixtures/odw-examples";

const TRUSTED_EXAMPLE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/odw-examples/", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/odw-examples/",
} as const;
const INVALID_FIXTURE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/",
  recursive: true,
} as const;
const PROJECT_ROOT_URL = new URL("../../", import.meta.url);
const HARNESS_ENTRYPOINT_URLS = [new URL("./loader-parity.test.ts", import.meta.url)] as const;
const TYPESCRIPT_SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;
const HOSTILE_MARKER_PROPERTY = "__odwLintHostileMetadataWasEvaluated";
const invalidFixtureOutcomeCache = new Map<string, ReturnType<typeof loaderParityOutcome>>();

type HarnessSourceFile = {
  readonly filePath: string;
  readonly sourceUrl: URL;
};

declare global {
  var __odwLintHostileMetadataWasEvaluated: string | undefined;
}

/** Builds a passive inline workflow source for reducer-level assertions. */
const workflowSource = (sourceText: string): WorkflowSource => {
  return {
    filePath: "tests/static-analysis/fixtures/inline-loader-parity.js",
    sourceText,
  };
};

/** Clears the hostile fixture marker without evaluating fixture code. */
const clearHostileMarker = (): void => {
  Reflect.deleteProperty(globalThis, HOSTILE_MARKER_PROPERTY);
};

/** Reads the hostile marker value for inertness assertions. */
const hostileMarkerValue = (): string | undefined => {
  return globalThis.__odwLintHostileMetadataWasEvaluated;
};

/** Converts a source URL to the repository-relative path used in test failures. */
const repositoryRelativePath = (sourceUrl: URL): string => {
  return relative(fileURLToPath(PROJECT_ROOT_URL), fileURLToPath(sourceUrl)).replaceAll("\\", "/");
};

/** Returns the first existing file URL from a deterministic candidate list. */
const firstExistingSourceUrl = (candidateUrls: readonly URL[]): URL | undefined => {
  return candidateUrls.find((candidateUrl) => {
    const candidatePath = fileURLToPath(candidateUrl);
    return existsSync(candidatePath) && statSync(candidatePath).isFile();
  });
};

/** Resolves local TypeScript import edges without loading imported modules. */
const resolveLocalTypeScriptImport = (
  importerUrl: URL,
  moduleSpecifier: string,
): URL | undefined => {
  if (!moduleSpecifier.startsWith(".")) {
    return undefined;
  }

  const baseUrl = new URL(moduleSpecifier, importerUrl);
  const withExtensions = TYPESCRIPT_SOURCE_EXTENSIONS.map(
    (extension) => new URL(`${moduleSpecifier}${extension}`, importerUrl),
  );
  const indexFiles = TYPESCRIPT_SOURCE_EXTENSIONS.map(
    (extension) => new URL(`${moduleSpecifier}/index${extension}`, importerUrl),
  );

  return firstExistingSourceUrl([baseUrl, ...withExtensions, ...indexFiles]);
};

/** Discovers the harness source graph from actual relative import edges. */
const discoverHarnessSourceFiles = (): readonly HarnessSourceFile[] => {
  const discovered = new Map<string, HarnessSourceFile>();
  const pendingUrls: URL[] = [...HARNESS_ENTRYPOINT_URLS];

  for (const sourceUrl of pendingUrls) {
    const filePath = repositoryRelativePath(sourceUrl);
    if (discovered.has(filePath)) {
      continue;
    }

    const sourceText = readFileSync(sourceUrl, "utf8");
    const facts = importArchitectureFactsFromSource(filePath, sourceText);
    discovered.set(filePath, { filePath, sourceUrl });

    for (const edge of facts.importLikeEdges) {
      const importedUrl = resolveLocalTypeScriptImport(sourceUrl, edge.moduleSpecifier);
      if (importedUrl !== undefined) {
        pendingUrls.push(importedUrl);
      }
    }
  }

  return [...discovered.values()].sort((left, right) =>
    left.filePath.localeCompare(right.filePath),
  );
};

/** Runs the harness for one invalid fixture manifest entry. */
const computeInvalidFixtureOutcome = (
  fixture: (typeof INVALID_WORKFLOW_FIXTURE_SNAPSHOTS)[number],
) => {
  const sourceText = readFixtureSource(INVALID_FIXTURE_CORPUS, fixture.fixturePath);

  return loaderParityOutcome({
    filePath: fixture.fixturePath,
    sourceText,
  });
};

/** Runs the harness once for one invalid fixture manifest entry. */
const invalidFixtureOutcome = (fixture: (typeof INVALID_WORKFLOW_FIXTURE_SNAPSHOTS)[number]) => {
  const cachedOutcome = invalidFixtureOutcomeCache.get(fixture.fixturePath);
  if (cachedOutcome !== undefined) {
    return cachedOutcome;
  }

  const outcome = computeInvalidFixtureOutcome(fixture);
  invalidFixtureOutcomeCache.set(fixture.fixturePath, outcome);
  return outcome;
};

describe("loader-parity outcome reducer", () => {
  it("reports no-error status for passive valid workflow source", () => {
    const outcome = loaderParityOutcome(
      workflowSource('export const meta = { name: "x", description: "y" };\nreturn agent("ok");\n'),
    );

    expect(outcome).toMatchInlineSnapshot(`
      {
        "dialectErrorRules": [],
        "ruleClasses": [],
        "status": "no-error",
      }
    `);
  });

  it("reports error status and rule classes for invalid metadata", () => {
    const outcome = loaderParityOutcome(workflowSource("export const meta = {};\n"));

    expect(outcome).toMatchInlineSnapshot(`
      {
        "dialectErrorRules": [
          "odw/meta-description",
          "odw/meta-name",
        ],
        "ruleClasses": [
          "odw/meta-description",
          "odw/meta-name",
        ],
        "status": "error",
      }
    `);
  });

  it("deduplicates and sorts repeated rule classes", () => {
    const outcome = loaderParityOutcome(
      workflowSource(
        [
          'import helper from "somewhere";',
          'export const meta = { name: "x", description: "y" };',
          "export const extra = 1;",
        ].join("\n"),
      ),
    );

    expect(outcome).toMatchInlineSnapshot(`
      {
        "dialectErrorRules": [
          "odw/body-syntax",
          "odw/no-import-export",
        ],
        "ruleClasses": [
          "odw/body-syntax",
          "odw/no-import-export",
        ],
        "status": "error",
      }
    `);
  });

  it("keeps warning status below error status", () => {
    const warningOutcome = loaderParityOutcome(
      workflowSource(
        'export const meta = { name: "x", description: "y" };\nconst value = Date.now();\nreturn value;\n',
      ),
    );
    const mixedOutcome = loaderParityOutcome(
      workflowSource("export const meta = {};\nconst value = Date.now();\nreturn value;\n"),
    );

    expect(warningOutcome.status).toBe("warning");
    expect(warningOutcome.ruleClasses).toEqual(["odw/no-date-now"]);
    expect(warningOutcome.dialectErrorRules).toEqual([]);
    expect(mixedOutcome.status).toBe("error");
    expect(mixedOutcome.ruleClasses).toEqual([
      "odw/meta-description",
      "odw/meta-name",
      "odw/no-date-now",
    ]);
    expect(mixedOutcome).toMatchInlineSnapshot(`
      {
        "dialectErrorRules": [
          "odw/meta-description",
          "odw/meta-name",
        ],
        "ruleClasses": [
          "odw/meta-description",
          "odw/meta-name",
          "odw/no-date-now",
        ],
        "status": "error",
      }
    `);
  });
});

describe("trusted ODW example loader parity", () => {
  it("has trusted ODW examples to check", () => {
    expect(ODW_EXAMPLE_FIXTURE_SNAPSHOTS.length).toBeGreaterThan(0);
  });

  for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
    it(`${fixture.fileName} emits no dialect errors`, () => {
      const sourceText = readFixtureSource(TRUSTED_EXAMPLE_CORPUS, fixture.fixturePath);
      const outcome = loaderParityOutcome({
        filePath: fixture.fixturePath,
        sourceText,
      });

      expect(outcome).toEqual(expectedNoErrorOutcome());
    });
  }
});

describe("invalid workflow loader parity", () => {
  it("has invalid workflow fixtures to check", () => {
    expect(INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.length).toBeGreaterThan(0);
  });

  it("keeps invalid fixture outcomes snapshot-stable", () => {
    const outcomeRows = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.map((fixture) => {
      const outcome = invalidFixtureOutcome(fixture);

      return [
        fixture.fixturePath,
        `status=${outcome.status}`,
        `rules=${outcome.ruleClasses.join(",")}`,
        `errors=${outcome.dialectErrorRules.join(",")}`,
      ].join(" | ");
    });

    expect(outcomeRows).toMatchInlineSnapshot(`
      [
        "tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta-description.js | status=error | rules=odw/meta-description | errors=odw/meta-description",
        "tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta-name.js | status=error | rules=odw/meta-name | errors=odw/meta-name",
        "tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta.js | status=error | rules=odw/meta-required | errors=odw/meta-required",
        "tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/computed-meta-expression.js | status=warning | rules=odw/meta-statically-unprovable | errors=",
        "tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/empty-meta-name.js | status=error | rules=odw/meta-name | errors=odw/meta-name",
        "tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/meta-not-object.js | status=error | rules=odw/meta-object | errors=odw/meta-object",
        "tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/numeric-meta-description.js | status=error | rules=odw/meta-description | errors=odw/meta-description",
        "tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/unterminated-meta-object.js | status=error | rules=odw/meta-object | errors=odw/meta-object",
        "tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/env-read-marker.js | status=warning | rules=odw/meta-statically-unprovable | errors=",
        "tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/fs-write-marker.js | status=warning | rules=odw/meta-statically-unprovable | errors=",
        "tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/global-marker.js | status=warning | rules=odw/meta-statically-unprovable | errors=",
        "tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/throw-marker.js | status=warning | rules=odw/meta-statically-unprovable | errors=",
        "tests/static-analysis/fixtures/invalid-workflows/unsupported-import-export/extra-export-const.js | status=error | rules=odw/body-syntax,odw/no-import-export | errors=odw/body-syntax,odw/no-import-export",
        "tests/static-analysis/fixtures/invalid-workflows/unsupported-import-export/top-level-import.js | status=error | rules=odw/no-import-export | errors=odw/no-import-export",
        "tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-block.js | status=error | rules=odw/body-syntax | errors=odw/body-syntax",
        "tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-call.js | status=error | rules=odw/body-syntax | errors=odw/body-syntax",
      ]
    `);
  });

  for (const fixture of INVALID_WORKFLOW_FIXTURE_SNAPSHOTS) {
    it(`${fixture.fixturePath} matches its manifest outcome`, () => {
      const outcome = invalidFixtureOutcome(fixture);
      const expectedOutcome = expectedInvalidFixtureOutcome(
        fixture.expectedStatus,
        fixture.expectedDiagnostics,
      );

      expect(outcome.status).toBe(expectedOutcome.status);
      // Manifest rules are the rejection contract; the aggregate snapshot above
      // pins any deliberate collateral diagnostics from the broader lint pass.
      expect(outcome.ruleClasses).toEqual(expect.arrayContaining(expectedOutcome.ruleClasses));
      expect(outcome.dialectErrorRules).toEqual(
        expect.arrayContaining(expectedOutcome.dialectErrorRules),
      );
    });
  }

  it("keeps warning-only invalid fixtures out of dialect-error rules", () => {
    const warningFixtures = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.expectedStatus === "warning",
    );

    expect(warningFixtures.length).toBeGreaterThan(0);
    for (const fixture of warningFixtures) {
      const outcome = invalidFixtureOutcome(fixture);

      expect(outcome.status).toBe("warning");
      expect(outcome.ruleClasses.length).toBeGreaterThan(0);
      expect(outcome.dialectErrorRules).toEqual([]);
    }
  });

  it("keeps error invalid fixtures mapped to dialect-error rules", () => {
    const errorFixtures = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.expectedStatus === "error",
    );

    expect(errorFixtures.length).toBeGreaterThan(0);
    for (const fixture of errorFixtures) {
      const outcome = invalidFixtureOutcome(fixture);

      expect(outcome.status).toBe("error");
      expect(outcome.dialectErrorRules.length).toBeGreaterThan(0);
    }
  });
});

describe("loader-parity harness inertness", () => {
  it("does not execute hostile metadata fixture bodies", () => {
    const hostileFixtures = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.family === "hostile-metadata",
    );

    expect(hostileFixtures.length).toBeGreaterThan(0);
    try {
      for (const fixture of hostileFixtures) {
        clearHostileMarker();
        const outcome = computeInvalidFixtureOutcome(fixture);

        expect(outcome.status).toBe("warning");
        expect(outcome.ruleClasses).toEqual(["odw/meta-statically-unprovable"]);
        expect(hostileMarkerValue()).toBeUndefined();
      }
    } finally {
      clearHostileMarker();
    }
  });

  it("keeps the harness free of executable ODW import edges", () => {
    expect(isForbiddenOdwImport("odw/src/loader")).toBe(true);
    expect(isForbiddenOdwImport("odw/loader")).toBe(false);

    const harnessSourceFiles = discoverHarnessSourceFiles();
    expect(harnessSourceFiles.map((file) => file.filePath)).toContain(
      "tests/diagnostics/import-edge-extraction.ts",
    );
    expect(harnessSourceFiles.map((file) => file.filePath)).toContain(
      "tests/static-analysis/fixtures/loader-parity.ts",
    );

    for (const { filePath, sourceUrl } of harnessSourceFiles) {
      const facts = importArchitectureFactsFromSource(filePath, readFileSync(sourceUrl, "utf8"));
      const forbiddenEdges = facts.importLikeEdges.filter((edge) =>
        isForbiddenOdwImport(edge.moduleSpecifier),
      );

      expect(facts.computedDynamicImports).toEqual([]);
      expect(facts.computedCommonJsRequires).toEqual([]);
      expect(forbiddenEdges).toEqual([]);
    }
  });
});
