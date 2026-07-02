/**
 * @file Review-evidence classifier tests.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import {
  type ClassifyReviewEvidenceInput,
  classifyReviewEvidence,
  type GateExecution,
  type ReviewEvidenceResult,
  type ReviewGateId,
  type ReviewPath,
  type ReviewPathAvailability,
  type ReviewPathSelection,
  selectReviewPath,
} from "./review-evidence";

const REQUIRED_GATES = ["make all", "make markdownlint", "make nixie"] as const;
const SINGLE_REQUIRED_GATE = ["make all"] as const;

const allPassed = REQUIRED_GATES.map((gate) => ({
  gate,
  status: "passed",
})) satisfies readonly GateExecution[];

const gateExecutions = {
  passed: allPassed,
  failed: [
    { gate: "make all", status: "passed" },
    {
      gate: "make markdownlint",
      status: "failed",
      exitCode: 1,
      detail: "markdownlint reported one finding",
    },
    { gate: "make nixie", status: "passed" },
  ],
  unavailable: [
    { gate: "make all", status: "passed" },
    {
      gate: "make markdownlint",
      status: "unavailable",
      detail: "command execution is sandboxed",
    },
    { gate: "make nixie", status: "passed" },
  ],
} satisfies Record<string, readonly GateExecution[]>;

const availability = {
  primary: {
    scrutineer: "available",
    coderabbit: "available",
    "local-self-run": "available",
  },
  coderabbitFallback: {
    scrutineer: "quota-blocked",
    coderabbit: "available",
    "local-self-run": "available",
  },
  localDegraded: {
    scrutineer: "unavailable",
    coderabbit: "unavailable",
    "local-self-run": "available",
  },
} satisfies Record<string, Record<ReviewPath, ReviewPathAvailability>>;

/** Classify a complete default evidence set with focused overrides. */
const classify = (override: Partial<ClassifyReviewEvidenceInput> = {}): ReviewEvidenceResult => {
  return classifyReviewEvidence({
    executionEnabled: true,
    executions: allPassed,
    requiredGates: REQUIRED_GATES,
    pathAvailability: availability.primary,
    ...override,
  });
};

describe("selectReviewPath", () => {
  it("selects scrutineer as the non-fallback primary when available", () => {
    const selection = selectReviewPath(availability.primary);

    expect(selection).toMatchObject({
      selected: "scrutineer",
      isFallback: false,
      isDegraded: false,
    });
    expect(selection.reason).toMatchInlineSnapshot(`"scrutineer available"`);
  });

  it("selects coderabbit as an explicit fallback when scrutineer is quota-blocked", () => {
    const selection = selectReviewPath(availability.coderabbitFallback);

    expect(selection).toMatchObject({
      selected: "coderabbit",
      isFallback: true,
      isDegraded: false,
    });
    expect(selection.reason).toMatchInlineSnapshot(
      `"scrutineer quota-blocked; coderabbit available"`,
    );
  });

  it("selects local self-run as degraded evidence when independent reviewers are unavailable", () => {
    const selection = selectReviewPath(availability.localDegraded);

    expect(selection).toMatchObject({
      selected: "local-self-run",
      isFallback: true,
      isDegraded: true,
    });
    expect(selection.reason).toMatchInlineSnapshot(
      `"scrutineer unavailable; coderabbit unavailable; local-self-run available"`,
    );
  });
});

describe("classifyReviewEvidence", () => {
  const classificationCases = [
    ["verified primary", "verified", true, gateExecutions.passed, availability.primary],
    [
      "verified coderabbit fallback",
      "verified",
      true,
      gateExecutions.passed,
      availability.coderabbitFallback,
    ],
    ["failed gate", "failed", true, gateExecutions.failed, availability.primary],
    ["unavailable gate", "degraded", true, gateExecutions.unavailable, availability.primary],
    ["execution disabled", "degraded", false, gateExecutions.failed, availability.primary],
    ["local self-run", "degraded", true, gateExecutions.passed, availability.localDegraded],
  ] satisfies readonly (readonly [
    string,
    ReviewEvidenceResult["status"],
    boolean,
    readonly GateExecution[],
    Readonly<Record<ReviewPath, ReviewPathAvailability>>,
  ])[];

  it.each(
    classificationCases,
  )("classifies %s as %s", (_name, expectedStatus, executionEnabled, executions, pathAvailability) => {
    expect(
      classify({
        executionEnabled,
        executions,
        pathAvailability,
      }).status,
    ).toBe(expectedStatus);
  });

  it("reports failed gates when command execution is available and a gate fails", () => {
    expect(classify({ executions: gateExecutions.failed })).toEqual({
      status: "failed",
      executions: gateExecutions.failed,
      reviewPath: {
        selected: "scrutineer",
        reason: "scrutineer available",
        isFallback: false,
        isDegraded: false,
      },
      failedGates: ["make markdownlint"],
    });
  });

  it("reports degraded reasons before failed gates when trust evidence is missing", () => {
    const result = classify({
      executionEnabled: false,
      executions: gateExecutions.failed,
    });

    expect(result).toMatchObject({
      status: "degraded",
    });
    expect(result.status === "degraded" ? result.reasons : []).toMatchInlineSnapshot(`
      [
        "command execution unavailable; gates were not independently executed",
      ]
    `);
  });

  it("snapshots unavailable-gate degraded reasons", () => {
    const result = classify({
      executions: gateExecutions.unavailable,
    });

    expect(result).toMatchObject({ status: "degraded" });
    expect(result.status === "degraded" ? result.reasons : []).toMatchInlineSnapshot(`
      [
        "make markdownlint unavailable: command execution is sandboxed",
      ]
    `);
  });

  it("snapshots local-self-run degraded reasons", () => {
    const result = classify({
      pathAvailability: availability.localDegraded,
    });

    expect(result).toMatchObject({ status: "degraded" });
    expect(result.status === "degraded" ? result.reasons : []).toMatchInlineSnapshot(`
      [
        "no independent dual-review path available",
      ]
    `);
  });

  it("ignores unavailable evidence for gates that are not required", () => {
    expect(
      classify({
        requiredGates: SINGLE_REQUIRED_GATE,
        executions: [
          { gate: "make all", status: "passed" },
          {
            gate: "make markdownlint",
            status: "unavailable",
            detail: "not part of this focused evidence run",
          },
        ],
      }).status,
    ).toBe("verified");
  });

  it("ignores failed evidence for gates that are not required", () => {
    expect(
      classify({
        requiredGates: SINGLE_REQUIRED_GATE,
        executions: [
          { gate: "make all", status: "passed" },
          {
            gate: "make markdownlint",
            status: "failed",
            exitCode: 1,
            detail: "not part of this focused evidence run",
          },
        ],
      }).status,
    ).toBe("verified");
  });

  it("rejects an empty required-gate list as a usage error", () => {
    const result = classify({ requiredGates: [] });

    expect(result).toMatchObject({ status: "usage-error" });
    expect(result.status === "usage-error" ? result.message : "").toMatchInlineSnapshot(
      `"review evidence requires at least one gate"`,
    );
  });

  it("rejects missing required gate executions as a usage error", () => {
    const result = classify({
      requiredGates: REQUIRED_GATES,
      executions: [{ gate: "make all", status: "passed" }],
    });

    expect(result).toMatchObject({ status: "usage-error" });
    expect(result.status === "usage-error" ? result.message : "").toMatchInlineSnapshot(
      `"missing execution evidence for required gate: make markdownlint"`,
    );
  });

  it("rejects duplicate gate executions as a usage error", () => {
    const result = classify({
      executions: [
        { gate: "make all", status: "passed" },
        {
          gate: "make all",
          status: "failed",
          exitCode: 1,
          detail: "duplicate failure",
        },
      ],
    });

    expect(result).toMatchObject({ status: "usage-error" });
    expect(result.status === "usage-error" ? result.message : "").toMatchInlineSnapshot(
      `"duplicate execution evidence for gate: make all"`,
    );
  });

  it("keeps exported result and selection shapes type-checkable", () => {
    expectTypeOf<ReviewEvidenceResult["status"]>().toEqualTypeOf<
      "verified" | "failed" | "degraded" | "usage-error"
    >();
    expectTypeOf<ReviewPathSelection["selected"]>().toEqualTypeOf<ReviewPath>();
    expectTypeOf<ReviewGateId>().toEqualTypeOf<(typeof REQUIRED_GATES)[number]>();

    const usageErrorResult = {
      status: "usage-error",
      message: "bad input",
    } satisfies ReviewEvidenceResult;
    // @ts-expect-error usage-error results do not expose failed-gate details.
    usageErrorResult.failedGates;
  });
});
