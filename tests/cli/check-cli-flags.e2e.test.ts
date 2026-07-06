/**
 * @file End-to-end process tests for the `check` command flag surface.
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureSourceUrl } from "../static-analysis/fixtures/corpus-support";
import {
  DUAL_COMPAT_FIXTURE_CORPUS,
  findDualCompatFixture,
} from "../static-analysis/fixtures/dual-compat/corpus";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/invalid-workflows/corpus";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const PACKAGE_VERSION = "0.0.0";
const INVALID_STDIN_SOURCE = "await step.do();\n";

type CliProcessResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

type JsonCliReport = {
  readonly schemaVersion?: unknown;
  readonly summary?: {
    readonly errors?: unknown;
    readonly filesSkipped?: unknown;
  };
  readonly diagnostics?: readonly {
    readonly file?: unknown;
    readonly rule?: unknown;
    readonly severity?: unknown;
  }[];
  readonly ioErrors?: readonly {
    readonly file?: unknown;
    readonly reason?: unknown;
    readonly message?: unknown;
  }[];
};

type CheckProcessOptions = {
  readonly stdinText?: string;
};

/** Resolve a reviewed fixture snapshot to the process argument path. */
const fixturePathArgument = (
  corpus: Parameters<typeof fixtureSourceUrl>[0],
  fixturePath: string,
): string => {
  return fileURLToPath(fixtureSourceUrl(corpus, fixturePath));
};

/** Run the product CLI entrypoint in a real Bun child process. */
const runCheckProcess = (
  args: readonly string[],
  options: CheckProcessOptions = {},
): CliProcessResult => {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "src/cli/main.ts", "check", ...args],
    cwd: repositoryRoot,
    stdin: options.stdinText === undefined ? "ignore" : new Blob([options.stdinText]),
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

/** Parse process JSON output into the report fields asserted by e2e tests. */
const parseJsonCliReport = (stdoutText: string): JsonCliReport => {
  return JSON.parse(stdoutText) as JsonCliReport;
};

/** Return a real invalid fixture path that produces a catalogue error. */
const invalidFixturePath = (): string => {
  const fixture = findInvalidWorkflowFixture({
    family: "missing-metadata",
    fileName: "missing-meta.js",
  });

  return fixturePathArgument(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath);
};

/** Return a real Claude-portability fixture path. */
const claudeWarningFixturePath = (): string => {
  const fixture = findDualCompatFixture({
    family: "deterministic-time",
    fileName: "date-now.js",
  });

  return fixturePathArgument(DUAL_COMPAT_FIXTURE_CORPUS, fixture.fixturePath);
};

describe("check CLI process flag surface", () => {
  it("prints the package version", () => {
    expect(runCheckProcess(["--version"])).toEqual({
      exitCode: 0,
      stdout: `${PACKAGE_VERSION}\n`,
      stderr: "",
    });
  });

  it("prints help listing the implemented flags", () => {
    const result = runCheckProcess(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toStartWith("Usage: odw-lint check [OPTIONS] <workflow.js ...>\n");
    for (const flag of [
      "--output-format",
      "--output-file",
      "--max-warnings",
      "--strict-claude",
      "--config",
      "--isolated",
      "--force-exclude",
      "--respect-gitignore",
      "--no-respect-gitignore",
      "--stdin-filename",
      "--exit-zero",
      "--exit-non-zero-on-fix",
      "--help",
      "--version",
    ]) {
      expect(result.stdout).toContain(flag);
    }
  });

  it("writes JSON diagnostics to --output-file", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "odw-lint-flags-"));
    const outputPath = join(temporaryDirectory, "report.json");

    try {
      const result = runCheckProcess([
        "--output-format",
        "json",
        "--output-file",
        outputPath,
        invalidFixturePath(),
      ]);
      const report = parseJsonCliReport(readFileSync(outputPath, "utf8"));

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(report.schemaVersion).toBe(1);
      expect(Number(report.summary?.errors)).toBeGreaterThanOrEqual(1);
      expect(report.diagnostics?.[0]?.rule).toBe("odw/meta-required");
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("analyses standard input under --stdin-filename", () => {
    const result = runCheckProcess(["--stdin-filename", "workflows/stdin.js"], {
      stdinText: INVALID_STDIN_SOURCE,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("workflows/stdin.js:1:1 error odw/meta-required");
  });

  it("promotes Claude-portability findings with --strict-claude", () => {
    const fixturePath = claudeWarningFixturePath();
    const result = runCheckProcess(["--strict-claude", fixturePath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${fixturePath}:10:19 error odw/no-date-now`);
  });

  it.each([
    ["within budget", "1", 0],
    ["above budget", "0", 1],
  ] as const)("applies --max-warnings to process exits when warnings are %s", (_caseName, budget, exitCode) => {
    const fixturePath = claudeWarningFixturePath();
    const result = runCheckProcess(["--max-warnings", budget, fixturePath]);

    expect(result.exitCode).toBe(exitCode);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${fixturePath}:10:19 warning odw/no-date-now`);
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("keeps diagnostics visible while returning 0 with --exit-zero", () => {
    const result = runCheckProcess(["--exit-zero", invalidFixturePath()]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("error odw/meta-required");
    expect(result.stdout).toContain("Found 1 error.");
  });

  it("emits machine-readable IO errors for missing paths in JSON mode", () => {
    const missingPath = "missing-process-fixture.js";
    const result = runCheckProcess(["--output-format", "json", missingPath]);
    const report = parseJsonCliReport(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`error: cannot read ${missingPath}:`);
    expect(report.summary?.filesSkipped).toBe(1);
    expect(report.ioErrors?.[0]?.file).toBe(missingPath);
    expect(report.ioErrors?.[0]?.reason).toBe("not-found");
    expect(typeof report.ioErrors?.[0]?.message).toBe("string");
    expect(report.diagnostics).toEqual([]);
  });
});
