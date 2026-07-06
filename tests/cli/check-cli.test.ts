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

type JsonDiagnostic = {
  readonly rule?: unknown;
};

type JsonReport = {
  readonly schemaVersion?: unknown;
  readonly summary?: {
    readonly errors?: unknown;
  };
  readonly diagnostics?: readonly JsonDiagnostic[];
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

/** Simulates optional default configuration discovery finding no file. */
const readNoConfig = (): string => {
  throw Object.assign(new Error("missing test config"), { code: "ENOENT" });
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
    readConfigFile: readNoConfig,
    writeOut: (message) => {
      stdout += message;
    },
    writeErr: (message) => {
      stderr += message;
    },
  });

  return { exitCode, stdout, stderr };
};

/** Parse captured JSON output into the report fields asserted by CLI tests. */
const parseCapturedJsonReport = (stdoutText: string): JsonReport => {
  return JSON.parse(stdoutText) as JsonReport;
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
    expect(result.stdout).toContain("Found 1 error.");
  });

  it("prints full text diagnostics when the output format is explicit", () => {
    const fixture = errorFixture();
    const result = runCapturedCheckCli(
      ["check", "--output-format", "full", fixture.filePath],
      [fixture],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${fixture.filePath}:1:1 error odw/meta-required`);
    expect(result.stdout).toContain("Found 1 error.");
  });

  it("prints JSON diagnostics and returns 1 for an invalid workflow", () => {
    const fixture = errorFixture();
    const result = runCapturedCheckCli(
      ["check", "--output-format=json", fixture.filePath],
      [fixture],
    );
    const report = parseCapturedJsonReport(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(report.schemaVersion).toBe(1);
    expect(report.summary?.errors).toBe(1);
    expect(report.diagnostics?.[0]?.rule).toBe("odw/meta-required");
  });

  it("prints an empty JSON diagnostics array for a clean workflow", () => {
    const fixture = cleanFixture();
    const result = runCapturedCheckCli(
      ["check", "--output-format", "json", fixture.filePath],
      [fixture],
    );
    const report = parseCapturedJsonReport(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(report.schemaVersion).toBe(1);
    expect(report.diagnostics).toEqual([]);
  });

  it("returns 1 for warning-only diagnostics under Ruff parity", () => {
    const fixture = warningFixture();
    const result = runCapturedCheckCli(["check", fixture.filePath], [fixture]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      `${fixture.filePath}:3:16 warning odw/meta-statically-unprovable`,
    );
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("returns 0 for warnings within the explicit warning budget", () => {
    const fixture = warningFixture();
    const result = runCapturedCheckCli(
      ["check", "--max-warnings", "1", fixture.filePath],
      [fixture],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      `${fixture.filePath}:3:16 warning odw/meta-statically-unprovable`,
    );
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("returns 1 for warnings above the explicit warning budget", () => {
    const fixture = warningFixture();
    const result = runCapturedCheckCli(
      ["check", "--max-warnings", "0", fixture.filePath],
      [fixture],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("accepts the equals spelling for the warning budget", () => {
    const fixture = warningFixture();
    const result = runCapturedCheckCli(["check", "--max-warnings=1", fixture.filePath], [fixture]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("returns 1 for errors even when a warning budget is present", () => {
    const fixture = errorFixture();
    const result = runCapturedCheckCli(
      ["check", "--max-warnings", "5", fixture.filePath],
      [fixture],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Found 1 error.");
  });

  it("returns 0 for a clean workflow when a warning budget is present", () => {
    const fixture = cleanFixture();

    expect(
      runCapturedCheckCli(["check", "--max-warnings", "1", fixture.filePath], [fixture]),
    ).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("reports unreadable paths on stderr and returns 1", () => {
    const result = runCapturedCheckCli(["check", "missing-workflow.js"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: cannot read missing-workflow.js: missing test fixture");
  });

  it("keeps mixed text diagnostics and read failures on their own streams", () => {
    const fixture = errorFixture();
    const result = runCapturedCheckCli(
      ["check", fixture.filePath, "missing-workflow.js"],
      [fixture],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(`${fixture.filePath}:1:1 error odw/meta-required`);
    expect(result.stdout).toContain("Found 1 error.");
    expect(result.stderr).toContain("error: cannot read missing-workflow.js: missing test fixture");
  });

  it("keeps read failures on stderr when JSON output is selected", () => {
    const result = runCapturedCheckCli(["check", "--output-format", "json", "missing-workflow.js"]);
    const report = parseCapturedJsonReport(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.schemaVersion).toBe(1);
    expect(report.diagnostics).toEqual([]);
    expect(result.stderr).toContain("error: cannot read missing-workflow.js: missing test fixture");
  });

  it("keeps mixed JSON diagnostics and read failures on their own streams", () => {
    const fixture = errorFixture();
    const result = runCapturedCheckCli(
      ["check", "--output-format", "json", fixture.filePath, "missing-workflow.js"],
      [fixture],
    );
    const report = parseCapturedJsonReport(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.diagnostics?.[0]?.rule).toBe("odw/meta-required");
    expect(report.summary?.errors).toBe(1);
    expect(result.stderr).toContain("error: cannot read missing-workflow.js: missing test fixture");
  });

  it.each([
    ["no operands", [], "usage: odw-lint check <workflow.js ...>"],
    ["no paths", ["check"], "usage: odw-lint check <workflow.js ...>"],
    ["unknown flag", ["check", "--flag"], "unknown option: --flag"],
    [
      "unknown output format",
      ["check", "--output-format", "json-lines", "workflow.js"],
      "unsupported output format: json-lines",
    ],
    ["missing max warnings", ["check", "--max-warnings"], "missing value for --max-warnings"],
    [
      "non-integer max warnings",
      ["check", "--max-warnings", "abc", "workflow.js"],
      "invalid value for --max-warnings: abc",
    ],
    [
      "negative max warnings",
      ["check", "--max-warnings", "-1", "workflow.js"],
      "invalid value for --max-warnings: -1",
    ],
    [
      "fractional max warnings",
      ["check", "--max-warnings", "1.5", "workflow.js"],
      "invalid value for --max-warnings: 1.5",
    ],
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
      readConfigFile: readNoConfig,
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
