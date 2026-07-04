/**
 * @file CLI tests for recorded review-evidence artefacts.
 */

import { describe, expect, it } from "bun:test";
import { createCapturedCliOutput } from "./git-support";
import { runReviewEvidenceArtefactCli } from "./review-evidence-artefact-cli";
import {
  formatProvenanceTrailer,
  type ReadTreeProvenanceResult,
  type TreeProvenance,
} from "./review-evidence-provenance";

const currentProvenance = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  tree: "fedcba9876543210fedcba9876543210fedcba98",
} satisfies TreeProvenance;

const staleProvenance = {
  commit: "1111111111111111111111111111111111111111",
  tree: "2222222222222222222222222222222222222222",
} satisfies TreeProvenance;

const completeVerifiedReport =
  "Review evidence: verified\n- gate make all: passed\n- dual-review path: scrutineer (primary; scrutineer available)\n";
const completeFailedReport =
  "Review evidence: failed\n- gate make all: failed (exit 1; failed)\n- dual-review path: scrutineer (primary; scrutineer available)\n- failed gate: make all\n";
const completeDegradedReport =
  "Review evidence: degraded\n- gate make all: passed\n- dual-review path: local-self-run (degraded fallback; reviewers unavailable)\n- degraded reason: local self-run selected\n";

/** Run the artefact CLI with captured writers and an injected file reader. */
const runCli = (
  options: {
    readonly args?: readonly string[];
    readonly content?: string | undefined;
    readonly readError?: Error;
    readonly env?: NodeJS.ProcessEnv;
    readonly cwd?: string;
    readonly readProvenance?: (cwd: string) => ReadTreeProvenanceResult;
  } = {},
) => {
  const output = createCapturedCliOutput();
  const readPaths: string[] = [];
  const exitCode = runReviewEvidenceArtefactCli(options.args ?? [], {
    readFile: (path) => {
      readPaths.push(path);
      if (options.readError !== undefined) {
        throw options.readError;
      }
      return options.content;
    },
    writeOut: output.writeOut,
    writeErr: output.writeErr,
    env: options.env ?? {},
    cwd: options.cwd ?? "/repo",
    readProvenance:
      options.readProvenance ??
      (() => ({
        ok: true,
        provenance: currentProvenance,
      })),
  });

  return { exitCode, output, readPaths };
};

describe("runReviewEvidenceArtefactCli", () => {
  it("returns present evidence on stdout with exit 0", () => {
    const result = runCli({
      content: `${completeVerifiedReport}${formatProvenanceTrailer(currentProvenance)}`,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output.stderr).toBe("");
    expect(result.output.stdout).toContain("Review evidence artefact: present");
    expect(result.output.stdout).toContain("- recorded status: verified");
    expect(result.readPaths).toEqual(["/repo/.review-evidence/report.txt"]);
  });

  it("returns missing evidence on stderr with exit 1", () => {
    const result = runCli({ content: undefined });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toBe("");
    expect(result.output.stderr).toBe(
      "Review evidence artefact: missing\n- artefact path: .review-evidence/report.txt\n",
    );
  });

  it("returns invalid evidence on stderr with exit 1", () => {
    const result = runCli({ content: "not a report\n" });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toBe("");
    expect(result.output.stderr).toContain("Review evidence artefact: invalid");
    expect(result.output.stderr).toContain(
      "- reason: recorded evidence is not a completed review report",
    );
  });

  it("returns unbound evidence on stderr with exit 1", () => {
    const result = runCli({ content: completeVerifiedReport });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toBe("");
    expect(result.output.stderr).toContain("Review evidence artefact: invalid");
    expect(result.output.stderr).toContain(
      "- reason: recorded evidence is not bound to a reviewed tree state",
    );
  });

  it("returns stale evidence on stderr with exit 1", () => {
    const result = runCli({
      content: `${completeVerifiedReport}${formatProvenanceTrailer(staleProvenance)}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toBe("");
    expect(result.output.stderr).toContain("Review evidence artefact: mismatched");
    expect(result.output.stderr).toContain(`- recorded tree: ${staleProvenance.tree}`);
    expect(result.output.stderr).toContain(`- current tree: ${currentProvenance.tree}`);
  });

  it("returns usage errors on stderr with exit 2", () => {
    const result = runCli({ args: ["--bad"] });

    expect(result.exitCode).toBe(2);
    expect(result.output.stdout).toBe("");
    expect(result.output.stderr).toBe(
      "Review evidence artefact: usage-error\n- usage error: unknown option: --bad\n",
    );
    expect(result.readPaths).toEqual([]);
  });

  it("resolves explicit and environment evidence paths", () => {
    expect(
      runCli({
        args: ["--evidence-path=flag-report.txt"],
        env: { ODW_LINT_REVIEW_EVIDENCE_PATH: "env-report.txt" },
        content: `${completeFailedReport}${formatProvenanceTrailer(currentProvenance)}`,
      }).readPaths,
    ).toEqual(["/repo/flag-report.txt"]);
    expect(
      runCli({
        env: { ODW_LINT_REVIEW_EVIDENCE_PATH: "env-report.txt" },
        content: `${completeDegradedReport}${formatProvenanceTrailer(currentProvenance)}`,
      }).readPaths,
    ).toEqual(["/repo/env-report.txt"]);
  });

  it("returns unreadable evidence as invalid with exit 1", () => {
    const result = runCli({ readError: new Error("permission denied") });

    expect(result.exitCode).toBe(1);
    expect(result.output.stdout).toBe("");
    expect(result.output.stderr).toContain("Review evidence artefact: invalid");
    expect(result.output.stderr).toContain(
      "- reason: could not read recorded evidence file: permission denied",
    );
  });

  it("returns current provenance read failures as usage errors", () => {
    const result = runCli({
      content: `${completeVerifiedReport}${formatProvenanceTrailer(currentProvenance)}`,
      readProvenance: () => ({ ok: false, message: "git rev-parse HEAD failed" }),
    });

    expect(result.exitCode).toBe(2);
    expect(result.output.stdout).toBe("");
    expect(result.readPaths).toEqual([]);
    expect(result.output.stderr).toBe(
      "Review evidence artefact: usage-error\n- usage error: could not determine current reviewed tree state: git rev-parse HEAD failed\n",
    );
  });
});
