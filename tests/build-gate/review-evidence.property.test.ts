/**
 * @file Property and exhaustiveness tests for review-evidence classification.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import * as fc from "fast-check";
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

describe("review evidence classifier properties", () => {
  it("keeps discriminated-union consumers exhaustive", () => {
    expect(consumeResult(classifyReviewEvidence(validInput()))).toBe("verified");
    expect(consumeGateExecution({ gate: "make all", status: "passed" })).toBe("passed");
  });

  it("never reports degraded or failed evidence as verified", () => {
    fc.assert(
      fc.property(inputFacts(), (input) => {
        const result = classifyReviewEvidence(input);
        const hasNonPassingRequiredGate = input.executions.some(
          (execution) =>
            input.requiredGates.includes(execution.gate) && execution.status !== "passed",
        );
        const reviewPath = selectReviewPath(input.pathAvailability);

        if (hasUnverifiedEvidence(input, hasNonPassingRequiredGate, reviewPath)) {
          expect(result.status).not.toBe("verified");
        } else {
          expect(result.status).toBe("verified");
        }
      }),
      { seed: 0x1506, numRuns: 150 },
    );
  });

  it("never selects an unavailable scrutineer as a non-fallback primary", () => {
    fc.assert(
      fc.property(pathAvailabilityFacts(), (pathAvailability) => {
        const selection = selectReviewPath(pathAvailability);

        if (pathAvailability.scrutineer !== "available") {
          expect(selection).not.toMatchObject({
            selected: "scrutineer",
            isFallback: false,
          });
        }
      }),
      { seed: 0x1507, numRuns: 80 },
    );
  });

  it("classifies disabled command execution as degraded for every generated input", () => {
    fc.assert(
      fc.property(inputFacts(), (input) => {
        const result = classifyReviewEvidence({
          ...input,
          executionEnabled: false,
          requiredGates: REQUIRED_GATES,
        });

        expect(result.status).toBe("degraded");
      }),
      { seed: 0x1508, numRuns: 150 },
    );
  });
});

/** Provide one complete valid input for type-oriented smoke checks. */
const validInput = (): ClassifyReviewEvidenceInput => {
  return {
    executionEnabled: true,
    executions: REQUIRED_GATES.map((gate) => ({ gate, status: "passed" })),
    requiredGates: REQUIRED_GATES,
    pathAvailability: {
      scrutineer: "available",
      coderabbit: "available",
      "local-self-run": "available",
    },
  };
};

/** Generate bounded gate-execution combinations for classifier properties. */
const executionFacts = (): fc.Arbitrary<readonly GateExecution[]> => {
  return fc.tuple(
    ...REQUIRED_GATES.map((gate) =>
      fc.constantFrom<GateExecution>(
        { gate, status: "passed" },
        { gate, status: "failed", exitCode: 1, detail: "forced failure" },
        { gate, status: "unavailable", detail: "forced unavailable" },
      ),
    ),
  );
};

/** Generate review-path availability combinations for classifier properties. */
const pathAvailabilityFacts = (): fc.Arbitrary<
  Readonly<Record<ReviewPath, ReviewPathAvailability>>
> => {
  return fc.record({
    scrutineer: fc.constantFrom("available", "quota-blocked", "unavailable", "no-output"),
    coderabbit: fc.constantFrom("available", "quota-blocked", "unavailable", "no-output"),
    "local-self-run": fc.constantFrom("available", "quota-blocked", "unavailable", "no-output"),
  });
};

/** Generate complete classifier inputs with valid required-gate coverage. */
const inputFacts = (): fc.Arbitrary<ClassifyReviewEvidenceInput> => {
  return fc.record({
    executionEnabled: fc.boolean(),
    executions: executionFacts(),
    requiredGates: fc.constantFrom(REQUIRED_GATES, SINGLE_REQUIRED_GATE),
    pathAvailability: pathAvailabilityFacts(),
  });
};

/** Decide whether generated evidence must not be classified as verified. */
const hasUnverifiedEvidence = (
  input: ClassifyReviewEvidenceInput,
  hasNonPassingRequiredGate: boolean,
  reviewPath: ReviewPathSelection,
): boolean => {
  if (!input.executionEnabled) {
    return true;
  }

  if (hasNonPassingRequiredGate) {
    return true;
  }

  return reviewPath.isDegraded;
};

/** Consume result variants through an exhaustive status switch. */
const consumeResult = (result: ReviewEvidenceResult): ReviewEvidenceResult["status"] => {
  switch (result.status) {
    case "verified":
      expectTypeOf(result.executions).toEqualTypeOf<readonly GateExecution[]>();
      return result.status;
    case "failed":
      expectTypeOf(result.failedGates).toEqualTypeOf<readonly ReviewGateId[]>();
      return result.status;
    case "degraded":
      expectTypeOf(result.reasons).toEqualTypeOf<readonly string[]>();
      return result.status;
    case "usage-error":
      expectTypeOf(result.message).toEqualTypeOf<string>();
      return result.status;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
};

/** Consume gate-execution variants through an exhaustive status switch. */
const consumeGateExecution = (execution: GateExecution): GateExecution["status"] => {
  switch (execution.status) {
    case "passed":
      return execution.status;
    case "failed":
      expectTypeOf(execution.exitCode).toEqualTypeOf<number>();
      return execution.status;
    case "unavailable":
      expectTypeOf(execution.detail).toEqualTypeOf<string>();
      return execution.status;
    default: {
      const exhaustive: never = execution;
      return exhaustive;
    }
  }
};
