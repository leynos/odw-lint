/**
 * @file Standard-input check CLI tests.
 */

import { describe, expect, it } from "bun:test";
import { runCheckCli } from "../../src/cli/check-cli";

type CapturedCliRun = {
  readonly exitCode: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
};

const VERSION = "0.0.0-test";
const STDIN_FILE = "workflows/stdin.js";
const INVALID_SOURCE = "console.log('missing metadata')\n";
const CLEAN_SOURCE = `export const meta = {
  name: "stdin-workflow",
  description: "A clean workflow read from standard input.",
  phases: [{ title: "Run" }],
}

phase("Run")
`;

/** Simulates optional default configuration discovery finding no file. */
const readNoConfig = (): string => {
  throw Object.assign(new Error("missing test config"), { code: "ENOENT" });
};

/** Runs the CLI with captured writers and an injected standard-input reader. */
const runCapturedStdinCheckCli = (args: readonly string[], stdinText = ""): CapturedCliRun => {
  let stdout = "";
  let stderr = "";
  const exitCode = runCheckCli(args, {
    version: VERSION,
    readConfigFile: readNoConfig,
    readStdin: () => stdinText,
    writeOut: (message) => {
      stdout += message;
    },
    writeErr: (message) => {
      stderr += message;
    },
  });

  return { exitCode, stdout, stderr };
};

describe("standard-input check CLI runner", () => {
  it("reports stdin diagnostics under the logical stdin filename", () => {
    const result = runCapturedStdinCheckCli(
      ["check", "--stdin-filename", STDIN_FILE],
      INVALID_SOURCE,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${STDIN_FILE}:1:1 error odw/meta-required`);
    expect(result.stdout).toContain("Found 1 error.");
  });

  it("returns 0 without output for clean stdin", () => {
    expect(
      runCapturedStdinCheckCli(["check", "--stdin-filename", STDIN_FILE], CLEAN_SOURCE),
    ).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("rejects --stdin-filename without a value", () => {
    expect(runCapturedStdinCheckCli(["check", "--stdin-filename"])).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: "missing value for --stdin-filename\n",
    });
  });

  it("rejects stdin mode combined with path operands", () => {
    expect(runCapturedStdinCheckCli(["check", "--stdin-filename", STDIN_FILE, "extra.js"])).toEqual(
      {
        exitCode: 2,
        stdout: "",
        stderr: "--stdin-filename cannot be combined with path operands\n",
      },
    );
  });
});
