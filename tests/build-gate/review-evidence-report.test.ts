/**
 * @file Reviewer-facing report tests for review evidence.
 */

import { describe, expect, it } from "bun:test";
import type { GateExecution, ReviewEvidenceResult, ReviewPathSelection } from "./review-evidence";
import { formatReviewEvidenceResult } from "./review-evidence-report";

const passedExecutions = [
  { gate: "make all", status: "passed" },
  { gate: "make markdownlint", status: "passed" },
  { gate: "make nixie", status: "passed" },
] satisfies readonly GateExecution[];

describe("formatReviewEvidenceResult", () => {
  it("keeps report input variants type-checkable", () => {
    const invalidResult = { status: "unexpected-result" } as const;
    // @ts-expect-error formatReviewEvidenceResult rejects unknown result variants.
    invalidResult satisfies ReviewEvidenceResult;

    const invalidExecution = {
      gate: "make all",
      status: "unexpected-gate",
    } as const;
    // @ts-expect-error GateExecution rejects unknown gate execution variants.
    invalidExecution satisfies GateExecution;

    const invalidReviewPath = {
      selected: "scrutineer",
      reason: "local runs are degraded",
      isFallback: false,
      isDegraded: true,
    } as const;
    // @ts-expect-error ReviewPathSelection rejects impossible fallback flags.
    invalidReviewPath satisfies ReviewPathSelection;
  });

  it("throws with the unexpected result payload when malformed data bypasses types", () => {
    const malformedResult = { status: "unexpected-result" } as unknown as ReviewEvidenceResult;

    expect(() => formatReviewEvidenceResult(malformedResult)).toThrow(
      'unhandled review evidence variant: {"status":"unexpected-result"}',
    );
  });

  it("formats verified evidence with every gate and the primary review path", () => {
    const report = formatReviewEvidenceResult({
      status: "verified",
      executions: passedExecutions,
      reviewPath: {
        selected: "scrutineer",
        reason: "scrutineer available",
        isFallback: false,
        isDegraded: false,
      },
    });

    expect(report).toContain("Review evidence: verified");
    expect(report).toContain("dual-review path: scrutineer (primary");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence: verified
      - gate make all: passed
      - gate make markdownlint: passed
      - gate make nixie: passed
      - dual-review path: scrutineer (primary; scrutineer available)
      "
    `);
  });

  it("formats failed evidence with failed-gate details", () => {
    const report = formatReviewEvidenceResult({
      status: "failed",
      executions: [
        { gate: "make all", status: "passed" },
        {
          gate: "make markdownlint",
          status: "failed",
          exitCode: 1,
          detail: "markdownlint reported one finding",
        },
        {
          gate: "make nixie",
          status: "failed",
          exitCode: 2,
          detail: "diagram validation failed",
        },
      ],
      reviewPath: {
        selected: "scrutineer",
        reason: "scrutineer available",
        isFallback: false,
        isDegraded: false,
      },
      failedGates: ["make markdownlint", "make nixie"],
    });

    expect(report).toContain("failed gate: make markdownlint");
    expect(report).toContain("failed gate: make nixie");
    expect(report).toContain("gate make markdownlint: failed (exit 1");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence: failed
      - gate make all: passed
      - gate make markdownlint: failed (exit 1; markdownlint reported one finding)
      - gate make nixie: failed (exit 2; diagram validation failed)
      - dual-review path: scrutineer (primary; scrutineer available)
      - failed gate: make markdownlint
      - failed gate: make nixie
      "
    `);
  });

  it("formats degraded execution evidence with explicit reasons", () => {
    const report = formatReviewEvidenceResult({
      status: "degraded",
      executions: passedExecutions,
      reviewPath: {
        selected: "scrutineer",
        reason: "scrutineer available",
        isFallback: false,
        isDegraded: false,
      },
      reasons: [
        "command execution unavailable; gates were not independently executed",
        "reviewer sandbox disabled subprocesses",
      ],
    });

    expect(report).toContain("degraded reason: command execution unavailable");
    expect(report).toContain("dual-review path: scrutineer (primary");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence: degraded
      - gate make all: passed
      - gate make markdownlint: passed
      - gate make nixie: passed
      - dual-review path: scrutineer (primary; scrutineer available)
      - degraded reason: command execution unavailable; gates were not independently executed
      - degraded reason: reviewer sandbox disabled subprocesses
      "
    `);
  });

  it("formats unavailable gate evidence with stable detail text", () => {
    const report = formatReviewEvidenceResult({
      status: "degraded",
      executions: [
        { gate: "make all", status: "passed" },
        {
          gate: "make markdownlint",
          status: "unavailable",
          detail: "command execution is sandboxed",
        },
        { gate: "make nixie", status: "passed" },
      ],
      reviewPath: {
        selected: "scrutineer",
        reason: "scrutineer available",
        isFallback: false,
        isDegraded: false,
      },
      reasons: ["make markdownlint unavailable: command execution is sandboxed"],
    });

    expect(report).toContain(
      "gate make markdownlint: unavailable (command execution is sandboxed)",
    );
    expect(report).toMatchInlineSnapshot(`
      "Review evidence: degraded
      - gate make all: passed
      - gate make markdownlint: unavailable (command execution is sandboxed)
      - gate make nixie: passed
      - dual-review path: scrutineer (primary; scrutineer available)
      - degraded reason: make markdownlint unavailable: command execution is sandboxed
      "
    `);
  });

  it("formats coderabbit fallback evidence without hiding substitution", () => {
    const report = formatReviewEvidenceResult({
      status: "verified",
      executions: passedExecutions,
      reviewPath: {
        selected: "coderabbit",
        reason: "scrutineer quota-blocked; coderabbit available",
        isFallback: true,
        isDegraded: false,
      },
    });

    expect(report).toContain("dual-review path: coderabbit (fallback");
    expect(report).toContain("scrutineer quota-blocked");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence: verified
      - gate make all: passed
      - gate make markdownlint: passed
      - gate make nixie: passed
      - dual-review path: coderabbit (fallback; scrutineer quota-blocked; coderabbit available)
      "
    `);
  });

  it("formats local self-run as degraded evidence", () => {
    const report = formatReviewEvidenceResult({
      status: "degraded",
      executions: passedExecutions,
      reviewPath: {
        selected: "local-self-run",
        reason: "scrutineer unavailable; coderabbit unavailable; local-self-run available",
        isFallback: true,
        isDegraded: true,
      },
      reasons: ["no independent dual-review path available"],
    });

    expect(report).toContain("dual-review path: local-self-run (degraded fallback");
    expect(report).toContain("no independent dual-review path available");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence: degraded
      - gate make all: passed
      - gate make markdownlint: passed
      - gate make nixie: passed
      - dual-review path: local-self-run (degraded fallback; scrutineer unavailable; coderabbit unavailable; local-self-run available)
      - degraded reason: no independent dual-review path available
      "
    `);
  });

  it("formats usage errors without synthetic gate evidence", () => {
    const report = formatReviewEvidenceResult({
      status: "usage-error",
      message: "review evidence requires at least one gate",
    });

    expect(report).toContain("Review evidence: usage-error");
    expect(report).not.toContain("dual-review path");
    expect(report).toMatchInlineSnapshot(`
      "Review evidence: usage-error
      - usage error: review evidence requires at least one gate
      "
    `);
  });

  it("normalizes caller-owned text to preserve one fact per report line", () => {
    const report = formatReviewEvidenceResult({
      status: "failed",
      executions: [
        { gate: "make all", status: "passed" },
        {
          gate: "make markdownlint",
          status: "failed",
          exitCode: 1,
          detail: "first line\nsecond line",
        },
      ],
      reviewPath: {
        selected: "coderabbit",
        reason: "scrutineer quota-blocked\ncoderabbit available",
        isFallback: true,
        isDegraded: false,
      },
      failedGates: ["make markdownlint"],
    });

    const lines = report.trimEnd().split("\n");

    expect(
      lines.every((line) => line.startsWith("Review evidence:") || line.startsWith("- ")),
    ).toBe(true);
    expect(report).toContain("first line second line");
    expect(report).toContain("scrutineer quota-blocked coderabbit available");
  });

  it("normalizes multiline degraded reasons to preserve report lines", () => {
    const report = formatReviewEvidenceResult({
      status: "degraded",
      executions: passedExecutions,
      reviewPath: {
        selected: "local-self-run",
        reason: "scrutineer unavailable; coderabbit unavailable",
        isFallback: true,
        isDegraded: true,
      },
      reasons: ["first reason\nsecond reason"],
    });

    const lines = report.trimEnd().split("\n");

    expect(
      lines.every((line) => line.startsWith("Review evidence:") || line.startsWith("- ")),
    ).toBe(true);
    expect(report).toContain("degraded reason: first reason second reason");
  });
});
