/**
 * @file CLI tests for harness-derived review availability.
 */

import { describe, expect, it } from "bun:test";
import type { CommandRunner, CommandRunnerOptions } from "./git-support";
import { createCapturedCliOutput } from "./git-support";
import type { GateCommand } from "./review-evidence-cli";
import { runReviewEvidenceCli } from "./review-evidence-cli";

type RunnerCall = {
  readonly command: string;
  readonly options: CommandRunnerOptions | undefined;
  readonly args: readonly string[];
};

const onePassingGate = [["make all", "true", []]] satisfies readonly GateCommand[];

/** Create a fake runner factory that records every command invocation. */
const createFakeRunnerFactory = (calls: RunnerCall[] = []) => {
  return (command: string, options?: CommandRunnerOptions): CommandRunner => ({
    run: (args) => {
      calls.push({ command, options, args });
      return { status: 0, signal: null, stdout: "", stderr: "" };
    },
  });
};

/** Run the CLI with captured output and explicit environment state. */
const runCli = (
  options: { readonly args?: readonly string[]; readonly env?: NodeJS.ProcessEnv } = {},
) => {
  const output = createCapturedCliOutput();
  const calls: RunnerCall[] = [];
  const exitCode = runReviewEvidenceCli(options.args ?? [], {
    createRunner: createFakeRunnerFactory(calls),
    gateCommands: onePassingGate,
    writeOut: output.writeOut,
    writeErr: output.writeErr,
    env: options.env ?? {},
  });

  return { exitCode, output, calls };
};

/** Assert that the fake runner executed the single passing gate. */
const expectOnePassingGateRun = (calls: readonly RunnerCall[]): void => {
  expect(calls.map((call) => [call.command, call.args])).toEqual([["true", []]]);
};

describe("runReviewEvidenceCli harness availability", () => {
  it("does not claim scrutineer when no harness availability state is present", () => {
    const result = runCli({ env: {} });

    expect(result.exitCode).toBe(3);
    expectOnePassingGateRun(result.calls);
    expect(result.output.stdout).toMatchInlineSnapshot(`
      "Review evidence: degraded
      - gate make all: passed
      - dual-review path: local-self-run (degraded fallback; scrutineer unavailable; coderabbit unavailable; local-self-run available)
      - degraded reason: no independent dual-review path available
      "
    `);
    expect(result.output.stderr).toMatchInlineSnapshot(`""`);
  });

  it("selects scrutineer when the harness declares scrutineer availability", () => {
    const result = runCli({ env: { ODW_LINT_REVIEW_SCRUTINEER: "available" } });

    expect(result.exitCode).toBe(0);
    expectOnePassingGateRun(result.calls);
    expect(result.output.stdout).toMatchInlineSnapshot(`
      "Review evidence: verified
      - gate make all: passed
      - dual-review path: scrutineer (primary; scrutineer available)
      "
    `);
    expect(result.output.stderr).toMatchInlineSnapshot(`""`);
  });

  it("lets CLI availability flags override harness state", () => {
    const result = runCli({
      args: ["--scrutineer=quota-blocked"],
      env: { ODW_LINT_REVIEW_SCRUTINEER: "available" },
    });

    expect(result.exitCode).toBe(3);
    expectOnePassingGateRun(result.calls);
    expect(result.output.stdout).toMatchInlineSnapshot(`
      "Review evidence: degraded
      - gate make all: passed
      - dual-review path: local-self-run (degraded fallback; scrutineer quota-blocked; coderabbit unavailable; local-self-run available)
      - degraded reason: no independent dual-review path available
      "
    `);
    expect(result.output.stderr).toMatchInlineSnapshot(`""`);
  });

  it("reports usage errors for invalid harness availability values", () => {
    const result = runCli({
      env: { ODW_LINT_REVIEW_CODERABBIT: "not-a-value" },
    });

    expect(result.exitCode).toBe(2);
    expect(result.calls).toEqual([]);
    expect(result.output.stdout).toMatchInlineSnapshot(`""`);
    expect(result.output.stderr).toMatchInlineSnapshot(`
      "Review evidence: usage-error
      - usage error: invalid coderabbit availability: not-a-value
      "
    `);
  });

  it("supports explicit local self-run availability flags", () => {
    const result = runCli({
      args: [
        "--local-self-run=unavailable",
        "--scrutineer=unavailable",
        "--coderabbit=unavailable",
      ],
    });

    expect(result.exitCode).toBe(3);
    expectOnePassingGateRun(result.calls);
    expect(result.output.stdout).toMatchInlineSnapshot(`
      "Review evidence: degraded
      - gate make all: passed
      - dual-review path: local-self-run (degraded fallback; scrutineer unavailable; coderabbit unavailable; local-self-run unavailable)
      - degraded reason: no independent dual-review path available
      "
    `);
    expect(result.output.stderr).toMatchInlineSnapshot(`""`);
  });
});
