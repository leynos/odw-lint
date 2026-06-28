/**
 * @file Synthetic masking workflow fixture manifest tests.
 */

import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { WorkflowSource } from "odw-lint";
import {
  MASKING_FIXTURE_ROOT,
  MASKING_FIXTURE_SNAPSHOTS,
  type MaskingFixtureContext,
} from "./fixtures/masking";

const FIXTURE_DIRECTORY = new URL("./fixtures/masking/", import.meta.url);
const EXPECTED_FILE_NAMES = [
  "comment-decoy.js",
  "regex-decoy.js",
  "string-decoy.js",
  "template-literal-decoy.js",
] as const;
const EXPECTED_CONTEXTS = [
  "comment",
  "regex",
  "string",
  "template",
] as const satisfies readonly MaskingFixtureContext[];

/** Calculates the SHA-256 digest used to pin synthetic fixture content. */
const sha256 = (sourceText: string): string => {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
};

/** Returns synthetic JavaScript fixture names from the fixture directory. */
const copiedFixtureFileNames = (): readonly string[] => {
  return readdirSync(FIXTURE_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".js"))
    .sort();
};

/** Reads a synthetic fixture through its manifest entry. */
const readFixtureSource = (fileName: string): string => {
  return readFileSync(new URL(fileName, FIXTURE_DIRECTORY), "utf8");
};

describe("synthetic masking fixture snapshots", () => {
  it("lists the exact masking fixture corpus in sorted order", () => {
    const manifestFileNames = MASKING_FIXTURE_SNAPSHOTS.map((entry) => entry.fileName);

    expect(manifestFileNames).toEqual([...EXPECTED_FILE_NAMES]);
    expect(manifestFileNames).toEqual([...manifestFileNames].sort());
    expect(copiedFixtureFileNames()).toEqual([...EXPECTED_FILE_NAMES]);
  });

  it("keeps filenames and metadata names unique", () => {
    const fileNames = MASKING_FIXTURE_SNAPSHOTS.map((entry) => entry.fileName);
    const metaNames = MASKING_FIXTURE_SNAPSHOTS.map((entry) => entry.metaName);

    expect(new Set(fileNames).size).toBe(fileNames.length);
    expect(new Set(metaNames).size).toBe(metaNames.length);
  });

  it("covers every planned masking context exactly once", () => {
    const contexts = MASKING_FIXTURE_SNAPSHOTS.map((entry) => entry.context);

    expect(contexts).toEqual([...EXPECTED_CONTEXTS]);
    expect(new Set(contexts).size).toBe(EXPECTED_CONTEXTS.length);
  });

  it("derives manifest paths from each fixture filename", () => {
    for (const fixture of MASKING_FIXTURE_SNAPSHOTS) {
      expect(fixture.fixturePath).toBe(`${MASKING_FIXTURE_ROOT}/${fixture.fileName}`);
    }
  });

  it("pins every masking fixture to its manifest SHA-256 digest", () => {
    for (const fixture of MASKING_FIXTURE_SNAPSHOTS) {
      const fixtureUrl = new URL(fixture.fileName, FIXTURE_DIRECTORY);

      expect(existsSync(fixtureUrl)).toBeTrue();
      expect(sha256(readFixtureSource(fixture.fileName))).toBe(fixture.sha256);
    }
  });

  it("represents every masking file as passive workflow source text", () => {
    for (const fixture of MASKING_FIXTURE_SNAPSHOTS) {
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

  it("records empty envelope diagnostics for this slice", () => {
    for (const fixture of MASKING_FIXTURE_SNAPSHOTS) {
      expect(fixture.expectedStatus).toBe("no-envelope-diagnostics");
      expect(fixture.expectedDiagnostics).toEqual([]);
    }
  });

  it("freezes manifest metadata and diagnostic expectation arrays at runtime", () => {
    expect(Object.isFrozen(MASKING_FIXTURE_SNAPSHOTS)).toBeTrue();

    for (const fixture of MASKING_FIXTURE_SNAPSHOTS) {
      expect(Object.isFrozen(fixture)).toBeTrue();
      expect(Object.isFrozen(fixture.expectedDiagnostics)).toBeTrue();
    }
  });
});
