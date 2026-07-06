/**
 * @file Configuration-aware CLI runner tests for the `check` command.
 */

import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { runCheckCli } from "../../src/cli/check-cli";
import { fixtureSourceUrl, readFixtureSource } from "../static-analysis/fixtures/corpus-support";
import {
  DUAL_COMPAT_FIXTURE_CORPUS,
  findDualCompatFixture,
} from "../static-analysis/fixtures/dual-compat/corpus";

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
const fixtureFilePath = (fixturePath: string): string => {
  return fileURLToPath(fixtureSourceUrl(DUAL_COMPAT_FIXTURE_CORPUS, fixturePath));
};

/** Builds a reviewed Claude-compatibility warning fixture. */
const claudeWarningFixture = (): SourceFixture => {
  const fixture = findDualCompatFixture({
    family: "deterministic-time",
    fileName: "date-now.js",
  });

  return {
    filePath: fixtureFilePath(fixture.fixturePath),
    sourceText: readFixtureSource(DUAL_COMPAT_FIXTURE_CORPUS, fixture.fixturePath),
  };
};

/** Builds an injected reader over reviewed fixture source text. */
const readSourceFrom = (sources: readonly SourceFixture[]) => {
  const sourceByPath = new Map(sources.map((source) => [source.filePath, source.sourceText]));

  return (filePath: string): string => {
    const sourceText = sourceByPath.get(filePath);

    if (sourceText === undefined) {
      throw Object.assign(new Error("missing test fixture"), { code: "ENOENT" });
    }

    return sourceText;
  };
};

/** Builds an injected config reader over in-memory JSON files. */
const readConfigFrom = (configs: Readonly<Record<string, string>> = {}) => {
  return (filePath: string): string => {
    const configText = configs[filePath];

    if (configText === undefined) {
      throw Object.assign(new Error("missing test config"), { code: "ENOENT" });
    }

    return configText;
  };
};

/** Runs the CLI with captured writers and injected readers. */
const runCapturedCheckCli = (input: {
  readonly args: readonly string[];
  readonly sources?: readonly SourceFixture[];
  readonly configs?: Readonly<Record<string, string>>;
}): CapturedCliRun => {
  let stdout = "";
  let stderr = "";
  const exitCode = runCheckCli(input.args, {
    version: VERSION,
    readFileText: readSourceFrom(input.sources ?? []),
    readConfigFile: readConfigFrom(input.configs),
    writeOut: (message) => {
      stdout += message;
    },
    writeErr: (message) => {
      stderr += message;
    },
  });

  return { exitCode, stdout, stderr };
};

describe("configuration-aware check CLI runner", () => {
  it("returns 2 when --config names an unknown rule identifier", () => {
    const fixture = claudeWarningFixture();
    const result = runCapturedCheckCli({
      args: ["check", fixture.filePath, "--config", "bad.json"],
      sources: [fixture],
      configs: {
        "bad.json": JSON.stringify({ rules: { "odw/not-a-real-rule": "error" } }),
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('Unknown rule identifier "odw/not-a-real-rule"');
  });

  it("promotes Claude-compatibility warnings when strictClaude is configured", () => {
    const fixture = claudeWarningFixture();
    const result = runCapturedCheckCli({
      args: ["check", "--config", "strict.json", fixture.filePath],
      sources: [fixture],
      configs: {
        "strict.json": JSON.stringify({ strictClaude: true }),
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${fixture.filePath}:10:19 error odw/no-date-now`);
  });

  it("leaves Claude-compatibility findings as warnings without configuration", () => {
    const fixture = claudeWarningFixture();
    const result = runCapturedCheckCli({
      args: ["check", fixture.filePath],
      sources: [fixture],
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${fixture.filePath}:10:19 warning odw/no-date-now`);
  });

  it("suppresses configured-off rule diagnostics", () => {
    const fixture = claudeWarningFixture();
    const result = runCapturedCheckCli({
      args: ["check", fixture.filePath, "--config", "off.json"],
      sources: [fixture],
      configs: {
        "off.json": JSON.stringify({ rules: { "odw/no-date-now": "off" } }),
      },
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("ignores default configuration when --isolated is supplied", () => {
    const fixture = claudeWarningFixture();
    const result = runCapturedCheckCli({
      args: ["check", "--isolated", fixture.filePath],
      sources: [fixture],
      configs: {
        "odw-lint.json": JSON.stringify({ rules: { "odw/no-date-now": "off" } }),
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${fixture.filePath}:10:19 warning odw/no-date-now`);
  });

  it.each([
    ["config with isolated", ["check", "--config", "strict.json", "--isolated", "workflow.js"]],
    ["config with no path", ["check", "--config"]],
  ] as const)("returns 2 for %s", (_caseName, args) => {
    const result = runCapturedCheckCli({ args });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toBe("");
  });

  it("returns 2 for malformed configuration JSON", () => {
    const fixture = claudeWarningFixture();
    const result = runCapturedCheckCli({
      args: ["check", fixture.filePath, "--config", "broken.json"],
      sources: [fixture],
      configs: {
        "broken.json": "{",
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Failed to parse configuration JSON");
  });
});
