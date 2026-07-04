/**
 * @file Recording tests for reviewer-run review evidence.
 */

import { describe, expect, it } from "bun:test";
import type { CliWriters } from "./cli-support";
import type { CommandResult, CommandRunner, CommandRunnerOptions } from "./git-support";
import { createCapturedCliOutput } from "./git-support";
import type { GateCommand } from "./review-evidence-cli";
import { runReviewEvidenceCli } from "./review-evidence-cli";
import {
  formatProvenanceTrailer,
  type ReadTreeProvenanceResult,
  type TreeProvenance,
} from "./review-evidence-provenance";

type RunnerCall = {
  readonly command: string;
  readonly options: CommandRunnerOptions | undefined;
  readonly args: readonly string[];
};

type ArtefactWrite = {
  readonly path: string;
  readonly content: string;
};

const onePassingGate = [["make all", "true", []]] satisfies readonly GateCommand[];
const fixedProvenance = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  tree: "fedcba9876543210fedcba9876543210fedcba98",
} satisfies TreeProvenance;

/** Build a shared command-result fixture with focused overrides. */
const makeResult = (overrides: Partial<CommandResult> = {}): CommandResult => ({
  status: 0,
  signal: null,
  stdout: "",
  stderr: "",
  ...overrides,
});

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

/** Run the CLI with captured output, gates, and an injectable artefact writer. */
const runCli = (
  options: {
    readonly args?: readonly string[];
    readonly resultsByCommand?: Readonly<Record<string, CommandResult>>;
    readonly env?: NodeJS.ProcessEnv;
    readonly cwd?: string;
    readonly readProvenance?: (cwd: string) => ReadTreeProvenanceResult;
    readonly writeArtefact?: (path: string, content: string) => void;
  } = {},
) => {
  const output = createCapturedCliOutput();
  const calls: RunnerCall[] = [];
  const writes: ArtefactWrite[] = [];
  const cliOptions = {
    createRunner: createFakeRunnerFactory(options.resultsByCommand ?? {}, calls),
    gateCommands: onePassingGate,
    writeOut: output.writeOut,
    writeErr: output.writeErr,
    env: options.env ?? {},
    cwd: options.cwd ?? "/worktree",
    readProvenance:
      options.readProvenance ??
      (() => ({
        ok: true,
        provenance: fixedProvenance,
      })),
    writeArtefact:
      options.writeArtefact ??
      ((path, content) => {
        writes.push({ path, content });
      }),
  };
  cliOptions satisfies {
    readonly writeOut: CliWriters["writeOut"];
    readonly writeErr: CliWriters["writeErr"];
  };

  const exitCode = runReviewEvidenceCli(options.args ?? [], cliOptions);

  return { exitCode, output, calls, writes };
};

describe("review-evidence CLI recording", () => {
  it("records verified reports to the explicit path without changing exit code", () => {
    const result = runCli({
      args: ["--record=reports/review.txt"],
      env: { ODW_LINT_REVIEW_SCRUTINEER: "available" },
    });

    expect(result.exitCode).toBe(0);
    expect(result.writes).toEqual([
      {
        path: "/worktree/reports/review.txt",
        content: `${result.output.stdout}${formatProvenanceTrailer(fixedProvenance)}`,
      },
    ]);
    expect(result.output.stdout).not.toContain("- reviewed tree:");
    expect(result.writes[0]?.content).toMatchInlineSnapshot(`
      "Review evidence: verified
      - gate make all: passed
      - dual-review path: scrutineer (primary; scrutineer available)
      - reviewed commit: 0123456789abcdef0123456789abcdef01234567
      - reviewed tree: fedcba9876543210fedcba9876543210fedcba98
      "
    `);
  });

  it("records degraded reports when the environment selects the default path", () => {
    const result = runCli({
      args: ["--no-exec"],
      env: { ODW_LINT_REVIEW_EVIDENCE_PATH: "" },
    });

    expect(result.exitCode).toBe(3);
    expect(result.writes).toEqual([
      {
        path: "/worktree/.review-evidence/report.txt",
        content: `${result.output.stdout}${formatProvenanceTrailer(fixedProvenance)}`,
      },
    ]);
    expect(result.writes[0]?.content).toBe(`Review evidence: degraded
- dual-review path: local-self-run (degraded fallback; scrutineer unavailable; coderabbit unavailable; local-self-run available)
- degraded reason: command execution unavailable; gates were not independently executed
- degraded reason: no independent dual-review path available
- reviewed commit: 0123456789abcdef0123456789abcdef01234567
- reviewed tree: fedcba9876543210fedcba9876543210fedcba98
`);
  });

  it("records unbound evidence when provenance is unavailable", () => {
    const result = runCli({
      args: ["--record=report.txt"],
      env: { ODW_LINT_REVIEW_SCRUTINEER: "available" },
      readProvenance: () => ({ ok: false, message: "git rev-parse HEAD failed" }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.writes).toEqual([
      {
        path: "/worktree/report.txt",
        content: result.output.stdout,
      },
    ]);
    expect(result.output.stderr).toBe(
      "review evidence provenance unavailable: git rev-parse HEAD failed\n",
    );
  });

  it("prefers the record flag over the environment path", () => {
    const result = runCli({
      args: ["--record=flag.txt"],
      env: {
        ODW_LINT_REVIEW_EVIDENCE_PATH: "env.txt",
        ODW_LINT_REVIEW_SCRUTINEER: "available",
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.writes.map((write) => write.path)).toEqual(["/worktree/flag.txt"]);
  });

  it("does not record usage-error reports", () => {
    const result = runCli({ args: ["--record=report.txt", "--unknown"] });

    expect(result.exitCode).toBe(2);
    expect(result.writes).toEqual([]);
    expect(result.output.stderr).toContain("Review evidence: usage-error");
  });

  it("reports write failures on stderr without changing the review exit code", () => {
    const result = runCli({
      args: ["--record=report.txt"],
      env: { ODW_LINT_REVIEW_SCRUTINEER: "available" },
      writeArtefact: () => {
        throw new Error("disk full\nwith detail");
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.output.stdout).toContain("Review evidence: verified");
    expect(result.output.stderr).toBe(
      "review evidence recording failed: report.txt: disk full with detail\n",
    );
  });
});
