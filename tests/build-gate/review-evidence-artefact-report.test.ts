/**
 * @file Reviewer-facing report tests for recorded review-evidence artefacts.
 */

import { describe, expect, it } from "bun:test";
import type { RecordedEvidenceResult } from "./review-evidence-artefact";
import { formatRecordedEvidenceResult } from "./review-evidence-artefact-report";

describe("formatRecordedEvidenceResult", () => {
  it("keeps report input variants type-checkable", () => {
    const invalidResult = { outcome: "unexpected-result" } as const;
    // @ts-expect-error formatRecordedEvidenceResult rejects unknown result variants.
    invalidResult satisfies RecordedEvidenceResult;
  });

  it("throws with the unexpected result payload when malformed data bypasses types", () => {
    const malformedResult = {
      outcome: "unexpected-result",
    } as unknown as RecordedEvidenceResult;

    expect(() => formatRecordedEvidenceResult(malformedResult)).toThrow(
      "unhandled recorded evidence artefact variant",
    );
    expect(() => formatRecordedEvidenceResult(malformedResult)).toThrow(
      '"outcome":"unexpected-result"',
    );
  });

  it("formats present evidence with recorded status and path", () => {
    const report = formatRecordedEvidenceResult({
      outcome: "present",
      path: ".review-evidence/report.txt",
      status: "verified",
    });

    expect(report).toContain("Review evidence artefact: present");
    expect(report).toContain("- recorded status: verified");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence artefact: present
      - recorded status: verified
      - artefact path: .review-evidence/report.txt
      "
    `);
  });

  it("formats missing evidence with the inspected path", () => {
    const report = formatRecordedEvidenceResult({
      outcome: "missing",
      path: ".review-evidence/report.txt",
    });

    expect(report).toContain("Review evidence artefact: missing");
    expect(report).toContain("- artefact path: .review-evidence/report.txt");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence artefact: missing
      - artefact path: .review-evidence/report.txt
      "
    `);
  });

  it("formats invalid evidence with a single-line reason", () => {
    const report = formatRecordedEvidenceResult({
      outcome: "invalid",
      path: "report.txt",
      reason: "first line\nsecond line",
    });

    expect(report).toContain("Review evidence artefact: invalid");
    expect(report).toContain("- reason: first line second line");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence artefact: invalid
      - artefact path: report.txt
      - reason: first line second line
      "
    `);
  });

  it("formats mismatched evidence with both tree states", () => {
    const report = formatRecordedEvidenceResult({
      outcome: "mismatched",
      path: "report.txt",
      status: "verified",
      expected: {
        commit: "1111111111111111111111111111111111111111",
        tree: "2222222222222222222222222222222222222222",
      },
      actual: {
        commit: "0123456789abcdef0123456789abcdef01234567",
        tree: "fedcba9876543210fedcba9876543210fedcba98",
      },
    });

    expect(report).toMatchInlineSnapshot(`
      "Review evidence artefact: mismatched
      - recorded status: verified
      - artefact path: report.txt
      - recorded commit: 1111111111111111111111111111111111111111
      - recorded tree: 2222222222222222222222222222222222222222
      - current commit: 0123456789abcdef0123456789abcdef01234567
      - current tree: fedcba9876543210fedcba9876543210fedcba98
      "
    `);
  });

  it("formats usage errors without an artefact path", () => {
    const report = formatRecordedEvidenceResult({
      outcome: "usage-error",
      message: "unknown option:\n--bad",
    });

    expect(report).toMatchInlineSnapshot(`
      "Review evidence artefact: usage-error
      - usage error: unknown option: --bad
      "
    `);
  });
});
