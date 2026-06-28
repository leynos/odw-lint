/**
 * @file ODW example workflow fixture manifest tests.
 */

import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { WorkflowSource } from "odw-lint";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./fixtures/odw-examples";

const FIXTURE_DIRECTORY = new URL("./fixtures/odw-examples/", import.meta.url);
const MANIFEST_FIXTURE_ROOT = "tests/static-analysis/fixtures/odw-examples";
const UPSTREAM_EXAMPLE_ROOT = "open-dynamic-workflows/examples";
const EXPECTED_FILE_NAMES = [
  "adversarial-verify.js",
  "agent-daily-digest.js",
  "codex-claude-loop.js",
  "deep-research.js",
  "fan-out-reduce.js",
  "generate-and-filter.js",
  "loop-until-dry.js",
  "routing.js",
  "tournament.js",
] as const;

/** Calculates the SHA-256 digest used to pin copied fixture content. */
const sha256 = (sourceText: string): string => {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
};

/** Returns copied JavaScript fixture names from the committed fixture directory. */
const copiedFixtureFileNames = (): readonly string[] => {
  return readdirSync(FIXTURE_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".js"))
    .sort();
};

/** Reads a copied fixture through its manifest entry. */
const readFixtureSource = (fileName: string): string => {
  return readFileSync(new URL(fileName, FIXTURE_DIRECTORY), "utf8");
};

describe("ODW example fixture snapshots", () => {
  it("lists the exact nine-file ODW example corpus in sorted order", () => {
    const manifestFileNames = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((entry) => entry.fileName);

    expect(manifestFileNames).toEqual([...EXPECTED_FILE_NAMES]);
    expect(manifestFileNames).toEqual([...manifestFileNames].sort());
    expect(copiedFixtureFileNames()).toEqual([...EXPECTED_FILE_NAMES]);
  });

  it("keeps filenames and metadata names unique", () => {
    const fileNames = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((entry) => entry.fileName);
    const metaNames = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((entry) => entry.metaName);

    expect(new Set(fileNames).size).toBe(fileNames.length);
    expect(new Set(metaNames).size).toBe(metaNames.length);
  });

  it("derives manifest paths from each fixture filename", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      expect(fixture.fixturePath).toBe(`${MANIFEST_FIXTURE_ROOT}/${fixture.fileName}`);
      expect(fixture.upstreamPath).toBe(`${UPSTREAM_EXAMPLE_ROOT}/${fixture.fileName}`);
    }
  });

  it("pins every copied fixture to its manifest SHA-256 digest", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      const fixtureUrl = new URL(fixture.fileName, FIXTURE_DIRECTORY);

      expect(existsSync(fixtureUrl)).toBeTrue();
      expect(sha256(readFixtureSource(fixture.fileName))).toBe(fixture.sha256);
    }
  });

  it("represents every copied file as passive workflow source text", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      const sourceText = readFixtureSource(fixture.fileName);
      const workflowSource = {
        filePath: fixture.fixturePath,
        sourceText,
      } satisfies WorkflowSource;

      expect(workflowSource).toEqual({
        filePath: fixture.fixturePath,
        sourceText,
      });
    }
  });

  it("records no-error expectations without diagnostics for this slice", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      expect(fixture.expectedStatus).toBe("no-error");
      expect(fixture.expectedDiagnostics).toEqual([]);
    }
  });

  it("freezes manifest metadata and diagnostic expectation arrays at runtime", () => {
    expect(Object.isFrozen(ODW_EXAMPLE_FIXTURE_SNAPSHOTS)).toBeTrue();

    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      expect(Object.isFrozen(fixture)).toBeTrue();
      expect(Object.isFrozen(fixture.expectedDiagnostics)).toBeTrue();
    }
  });
});
