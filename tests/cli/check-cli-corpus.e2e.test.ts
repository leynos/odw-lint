/**
 * @file End-to-end corpus tests for the explicit-path `check` command.
 */

import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { fixtureSourceUrl } from "../static-analysis/fixtures/corpus-support";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "../static-analysis/fixtures/invalid-workflows";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/invalid-workflows/corpus";
import type {
  InvalidWorkflowFixtureFamily,
  InvalidWorkflowFixtureSnapshot,
} from "../static-analysis/fixtures/invalid-workflows/manifest-types";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "../static-analysis/fixtures/odw-examples";
import { ODW_EXAMPLE_FIXTURE_CORPUS } from "../static-analysis/fixtures/odw-examples/corpus";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

type CliProcessResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

type InvalidFixtureSample = {
  readonly family: InvalidWorkflowFixtureFamily;
  readonly fileName: string;
};

const INVALID_FAMILY_SAMPLES = [
  { family: "missing-metadata", fileName: "missing-meta.js" },
  { family: "malformed-metadata", fileName: "meta-not-object.js" },
  { family: "hostile-metadata", fileName: "global-marker.js" },
  { family: "unsupported-import-export", fileName: "top-level-import.js" },
  { family: "syntax-error", fileName: "body-unclosed-call.js" },
] satisfies readonly InvalidFixtureSample[];

/** Resolve one reviewed fixture snapshot to the process argument path. */
const fixturePathArgument = (
  corpus: Parameters<typeof fixtureSourceUrl>[0],
  fixturePath: string,
): string => {
  return fileURLToPath(fixtureSourceUrl(corpus, fixturePath));
};

/** Run the product CLI entrypoint in a real Bun child process. */
const runCheckProcess = (args: readonly string[]): CliProcessResult => {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "src/cli/main.ts", "check", ...args],
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

/** Select one representative fixture from every invalid workflow family. */
const invalidFamilyFixtures = (): InvalidWorkflowFixtureSnapshot[] => {
  return INVALID_FAMILY_SAMPLES.map((sample) => findInvalidWorkflowFixture(sample));
};

describe("explicit-path check CLI corpus process contract", () => {
  it.each([
    ...ODW_EXAMPLE_FIXTURE_SNAPSHOTS,
  ])("returns 0 for valid ODW example $fileName", (fixture) => {
    const result = runCheckProcess([
      fixturePathArgument(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath),
    ]);

    expect(result).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it.each(invalidFamilyFixtures())("returns 1 for invalid $family fixture $fileName", (fixture) => {
    const result = runCheckProcess([
      fixturePathArgument(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(String(fixture.expectedDiagnostics[0]?.rule));
    expect(result.stderr).toBe("");
  });

  it("returns 1 for a mixed valid and error-bearing invalid invocation", () => {
    const validFixture = ODW_EXAMPLE_FIXTURE_SNAPSHOTS[0];
    const invalidFixture = findInvalidWorkflowFixture({
      family: "missing-metadata",
      fileName: "missing-meta.js",
    });

    if (validFixture === undefined) {
      throw new Error("Expected at least one reviewed ODW example fixture.");
    }

    const result = runCheckProcess([
      fixturePathArgument(ODW_EXAMPLE_FIXTURE_CORPUS, validFixture.fixturePath),
      fixturePathArgument(INVALID_WORKFLOW_FIXTURE_CORPUS, invalidFixture.fixturePath),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("error odw/meta-required");
    expect(result.stderr).toBe("");
  });

  it("returns 2 for a no-operand invocation", () => {
    const result = runCheckProcess([]);

    expect(result).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: "usage: odw-lint check <workflow.js ...>\n",
    });
  });

  it("samples every invalid workflow family honestly", () => {
    expect(new Set(invalidFamilyFixtures().map((fixture) => fixture.family))).toEqual(
      new Set(INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.map((fixture) => fixture.family)),
    );
  });
});
