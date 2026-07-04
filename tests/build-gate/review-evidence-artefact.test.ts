/**
 * @file Unit tests for recorded review-evidence artefact helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  classifyBoundEvidence,
  classifyRecordedEvidence,
  DEFAULT_EVIDENCE_ARTEFACT_PATH,
  parseRecordedStatus,
  type RecordedStatus,
  resolveEvidenceArtefactPath,
} from "./review-evidence-artefact";
import { formatProvenanceTrailer, type TreeProvenance } from "./review-evidence-provenance";

const currentProvenance = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  tree: "fedcba9876543210fedcba9876543210fedcba98",
} satisfies TreeProvenance;

const staleProvenance = {
  commit: "1111111111111111111111111111111111111111",
  tree: "2222222222222222222222222222222222222222",
} satisfies TreeProvenance;

const completeReports = {
  verified:
    "Review evidence: verified\n- gate make all: passed\n- dual-review path: scrutineer (primary; scrutineer available)\n",
  failed:
    "Review evidence: failed\n- gate make all: failed (exit 1; failed)\n- dual-review path: scrutineer (primary; scrutineer available)\n- failed gate: make all\n",
  degraded:
    "Review evidence: degraded\n- gate make all: passed\n- dual-review path: local-self-run (degraded fallback; reviewers unavailable)\n- degraded reason: local self-run selected\n",
} satisfies Readonly<Record<RecordedStatus, string>>;

const boundReports = {
  verified: `${completeReports.verified}${formatProvenanceTrailer(currentProvenance)}`,
  failed: `${completeReports.failed}${formatProvenanceTrailer(currentProvenance)}`,
  degraded: `${completeReports.degraded}${formatProvenanceTrailer(currentProvenance)}`,
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

describe("classifyBoundEvidence", () => {
  it("classifies current tree-bound evidence as present", () => {
    expect(
      classifyBoundEvidence({
        path: "evidence.txt",
        content: boundReports.verified,
        current: currentProvenance,
      }),
    ).toEqual({
      outcome: "present",
      path: "evidence.txt",
      status: "verified",
      provenance: currentProvenance,
    });
  });

  it("rejects complete reports without tree provenance", () => {
    expect(
      classifyBoundEvidence({
        path: "unbound.txt",
        content: completeReports.verified,
        current: currentProvenance,
      }),
    ).toEqual({
      outcome: "invalid",
      path: "unbound.txt",
      reason: "recorded evidence is not bound to a reviewed tree state",
    });
  });

  it("reports stale tree-bound evidence as mismatched", () => {
    expect(
      classifyBoundEvidence({
        path: "stale.txt",
        content: `${completeReports.verified}${formatProvenanceTrailer(staleProvenance)}`,
        current: currentProvenance,
      }),
    ).toEqual({
      outcome: "mismatched",
      path: "stale.txt",
      status: "verified",
      expected: staleProvenance,
      actual: currentProvenance,
    });
  });

  it("preserves missing and malformed classifications before provenance checks", () => {
    expect(
      classifyBoundEvidence({
        path: "missing.txt",
        content: undefined,
        current: currentProvenance,
      }),
    ).toEqual({ outcome: "missing", path: "missing.txt" });
    expect(
      classifyBoundEvidence({
        path: "bad.txt",
        content: "hello\n",
        current: currentProvenance,
      }),
    ).toEqual({
      outcome: "invalid",
      path: "bad.txt",
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
