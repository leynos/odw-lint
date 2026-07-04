/**
 * @file Process smoke tests for the recorded review-evidence artefact CLI.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const completeVerifiedReport =
  "Review evidence: verified\n- gate make all: passed\n- dual-review path: scrutineer (primary; scrutineer available)\n";

/** Run the artefact CLI entrypoint as a real Bun child process. */
const runCliProcess = (cwd: string) => {
  return Bun.spawnSync({
    cmd: ["bun", "run", join(repositoryRoot, "tests/build-gate/review-evidence-artefact-cli.ts")],
    cwd,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
};

/** Assert process output in a stable, reviewable shape. */
const expectProcessResult = (
  result: ReturnType<typeof runCliProcess>,
  expected: {
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
  },
): void => {
  expect({
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }).toEqual(expected);
};

describe("review-evidence artefact CLI process smoke", () => {
  it("rejects a missing default artefact", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "odw-lint-review-evidence-artefact-"));

    try {
      const result = runCliProcess(tempDir);

      expectProcessResult(result, {
        exitCode: 1,
        stdout: "",
        stderr: `Review evidence artefact: missing
- artefact path: .review-evidence/report.txt
`,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("accepts a verified default artefact", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "odw-lint-review-evidence-artefact-"));
    const artefactPath = join(tempDir, ".review-evidence/report.txt");

    try {
      mkdirSync(dirname(artefactPath), { recursive: true });
      writeFileSync(artefactPath, completeVerifiedReport);

      const result = runCliProcess(tempDir);

      expectProcessResult(result, {
        exitCode: 0,
        stderr: "",
        stdout: `Review evidence artefact: present
- recorded status: verified
- artefact path: .review-evidence/report.txt
`,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
