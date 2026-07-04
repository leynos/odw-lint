/**
 * @file Process smoke tests for recorded review-evidence reports.
 */

import { describe, expect, it } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Run the review-evidence CLI entrypoint as a real Bun child process. */
const runCliProcess = (options: {
  readonly args?: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
}) => {
  const makeBinDir = mkdtempSync(join(tmpdir(), "odw-lint-review-evidence-"));
  const makePath = join(makeBinDir, "make");
  const inheritedEnvironment = process.env as NodeJS.ProcessEnv & {
    readonly PATH?: string;
  };

  try {
    writeFileSync(makePath, "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(makePath, 0o755);

    return Bun.spawnSync({
      cmd: ["bun", "run", "tests/build-gate/review-evidence-cli.ts", ...(options.args ?? [])],
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PATH: `${makeBinDir}:${inheritedEnvironment.PATH ?? ""}`,
        ...(options.env ?? {}),
      },
      stdout: "pipe",
      stderr: "pipe",
    });
  } finally {
    rmSync(makeBinDir, { recursive: true, force: true });
  }
};

describe("review-evidence CLI recording process smoke", () => {
  it("records a verified report that the artefact check accepts", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "odw-lint-review-evidence-record-"));
    const artefactPath = join(tempDir, "report.txt");

    try {
      const result = runCliProcess({
        args: [`--record=${artefactPath}`],
        env: { ODW_LINT_REVIEW_SCRUTINEER: "available" },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr.toString()).toBe("");
      expect(readFileSync(artefactPath, "utf8")).toBe(result.stdout.toString());

      const checkResult = Bun.spawnSync({
        cmd: [
          "bun",
          "run",
          "tests/build-gate/review-evidence-artefact-cli.ts",
          `--evidence-path=${artefactPath}`,
        ],
        cwd: repositoryRoot,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(checkResult.exitCode).toBe(0);
      expect(checkResult.stderr.toString()).toBe("");
      expect(checkResult.stdout.toString()).toContain("Review evidence artefact: present");
      expect(checkResult.stdout.toString()).toContain("- recorded status: verified");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does not create an artefact for usage errors", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "odw-lint-review-evidence-record-"));
    const artefactPath = join(tempDir, "report.txt");

    try {
      const result = runCliProcess({
        args: [`--record=${artefactPath}`, "--unknown"],
      });

      expect(result.exitCode).toBe(2);
      expect(existsSync(artefactPath)).toBeFalse();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
