/**
 * @file Direct CLI runner tests for the explicit-path `check` command.
 */

import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { runCheckCli } from "../../src/cli/check-cli";
import { fixtureSourceUrl, readFixtureSource } from "../static-analysis/fixtures/corpus-support";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/invalid-workflows/corpus";
import {
  findOdwExampleFixture,
  ODW_EXAMPLE_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/odw-examples/corpus";

type CapturedCliRun = {
  readonly exitCode: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
};

type SourceFixture = {
  readonly filePath: string;
  readonly sourceText: string;
};

const VERSION = "0.0.0-test";

/** Resolves a reviewed fixture snapshot to the file path used in diagnostics. */
const fixtureFilePath = (corpus: Parameters<typeof fixtureSourceUrl>[0], fixturePath: string) => {
  return fileURLToPath(fixtureSourceUrl(corpus, fixturePath));
};

/** Builds a reviewed clean source fixture. */
const cleanFixture = (): SourceFixture => {
  const fixture = findOdwExampleFixture({ fileName: "fan-out-reduce.js" });

  return {
    filePath: fixtureFilePath(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath),
    sourceText: readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath),
  };
};

/** Builds a reviewed error-bearing source fixture. */
const errorFixture = (): SourceFixture => {
  const fixture = findInvalidWorkflowFixture({
    family: "missing-metadata",
    fileName: "missing-meta.js",
  });

  return {
    filePath: fixtureFilePath(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath),
    sourceText: readFixtureSource(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath),
  };
};

/** Builds a reviewed warning-only source fixture. */
const warningFixture = (): SourceFixture => {
  const fixture = findInvalidWorkflowFixture({
    family: "hostile-metadata",
    fileName: "global-marker.js",
  });

  return {
    filePath: fixtureFilePath(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath),
    sourceText: readFixtureSource(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath),
  };
};

/** Builds an injected reader over reviewed fixture source text. */
const readFrom = (sources: readonly SourceFixture[]) => {
  const sourceByPath = new Map(sources.map((source) => [source.filePath, source.sourceText]));

  return (filePath: string): string => {
    const sourceText = sourceByPath.get(filePath);

    if (sourceText === undefined) {
      throw Object.assign(new Error("missing test fixture"), { code: "ENOENT" });
    }

    return sourceText;
  };
};

/** Runs the CLI with captured writers and an injected fixture reader. */
const runCapturedCheckCli = (
  args: readonly string[],
  sources: readonly SourceFixture[] = [],
): CapturedCliRun => {
  let stdout = "";
  let stderr = "";
  const exitCode = runCheckCli(args, {
    version: VERSION,
    readFileText: readFrom(sources),
    writeOut: (message) => {
      stdout += message;
    },
    writeErr: (message) => {
      stderr += message;
    },
  });

  return { exitCode, stdout, stderr };
};

describe("explicit-path check CLI runner", () => {
  it("returns 0 without output for a clean workflow", () => {
    const fixture = cleanFixture();

    expect(runCapturedCheckCli(["check", fixture.filePath], [fixture])).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("prints error diagnostics and returns 1 for an invalid workflow", () => {
    const fixture = errorFixture();
    const result = runCapturedCheckCli(["check", fixture.filePath], [fixture]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${fixture.filePath}:1:1 error odw/meta-required`);
  });

  it("returns 1 for warning-only diagnostics under Ruff parity", () => {
    const fixture = warningFixture();
    const result = runCapturedCheckCli(["check", fixture.filePath], [fixture]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      `${fixture.filePath}:3:16 warning odw/meta-statically-unprovable`,
    );
  });

  it("reports unreadable paths on stderr and returns 1", () => {
    const result = runCapturedCheckCli(["check", "missing-workflow.js"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: cannot read missing-workflow.js: missing test fixture");
  });

  it.each([
    ["no operands", [], "usage: odw-lint check <workflow.js ...>"],
    ["no paths", ["check"], "usage: odw-lint check <workflow.js ...>"],
    ["unknown flag", ["check", "--flag"], "unknown option: --flag"],
    ["wrong subcommand", ["lint", "workflow.js"], "unknown command: lint"],
  ] as const)("returns 2 for %s", (_caseName, args, expectedError) => {
    const result = runCapturedCheckCli(args);

    expect(result).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: `${expectedError}\n`,
    });
  });

  it("converts non-Errno reader throws to unreadable failures", () => {
    let stdout = "";
    let stderr = "";
    const exitCode = runCheckCli(["check", "workflow.js"], {
      version: VERSION,
      readFileText: () => {
        throw { detail: "not an Error" };
      },
      writeOut: (message) => {
        stdout += message;
      },
      writeErr: (message) => {
        stderr += message;
      },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("error: cannot read workflow.js: [object Object]");
  });
});
