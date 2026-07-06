/**
 * @file Exit-code policy tests for the explicit-path `check` command.
 */

import { describe, expect, it } from "bun:test";
import { runCheckCli } from "../../src/cli/check-cli";

type CapturedCliRun = {
  readonly exitCode: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
};

const VERSION = "0.0.0-test";
const CLEAN_SOURCE =
  "export const meta = { name: 'clean', description: 'Clean workflow', phases: [{ title: 'Run' }] };\n";
const INVALID_SOURCE = "await step.do();\n";
const WARNING_SOURCE =
  "export const meta = { name: marker, description: 'Computed name', phases: [{ title: 'Run' }] };\n";

/** Simulates optional default configuration discovery finding no file. */
const readNoConfig = (): string => {
  throw Object.assign(new Error("missing test config"), { code: "ENOENT" });
};

/** Runs the CLI with captured writers and injected source text by path. */
const runCapturedCheckCli = (
  args: readonly string[],
  sources: ReadonlyMap<string, string> = new Map(),
): CapturedCliRun => {
  let stdout = "";
  let stderr = "";
  const exitCode = runCheckCli(args, {
    version: VERSION,
    readFileText: (filePath) => {
      const sourceText = sources.get(filePath);

      if (sourceText === undefined) {
        throw Object.assign(new Error("missing test fixture"), { code: "ENOENT" });
      }

      return sourceText;
    },
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

describe("check CLI exit-code policy flags", () => {
  it("returns 0 for warnings within the explicit warning budget", () => {
    const result = runCapturedCheckCli(
      ["check", "--max-warnings", "1", "warning.js"],
      new Map([["warning.js", WARNING_SOURCE]]),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("warning odw/meta-statically-unprovable");
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("returns 1 for warnings above the explicit warning budget", () => {
    const result = runCapturedCheckCli(
      ["check", "--max-warnings", "0", "warning.js"],
      new Map([["warning.js", WARNING_SOURCE]]),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("accepts the equals spelling for the warning budget", () => {
    const result = runCapturedCheckCli(
      ["check", "--max-warnings=1", "warning.js"],
      new Map([["warning.js", WARNING_SOURCE]]),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Found 1 warning.");
  });

  it("returns 1 for errors even when a warning budget is present", () => {
    const result = runCapturedCheckCli(
      ["check", "--max-warnings", "5", "invalid.js"],
      new Map([["invalid.js", INVALID_SOURCE]]),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Found 1 error.");
  });

  it("returns 0 for a clean workflow when a warning budget is present", () => {
    expect(
      runCapturedCheckCli(
        ["check", "--max-warnings", "1", "clean.js"],
        new Map([["clean.js", CLEAN_SOURCE]]),
      ),
    ).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("prints diagnostics but exits 0 with --exit-zero", () => {
    const result = runCapturedCheckCli(
      ["check", "--exit-zero", "invalid.js"],
      new Map([["invalid.js", INVALID_SOURCE]]),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("invalid.js:1:1 error odw/meta-required");
    expect(result.stdout).toContain("Found 1 error.");
  });

  it("exits 0 for unreadable input with --exit-zero", () => {
    const result = runCapturedCheckCli(["check", "--exit-zero", "missing.js"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Skipped 1 file.\n");
    expect(result.stderr).toContain("error: cannot read missing.js: missing test fixture");
  });

  it("does not hide usage errors with --exit-zero", () => {
    expect(runCapturedCheckCli(["check", "--exit-zero"])).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: "usage: odw-lint check <workflow.js ...>\n",
    });
  });

  it.each([
    ["clean", "clean.js", CLEAN_SOURCE, 0],
    ["invalid", "invalid.js", INVALID_SOURCE, 1],
  ] as const)("keeps the default %s exit code with --exit-non-zero-on-fix", (_caseName, filePath, sourceText, expectedExitCode) => {
    const sources = new Map([[filePath, sourceText]]);
    const defaultRun = runCapturedCheckCli(["check", filePath], sources);
    const policyRun = runCapturedCheckCli(["check", "--exit-non-zero-on-fix", filePath], sources);

    expect(policyRun.exitCode).toBe(expectedExitCode);
    expect(policyRun.exitCode).toBe(defaultRun.exitCode);
    expect(policyRun.stdout).toBe(defaultRun.stdout);
    expect(policyRun.stderr).toBe(defaultRun.stderr);
  });
});
