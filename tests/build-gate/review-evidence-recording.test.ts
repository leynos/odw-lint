/**
 * @file Unit tests for pure review-evidence recording helpers.
 */

import { describe, expect, it } from "bun:test";
import { createCapturedCliOutput } from "./git-support";
import type { ReviewEvidenceResult } from "./review-evidence";
import type { TreeProvenance } from "./review-evidence-provenance";
import { maybeRecordReviewEvidence, recordedReportContent } from "./review-evidence-recording";

const provenance = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  tree: "fedcba9876543210fedcba9876543210fedcba98",
} satisfies TreeProvenance;

const verifiedResult = {
  status: "verified",
  executions: [{ gate: "make all", status: "passed" }],
  reviewPath: {
    selected: "scrutineer",
    reason: "scrutineer available",
    isFallback: false,
    isDegraded: false,
  },
} satisfies ReviewEvidenceResult;

const failedResult = {
  status: "failed",
  executions: [{ gate: "make all", status: "failed", exitCode: 1, detail: "tests failed" }],
  reviewPath: verifiedResult.reviewPath,
  failedGates: ["make all"],
} satisfies ReviewEvidenceResult;

const degradedResult = {
  status: "degraded",
  executions: [{ gate: "make all", status: "passed" }],
  reviewPath: verifiedResult.reviewPath,
  reasons: ["no independent dual-review path available"],
} satisfies ReviewEvidenceResult;

type ArtefactWrite = {
  readonly path: string;
  readonly content: string;
};

describe("recordedReportContent", () => {
  it("returns report content with a provenance trailer when provenance is available", () => {
    let observedWorkingDirectory: string | undefined;

    const result = recordedReportContent({
      report: "Review evidence: verified\n",
      readProvenance: (workingDirectory) => {
        observedWorkingDirectory = workingDirectory;
        return { ok: true, provenance };
      },
      workingDirectory: "/worktree",
    });

    expect(observedWorkingDirectory).toBe("/worktree");
    expect(result.provenance).toBe("available");
    expect(result.content).toMatchInlineSnapshot(`
      "Review evidence: verified
      - reviewed commit: 0123456789abcdef0123456789abcdef01234567
      - reviewed tree: fedcba9876543210fedcba9876543210fedcba98
      "
    `);
  });

  it("returns unbound content plus the provenance error without writing diagnostics", () => {
    let observedWorkingDirectory: string | undefined;

    const result = recordedReportContent({
      report: "Review evidence: verified\n",
      readProvenance: (workingDirectory) => {
        observedWorkingDirectory = workingDirectory;
        return { ok: false, message: "git rev-parse HEAD failed" };
      },
      workingDirectory: "/worktree",
    });

    expect(observedWorkingDirectory).toBe("/worktree");
    expect(result.provenance).toBe("unavailable");
    expect(result).toMatchObject({ message: "git rev-parse HEAD failed" });
    expect(result.content).toMatchInlineSnapshot(`
      "Review evidence: verified
      "
    `);
  });
});

describe("maybeRecordReviewEvidence", () => {
  it("leaves outputs untouched when recording is disabled", () => {
    const output = createCapturedCliOutput();
    const writes: ArtefactWrite[] = [];

    maybeRecordReviewEvidence({
      options: {
        readProvenance: () => ({ ok: true, provenance }),
        shouldRecord: false,
        writeArtefact: (path, content) => {
          writes.push({ path, content });
        },
      },
      report: "Review evidence: verified\n",
      result: verifiedResult,
      writers: output,
    });

    expect(output.stdout).toBe("");
    expect(output.stderr).toBe("");
    expect(writes).toEqual([]);
  });

  it("does not record usage-error results even when recording is enabled", () => {
    const output = createCapturedCliOutput();
    const writes: ArtefactWrite[] = [];

    maybeRecordReviewEvidence({
      options: {
        readProvenance: () => ({ ok: true, provenance }),
        shouldRecord: true,
        writeArtefact: (path, content) => {
          writes.push({ path, content });
        },
      },
      report: "Review evidence: usage-error\n",
      result: { status: "usage-error", message: "bad option" },
      writers: output,
    });

    expect(output.stdout).toBe("");
    expect(output.stderr).toBe("");
    expect(writes).toEqual([]);
  });

  it("writes tree-bound evidence to the resolved artefact path", () => {
    const output = createCapturedCliOutput();
    const writes: ArtefactWrite[] = [];

    maybeRecordReviewEvidence({
      options: {
        cwd: "/worktree",
        readProvenance: () => ({ ok: true, provenance }),
        recordPath: "reports/review.txt",
        shouldRecord: true,
        writeArtefact: (path, content) => {
          writes.push({ path, content });
        },
      },
      report: "Review evidence: verified\n",
      result: verifiedResult,
      writers: output,
    });

    expect(output.stderr).toBe("");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.path).toBe("/worktree/reports/review.txt");
    expect(writes[0]?.content).toMatchInlineSnapshot(`
      "Review evidence: verified
      - reviewed commit: 0123456789abcdef0123456789abcdef01234567
      - reviewed tree: fedcba9876543210fedcba9876543210fedcba98
      "
    `);
  });

  it.each([
    ["failed", failedResult, "Review evidence: failed\n"],
    ["degraded", degradedResult, "Review evidence: degraded\n"],
  ] satisfies readonly [
    string,
    ReviewEvidenceResult,
    string,
  ][])("records %s results when recording is enabled", (_status, result, report) => {
    const output = createCapturedCliOutput();
    const writes: ArtefactWrite[] = [];

    maybeRecordReviewEvidence({
      options: {
        cwd: "/worktree",
        readProvenance: () => ({ ok: true, provenance }),
        recordPath: "report.txt",
        shouldRecord: true,
        writeArtefact: (path, content) => {
          writes.push({ path, content });
        },
      },
      report,
      result,
      writers: output,
    });

    expect(output.stderr).toBe("");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.path).toBe("/worktree/report.txt");
    expect(writes[0]?.content).toContain(
      "- reviewed tree: fedcba9876543210fedcba9876543210fedcba98\n",
    );
  });

  it("records unbound evidence and reports provenance failures at the recording boundary", () => {
    const output = createCapturedCliOutput();
    const writes: ArtefactWrite[] = [];

    maybeRecordReviewEvidence({
      options: {
        cwd: "/worktree",
        readProvenance: () => ({ ok: false, message: "git rev-parse HEAD failed" }),
        recordPath: "report.txt",
        shouldRecord: true,
        writeArtefact: (path, content) => {
          writes.push({ path, content });
        },
      },
      report: "Review evidence: verified\n",
      result: verifiedResult,
      writers: output,
    });

    expect(output.stderr).toBe(
      "review evidence provenance unavailable: git rev-parse HEAD failed\n",
    );
    expect(writes).toEqual([
      {
        path: "/worktree/report.txt",
        content: "Review evidence: verified\n",
      },
    ]);
  });

  it("reports write failures without changing the recording decision", () => {
    const output = createCapturedCliOutput();

    maybeRecordReviewEvidence({
      options: {
        cwd: "/worktree",
        readProvenance: () => ({ ok: true, provenance }),
        recordPath: "report.txt",
        shouldRecord: true,
        writeArtefact: () => {
          throw new Error("disk full\ntry later");
        },
      },
      report: "Review evidence: verified\n",
      result: verifiedResult,
      writers: output,
    });

    expect(output.stderr).toBe(
      "review evidence recording failed: report.txt: disk full try later\n",
    );
  });

  it("normalizes non-error write failures", () => {
    const output = createCapturedCliOutput();

    maybeRecordReviewEvidence({
      options: {
        cwd: "/worktree",
        readProvenance: () => ({ ok: true, provenance }),
        recordPath: "report.txt",
        shouldRecord: true,
        writeArtefact: () => {
          throw "permission denied";
        },
      },
      report: "Review evidence: verified\n",
      result: verifiedResult,
      writers: output,
    });

    expect(output.stderr).toBe("review evidence recording failed: report.txt: permission denied\n");
  });
});
