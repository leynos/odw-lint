/**
 * @file ODW example workflow fixture manifest tests.
 */

import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import type { WorkflowSource } from "odw-lint";
import {
  copiedFixtureFileNames,
  fixtureSourceUrl,
  readFixtureSource,
  sha256,
} from "./fixtures/corpus-support";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./fixtures/odw-examples";
import {
  ODW_EXAMPLE_FIXTURE_CORPUS,
  ODW_EXAMPLE_UPSTREAM_ROOT,
} from "./fixtures/odw-examples/corpus";

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

describe("ODW example fixture snapshots", () => {
  it("lists the exact nine-file ODW example corpus in sorted order", () => {
    const manifestFileNames = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((entry) => entry.fileName);

    expect(manifestFileNames).toEqual([...EXPECTED_FILE_NAMES]);
    expect(manifestFileNames).toEqual([...manifestFileNames].sort());
    expect(copiedFixtureFileNames(ODW_EXAMPLE_FIXTURE_CORPUS)).toEqual([...EXPECTED_FILE_NAMES]);
  });

  it("keeps filenames and metadata names unique", () => {
    const fileNames = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((entry) => entry.fileName);
    const metaNames = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((entry) => entry.metaName);

    expect(new Set(fileNames).size).toBe(fileNames.length);
    expect(new Set(metaNames).size).toBe(metaNames.length);
  });

  it("derives manifest paths from each fixture filename", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      expect(fixture.fixturePath).toBe(
        `${ODW_EXAMPLE_FIXTURE_CORPUS.manifestRoot}${fixture.fileName}`,
      );
      expect(fixture.upstreamPath).toBe(`${ODW_EXAMPLE_UPSTREAM_ROOT}/${fixture.fileName}`);
    }
  });

  it("pins every copied fixture to its manifest SHA-256 digest", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      expect(existsSync(fixtureSourceUrl(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fileName))).toBeTrue();
      expect(sha256(readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fileName))).toBe(
        fixture.sha256,
      );
    }
  });

  it("represents every copied file as passive workflow source text", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      const sourceText = readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fileName);
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
