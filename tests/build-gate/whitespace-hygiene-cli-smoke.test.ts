/**
 * @file Process smoke tests for the whitespace hygiene CLI entrypoint.
 */

import { describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { commitAll, createTemporaryRepository, writeRepositoryFile } from "./git-support";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Run the whitespace hygiene CLI entrypoint as a real Bun child process. */
const runCliProcess = (cwd: string) => {
  return Bun.spawnSync({
    cmd: [process.execPath, "run", join(repositoryRoot, "tests/build-gate/whitespace-hygiene.ts")],
    cwd,
    env: process.env,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  });
};

describe("whitespace hygiene CLI process smoke", () => {
  it("passes a clean temporary repository", () => {
    const repositoryPath = createTemporaryRepository({
      prefix: "odw-lint-whitespace-hygiene-cli-",
    });

    try {
      writeRepositoryFile(repositoryPath, "README.md", "Clean file\n");
      commitAll(repositoryPath);

      const result = runCliProcess(repositoryPath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toMatchInlineSnapshot(`
"Whitespace hygiene check passed.
"
`);
      expect(result.stderr.toString()).toMatchInlineSnapshot(`""`);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it("fails a temporary repository with trailing whitespace", () => {
    const repositoryPath = createTemporaryRepository({
      prefix: "odw-lint-whitespace-hygiene-cli-",
    });

    try {
      writeRepositoryFile(repositoryPath, "fixtures/workflow.js", "clean\nbad \n");
      commitAll(repositoryPath);

      const result = runCliProcess(repositoryPath);

      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toBe("");
      expect(result.stderr.toString()).toMatchInlineSnapshot(`
"Trailing whitespace found in tracked files:
fixtures/workflow.js:2: trailing space
"
`);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
});
