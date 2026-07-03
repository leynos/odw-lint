/**
 * @file CLI tests for reviewer-run review evidence.
 */

import { describe, expect, it } from "bun:test";
import type { CommandResult, CommandRunner, CommandRunnerOptions } from "./git-support";
import { createCapturedCliOutput } from "./git-support";
import type { ReviewEvidenceResult, ReviewGateId } from "./review-evidence";
import type { exitCodeFor, GateCommand, ReviewEvidenceExitCode } from "./review-evidence-cli";
import { runReviewEvidenceCli } from "./review-evidence-cli";

type Assert<T extends true> = T;
type IsAssignable<Actual, Expected> = Actual extends Expected ? true : false;
type _ExitCodeInputContract = Assert<
  IsAssignable<Parameters<typeof exitCodeFor>, [ReviewEvidenceResult]>
>;

const incompleteExitCodeMap = {
  verified: 0,
  failed: 1,
  "usage-error": 2,
} satisfies Partial<Record<ReviewEvidenceResult["status"], ReviewEvidenceExitCode>>;
// @ts-expect-error Exhaustive status maps must include degraded.
incompleteExitCodeMap satisfies Record<ReviewEvidenceResult["status"], ReviewEvidenceExitCode>;

type RunnerCall = {
  readonly command: string;
  readonly options: CommandRunnerOptions | undefined;
  readonly args: readonly string[];
};

const onePassingGate = [["make all", "true", []]] satisfies readonly GateCommand[];
const oneMissingGate = [
  ["make all", "odw-lint-definitely-absent-command", []],
] satisfies readonly GateCommand[];

/** Build a shared command-result fixture with focused overrides. */
const makeResult = (overrides: Partial<CommandResult> = {}): CommandResult => ({
  status: 0,
  signal: null,
  stdout: "",
  stderr: "",
  ...overrides,
});

/** Build the Node-style error shape produced by timed-out child processes. */
const makeTimeoutError = (): NodeJS.ErrnoException => {
  const error = new Error("spawn true ETIMEDOUT") as NodeJS.ErrnoException;
  error.code = "ETIMEDOUT";
  return error;
};

/** Create a fake runner factory that records every command invocation. */
const createFakeRunnerFactory = (
  resultsByCommand: Readonly<Record<string, CommandResult>>,
  calls: RunnerCall[] = [],
) => {
  return (command: string, options?: CommandRunnerOptions): CommandRunner => ({
    run: (args) => {
      calls.push({ command, options, args });
      return resultsByCommand[command] ?? makeResult();
    },
  });
};

/** Run the CLI with captured output and a fake command-runner factory. */
const runCli = (
  options: {
    readonly args?: readonly string[];
    readonly gateCommands?: readonly GateCommand[];
    readonly resultsByCommand?: Readonly<Record<string, CommandResult>>;
    readonly env?: NodeJS.ProcessEnv;
  } = {},
) => {
  const output = createCapturedCliOutput();
  const calls: RunnerCall[] = [];
  const cliOptions = {
    createRunner: createFakeRunnerFactory(options.resultsByCommand ?? {}, calls),
    gateCommands: options.gateCommands ?? onePassingGate,
    writeOut: output.writeOut,
    writeErr: output.writeErr,
    ...(options.env === undefined ? {} : { env: options.env }),
  };
  const exitCode = runReviewEvidenceCli(options.args ?? [], cliOptions);

  return { exitCode, output, calls };
};

describe("runReviewEvidenceCli", () => {
  it("returns verified evidence when every keyed gate passes", () => {
    const result = runCli({
      gateCommands: [
        ["make all", "pass-all", ["all"]],
        ["make markdownlint", "pass-markdownlint", ["markdownlint"]],
      ],
    });

    expect(result.exitCode).toBe(0);
    expect(result.output.stderr).toBe("");
    expect(result.output.stdout).toContain("Review evidence: verified");
    expect(result.output.stdout).toContain("- gate make all: passed");
    expect(result.output.stdout).toContain("- gate make markdownlint: passed");
    expect(result.output.stdout).toContain("dual-review path: scrutineer (primary");
    expect(result.output.stdout).toMatchInlineSnapshot(`
      "Review evidence: verified
      - gate make all: passed
      - gate make markdownlint: passed
      - dual-review path: scrutineer (primary; scrutineer available)
      "
    `);
    expect(result.calls.map((call) => [call.command, call.args])).toEqual([
      ["pass-all", ["all"]],
      ["pass-markdownlint", ["markdownlint"]],
    ]);
    expect(result.calls[0]?.options).toMatchObject({
      timeoutMs: 300000,
      maxBufferBytes: 67108864,
    });
  });

  it("returns failed evidence and exit 1 when a required gate fails", () => {
    const result = runCli({
      gateCommands: [
        ["make all", "pass-all", []],
        ["make markdownlint", "fail-markdownlint", []],
      ],
      resultsByCommand: {
        "fail-markdownlint": makeResult({
          status: 1,
          stderr: "markdownlint found an issue\n",
        }),
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toContain("Review evidence: failed");
    expect(result.output.stdout).toContain(
      "- gate make markdownlint: failed (exit 1; markdownlint found an issue)",
    );
    expect(result.output.stdout).toContain("- failed gate: make markdownlint");
    expect(result.output.stdout).toMatchInlineSnapshot(`
      "Review evidence: failed
      - gate make all: passed
      - gate make markdownlint: failed (exit 1; markdownlint found an issue)
      - dual-review path: scrutineer (primary; scrutineer available)
      - failed gate: make markdownlint
      "
    `);
  });

  it("returns degraded evidence and exit 3 when a gate cannot spawn", () => {
    const result = runCli({
      resultsByCommand: {
        true: makeResult({ status: null, error: new Error("spawn true ENOENT") }),
      },
    });

    expect(result.exitCode).toBe(3);
    expect(result.output.stdout).toContain("Review evidence: degraded");
    expect(result.output.stdout).toContain("gate make all: unavailable (spawn true ENOENT)");
    expect(result.output.stdout).toContain("degraded reason: make all unavailable");
    expect(result.output.stdout).toMatchInlineSnapshot(`
      "Review evidence: degraded
      - gate make all: unavailable (spawn true ENOENT)
      - dual-review path: scrutineer (primary; scrutineer available)
      - degraded reason: make all unavailable: spawn true ENOENT
      "
    `);
  });

  it("returns failed evidence and exit 1 when a gate times out", () => {
    const result = runCli({
      resultsByCommand: {
        true: makeResult({
          status: null,
          signal: "SIGTERM",
          error: makeTimeoutError(),
        }),
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toContain("Review evidence: failed");
    expect(result.output.stdout).toContain("gate make all: failed (exit 1; command timed out)");
    expect(result.output.stdout).toContain("- failed gate: make all");
  });

  it("returns failed evidence and exit 1 when a gate is killed", () => {
    const result = runCli({
      resultsByCommand: {
        true: makeResult({
          status: null,
          signal: "SIGTERM",
        }),
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toContain(
      "gate make all: failed (exit 1; command terminated by SIGTERM)",
    );
  });

  it("returns degraded evidence without spawning when execution is disabled", () => {
    const result = runCli({ args: ["--no-exec"] });

    expect(result.exitCode).toBe(3);
    expect(result.calls).toEqual([]);
    expect(result.output.stdout).toContain("Review evidence: degraded");
    expect(result.output.stdout).toContain(
      "degraded reason: command execution unavailable; gates were not independently executed",
    );
  });

  it("uses the execution-disabled environment signal", () => {
    const result = runCli({ env: { ODW_LINT_REVIEW_EXEC: "0" } });

    expect(result.exitCode).toBe(3);
    expect(result.calls).toEqual([]);
    expect(result.output.stdout).toContain("Review evidence: degraded");
  });

  it("uses the documented default gate timeout", () => {
    const result = runCli();

    expect(result.exitCode).toBe(0);
    expect(result.calls[0]?.options).toMatchObject({
      timeoutMs: 300000,
    });
  });

  it("uses the CLI gate-timeout override for each gate command", () => {
    const result = runCli({ args: ["--gate-timeout-ms=120000"] });

    expect(result.exitCode).toBe(0);
    expect(result.calls[0]?.options).toMatchObject({
      timeoutMs: 120000,
    });
  });

  it("uses the environment gate-timeout override", () => {
    const result = runCli({ env: { ODW_LINT_REVIEW_GATE_TIMEOUT_MS: "450000" } });

    expect(result.exitCode).toBe(0);
    expect(result.calls[0]?.options).toMatchObject({
      timeoutMs: 450000,
    });
  });

  it("reports usage errors for invalid gate-timeout values", () => {
    const result = runCli({ args: ["--gate-timeout-ms=0"] });

    expect(result.exitCode).toBe(2);
    expect(result.output.stderr).toContain("invalid gate timeout from --gate-timeout-ms: 0");
  });

  it("reports coderabbit as the explicit fallback when scrutineer is quota-blocked", () => {
    const result = runCli({ args: ["--scrutineer=quota-blocked"] });

    expect(result.exitCode).toBe(0);
    expect(result.output.stdout).toContain(
      "dual-review path: coderabbit (fallback; scrutineer quota-blocked; coderabbit available)",
    );
  });

  it("reports local self-run as degraded when independent reviewers are unavailable", () => {
    const result = runCli({
      args: ["--scrutineer=unavailable", "--coderabbit=unavailable"],
    });

    expect(result.exitCode).toBe(3);
    expect(result.output.stdout).toContain("dual-review path: local-self-run (degraded fallback");
    expect(result.output.stdout).toContain("degraded reason: no independent dual-review path");
  });

  it("reports local self-run when CodeRabbit returns no usable output", () => {
    const result = runCli({
      args: ["--scrutineer=quota-blocked", "--coderabbit=no-output"],
    });

    expect(result.exitCode).toBe(3);
    expect(result.output.stdout).toContain(
      "dual-review path: local-self-run (degraded fallback; scrutineer quota-blocked; coderabbit no-output; local-self-run available)",
    );
    expect(result.output.stdout).toContain("degraded reason: no independent dual-review path");
  });

  it("reports usage errors for unknown flags", () => {
    const result = runCli({ args: ["--unknown"] });

    expect(result.exitCode).toBe(2);
    expect(result.output.stdout).toBe("");
    expect(result.output.stderr).toContain("Review evidence: usage-error");
    expect(result.output.stderr).toContain("unknown option: --unknown");
    expect(result.output.stderr).toMatchInlineSnapshot(`
      "Review evidence: usage-error
      - usage error: unknown option: --unknown
      "
    `);
  });

  it("reports usage errors for invalid reviewer availability", () => {
    const result = runCli({ args: ["--scrutineer=busy"] });

    expect(result.exitCode).toBe(2);
    expect(result.output.stderr).toContain("invalid scrutineer availability: busy");
  });

  it("derives required gates from the keyed gate-command list", () => {
    const result = runCli({ gateCommands: onePassingGate });
    const gateLines = result.output.stdout.split("\n").filter((line) => line.startsWith("- gate "));

    expect(result.exitCode).toBe(0);
    expect(gateLines).toEqual(["- gate make all: passed"]);
  });

  it("uses the shared real command runner for a passing command", () => {
    const output = createCapturedCliOutput();
    const exitCode = runReviewEvidenceCli([], {
      gateCommands: onePassingGate,
      writeOut: output.writeOut,
      writeErr: output.writeErr,
    });

    expect(exitCode).toBe(0);
    expect(output.stdout).toContain("Review evidence: verified");
    expect(output.stdout).toContain("- gate make all: passed");
  });

  it("maps a real missing executable to degraded unavailable evidence", () => {
    const output = createCapturedCliOutput();
    const exitCode = runReviewEvidenceCli([], {
      gateCommands: oneMissingGate,
      writeOut: output.writeOut,
      writeErr: output.writeErr,
    });

    expect(exitCode).toBe(3);
    expect(output.stdout).toContain("Review evidence: degraded");
    expect(output.stdout).toContain("- gate make all: unavailable");
  });
});

// Keep the ReviewGateId import load-bearing for keyed command fixtures.
onePassingGate satisfies readonly (readonly [ReviewGateId, string, readonly string[]])[];
