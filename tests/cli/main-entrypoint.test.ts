/**
 * @file Process smoke tests for the explicit-path `check` entrypoint.
 */

import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Run the check CLI entrypoint as a real Bun child process. */
const runCliProcess = (args: readonly string[]) => {
  return Bun.spawnSync({
    cmd: ["bun", "run", "src/cli/main.ts", ...args],
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
};

describe("check CLI entrypoint smoke", () => {
  it("returns usage exit 2 when check has no path operands", () => {
    const result = runCliProcess(["check"]);

    expect({
      exitCode: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    }).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: "usage: odw-lint check <workflow.js ...>\n",
    });
  });
});
