/**
 * @file Unit tests for recorded review-evidence artefact helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  classifyRecordedEvidence,
  DEFAULT_EVIDENCE_ARTEFACT_PATH,
  parseRecordedStatus,
  type RecordedStatus,
  resolveEvidenceArtefactPath,
} from "./review-evidence-artefact";

const completeReports = {
  verified:
    "Review evidence: verified\n- gate make all: passed\n- dual-review path: scrutineer (primary; scrutineer available)\n",
  failed:
    "Review evidence: failed\n- gate make all: failed (exit 1; failed)\n- dual-review path: scrutineer (primary; scrutineer available)\n- failed gate: make all\n",
  degraded:
    "Review evidence: degraded\n- gate make all: passed\n- dual-review path: local-self-run (degraded fallback; reviewers unavailable)\n- degraded reason: local self-run selected\n",
} satisfies Readonly<Record<RecordedStatus, string>>;

describe("parseRecordedStatus", () => {
  it.each([
    "verified",
    "failed",
    "degraded",
  ] satisfies readonly RecordedStatus[])("accepts recorded %s review evidence", (status) => {
    expect(parseRecordedStatus(`Review evidence: ${status}\n- gate make all: passed\n`)).toBe(
      status,
    );
  });

  it("rejects missing prefixes and non-terminal statuses", () => {
    expect(parseRecordedStatus("not a review report\n")).toBeUndefined();
    expect(parseRecordedStatus("Review evidence: usage-error\n")).toBeUndefined();
    expect(parseRecordedStatus("Review evidence: unknown\n")).toBeUndefined();
  });
});

describe("classifyRecordedEvidence", () => {
  it.each([
    "verified",
    "failed",
    "degraded",
  ] satisfies readonly RecordedStatus[])("classifies recorded %s evidence as present", (status) => {
    expect(
      classifyRecordedEvidence({
        path: "evidence.txt",
        content: completeReports[status],
      }),
    ).toEqual({ outcome: "present", path: "evidence.txt", status });
  });

  it("classifies absent evidence as missing", () => {
    expect(classifyRecordedEvidence({ path: "missing.txt", content: undefined })).toEqual({
      outcome: "missing",
      path: "missing.txt",
    });
  });

  it("rejects empty recorded evidence", () => {
    expect(classifyRecordedEvidence({ path: "empty.txt", content: " \n\t" })).toEqual({
      outcome: "invalid",
      path: "empty.txt",
      reason: "recorded evidence file is empty",
    });
  });

  it("rejects non-report content", () => {
    expect(classifyRecordedEvidence({ path: "bad.txt", content: "hello\n" })).toEqual({
      outcome: "invalid",
      path: "bad.txt",
      reason: "recorded evidence is not a completed review report",
    });
  });

  it("rejects a recorded usage-error report", () => {
    expect(
      classifyRecordedEvidence({
        path: "usage-error.txt",
        content: "Review evidence: usage-error\n- usage error: bad option\n",
      }),
    ).toEqual({
      outcome: "invalid",
      path: "usage-error.txt",
      reason: "recorded evidence is not a completed review report",
    });
  });

  it.each([
    ["header only", "Review evidence: verified\n"],
    ["missing review path", "Review evidence: verified\n- gate make all: passed\n"],
    [
      "failed report missing failed gate",
      "Review evidence: failed\n- gate make all: failed (exit 1; failed)\n- dual-review path: scrutineer (primary; scrutineer available)\n",
    ],
    [
      "degraded report missing degraded reason",
      "Review evidence: degraded\n- gate make all: passed\n- dual-review path: local-self-run (degraded fallback; reviewers unavailable)\n",
    ],
  ])("rejects a structurally incomplete report: %s", (_name, content) => {
    expect(classifyRecordedEvidence({ path: "partial.txt", content })).toEqual({
      outcome: "invalid",
      path: "partial.txt",
      reason: "recorded evidence is not a completed review report",
    });
  });
});

describe("resolveEvidenceArtefactPath", () => {
  it("prefers an explicit flag path over the environment and default", () => {
    expect(
      resolveEvidenceArtefactPath({
        flagValue: "from-flag.txt",
        env: { ODW_LINT_REVIEW_EVIDENCE_PATH: "from-env.txt" },
      }),
    ).toBe("from-flag.txt");
  });

  it("uses the environment path when no flag is provided", () => {
    expect(
      resolveEvidenceArtefactPath({
        env: { ODW_LINT_REVIEW_EVIDENCE_PATH: "from-env.txt" },
      }),
    ).toBe("from-env.txt");
  });

  it("falls back to the default artefact path", () => {
    expect(resolveEvidenceArtefactPath({ env: {} })).toBe(DEFAULT_EVIDENCE_ARTEFACT_PATH);
  });

  it("treats blank flag and environment paths as absent", () => {
    expect(
      resolveEvidenceArtefactPath({
        flagValue: " from-flag.txt ",
        env: { ODW_LINT_REVIEW_EVIDENCE_PATH: "from-env.txt" },
      }),
    ).toBe("from-flag.txt");
    expect(
      resolveEvidenceArtefactPath({
        flagValue: "",
        env: { ODW_LINT_REVIEW_EVIDENCE_PATH: " from-env.txt " },
      }),
    ).toBe("from-env.txt");
    expect(
      resolveEvidenceArtefactPath({
        flagValue: " \t",
        env: { ODW_LINT_REVIEW_EVIDENCE_PATH: "\n" },
      }),
    ).toBe(DEFAULT_EVIDENCE_ARTEFACT_PATH);
  });
});
