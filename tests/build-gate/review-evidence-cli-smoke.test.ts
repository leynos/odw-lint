/**
 * @file Process smoke tests for the review-evidence CLI entrypoint.
 */

import { describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const reviewerAvailabilityVariables = [
  "ODW_LINT_REVIEW_SCRUTINEER",
  "ODW_LINT_REVIEW_CODERABBIT",
  "ODW_LINT_REVIEW_LOCAL_SELF_RUN",
] as const;

/** Build a clean reviewer environment before applying a test case's overrides. */
const reviewerEnvironment = (overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const environment = { ...process.env };
  for (const variable of reviewerAvailabilityVariables) {
    Reflect.deleteProperty(environment, variable);
  }
  return { ...environment, ...overrides };
};

/** Run the review-evidence CLI entrypoint as a real Bun child process. */
const runCliProcess = (env: NodeJS.ProcessEnv = {}) => {
  const makeBinDir = mkdtempSync(join(tmpdir(), "odw-lint-review-evidence-"));
  const makePath = join(makeBinDir, "make");
  const inheritedEnvironment = process.env as NodeJS.ProcessEnv & {
    readonly PATH?: string;
  };

  try {
    writeFileSync(makePath, "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(makePath, 0o755);

    return Bun.spawnSync({
      cmd: ["bun", "run", "tests/build-gate/review-evidence-cli.ts"],
      cwd: repositoryRoot,
      env: {
        ...reviewerEnvironment(env),
        PATH: `${makeBinDir}:${inheritedEnvironment.PATH ?? ""}`,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
  } finally {
    rmSync(makeBinDir, { recursive: true, force: true });
  }
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

describe("review-evidence CLI process smoke", () => {
  it("returns degraded exit 3 for a bare local self-run path", () => {
    const result = runCliProcess();

    expectProcessResult(result, {
      exitCode: 3,
      stderr: "",
      stdout: `Review evidence: degraded
- gate make all: passed
- gate make markdownlint: passed
- gate make nixie: passed
- dual-review path: local-self-run (degraded fallback; scrutineer unavailable; coderabbit unavailable; local-self-run available)
- degraded reason: no independent dual-review path available
`,
    });
  });

  it("returns verified exit 0 when scrutineer is available", () => {
    const result = runCliProcess({ ODW_LINT_REVIEW_SCRUTINEER: "available" });

    expectProcessResult(result, {
      exitCode: 0,
      stderr: "",
      stdout: `Review evidence: verified
- gate make all: passed
- gate make markdownlint: passed
- gate make nixie: passed
- dual-review path: scrutineer (primary; scrutineer available)
`,
    });
  });

  it("returns usage-error exit 2 for invalid reviewer availability", () => {
    const result = runCliProcess({ ODW_LINT_REVIEW_SCRUTINEER: "busy" });

    expectProcessResult(result, {
      exitCode: 2,
      stdout: "",
      stderr: `Review evidence: usage-error
- usage error: invalid scrutineer availability: busy
`,
    });
  });
});
