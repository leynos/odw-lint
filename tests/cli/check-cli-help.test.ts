/**
 * @file Help, version, and usage diagnostics for the `check` command.
 */

import { describe, expect, it } from "bun:test";
import { parseCheckArgs } from "../../src/cli/check-args";
import { runCheckCli } from "../../src/cli/check-cli";

type CapturedCliRun = {
  readonly exitCode: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
};

const VERSION = "0.0.0-test";

const IMPLEMENTED_HELP_FLAGS = [
  "--output-format",
  "--output-file",
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
] as const;

/** Runs the CLI with captured process streams. */
const runCapturedCheckCli = (args: readonly string[]): CapturedCliRun => {
  let stdout = "";
  let stderr = "";
  const exitCode = runCheckCli(args, {
    version: VERSION,
    readConfigFile: () => {
      throw Object.assign(new Error("missing test config"), { code: "ENOENT" });
    },
    writeOut: (message) => {
      stdout += message;
    },
    writeErr: (message) => {
      stderr += message;
    },
  });

  return { exitCode, stdout, stderr };
};

describe("check CLI help and version", () => {
  it.each([
    ["long help", ["check", "--help"]],
    ["short help", ["check", "-h"]],
  ] as const)("prints usage for %s", (_caseName, args) => {
    const result = runCapturedCheckCli(args);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toStartWith("Usage: odw-lint check [OPTIONS] <workflow.js ...>\n");
    for (const flag of IMPLEMENTED_HELP_FLAGS) {
      expect(result.stdout).toContain(flag);
    }
  });

  it.each([
    ["long version", ["check", "--version"]],
    ["short version", ["check", "-V"]],
  ] as const)("prints version for %s", (_caseName, args) => {
    expect(runCapturedCheckCli(args)).toEqual({
      exitCode: 0,
      stdout: `${VERSION}\n`,
      stderr: "",
    });
  });

  it.each([
    ["--output-format", ["check", "--output-format"]],
    ["--output-file", ["check", "--output-file"]],
    ["--config", ["check", "--config"]],
    ["--stdin-filename", ["check", "--stdin-filename"]],
  ] as const)("uses a stable missing-value error for %s", (flag, args) => {
    const usageError = `missing value for ${flag}`;

    expect(parseCheckArgs(args)).toEqual({ ok: false, usageError });
    expect(runCapturedCheckCli(args)).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: `${usageError}\n`,
    });
  });
});
