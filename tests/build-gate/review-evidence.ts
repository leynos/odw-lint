/**
 * @file Pure review-evidence classification for roadmap audit gates.
 */

export type ReviewGateId = "make all" | "make markdownlint" | "make nixie";

export type GateExecution =
  | { readonly gate: ReviewGateId; readonly status: "passed" }
  | {
      readonly gate: ReviewGateId;
      readonly status: "failed";
      readonly exitCode: number;
      readonly detail: string;
    }
  | { readonly gate: ReviewGateId; readonly status: "unavailable"; readonly detail: string };

export type ReviewPath = "scrutineer" | "coderabbit" | "local-self-run";
export type ReviewPathAvailability = "available" | "quota-blocked" | "unavailable";

export type ReviewPathSelection =
  | {
      readonly selected: "scrutineer";
      readonly reason: string;
      readonly isFallback: false;
      readonly isDegraded: false;
    }
  | {
      readonly selected: "coderabbit";
      readonly reason: string;
      readonly isFallback: true;
      readonly isDegraded: false;
    }
  | {
      readonly selected: "local-self-run";
      readonly reason: string;
      readonly isFallback: true;
      readonly isDegraded: true;
    };

export type ReviewEvidenceResult =
  | {
      readonly status: "verified";
      readonly executions: readonly GateExecution[];
      readonly reviewPath: ReviewPathSelection;
    }
  | {
      readonly status: "failed";
      readonly executions: readonly GateExecution[];
      readonly reviewPath: ReviewPathSelection;
      readonly failedGates: readonly ReviewGateId[];
    }
  | {
      readonly status: "degraded";
      readonly executions: readonly GateExecution[];
      readonly reviewPath: ReviewPathSelection;
      readonly reasons: readonly string[];
    }
  | { readonly status: "usage-error"; readonly message: string };

export type ClassifyReviewEvidenceInput = {
  readonly executionEnabled: boolean;
  readonly executions: readonly GateExecution[];
  readonly requiredGates: readonly ReviewGateId[];
  readonly pathAvailability: Readonly<Record<ReviewPath, ReviewPathAvailability>>;
};

/**
 * Select the strongest available review path, naming fallback and degradation.
 *
 * @param pathAvailability Availability reported for each review path.
 * @returns The selected review path and reviewer-facing rationale.
 */
export function selectReviewPath(
  pathAvailability: Readonly<Record<ReviewPath, ReviewPathAvailability>>,
): ReviewPathSelection {
  if (pathAvailability.scrutineer === "available") {
    return {
      selected: "scrutineer",
      reason: "scrutineer available",
      isFallback: false,
      isDegraded: false,
    };
  }

  if (pathAvailability.coderabbit === "available") {
    return {
      selected: "coderabbit",
      reason: `scrutineer ${pathAvailability.scrutineer}; coderabbit available`,
      isFallback: true,
      isDegraded: false,
    };
  }

  return {
    selected: "local-self-run",
    reason: `scrutineer ${pathAvailability.scrutineer}; coderabbit ${pathAvailability.coderabbit}; local-self-run ${pathAvailability["local-self-run"]}`,
    isFallback: true,
    isDegraded: true,
  };
}

/**
 * Classify reviewer-run gate evidence without reading or executing anything.
 *
 * @param input Gate executions and review-path availability facts.
 * @returns Review evidence status for the CLI and report formatter.
 */
export function classifyReviewEvidence(input: ClassifyReviewEvidenceInput): ReviewEvidenceResult {
  const usageError = findUsageError(input);
  if (usageError !== undefined) {
    return { status: "usage-error", message: usageError };
  }

  const reviewPath = selectReviewPath(input.pathAvailability);
  const degradedReasons = degradedEvidenceReasons(input, reviewPath);
  if (degradedReasons.length > 0) {
    return {
      status: "degraded",
      executions: input.executions,
      reviewPath,
      reasons: degradedReasons,
    };
  }

  const failedGates = input.executions.flatMap((execution) => {
    if (execution.status !== "failed" || !input.requiredGates.includes(execution.gate)) {
      return [];
    }

    return [execution.gate];
  });

  if (failedGates.length > 0) {
    return {
      status: "failed",
      executions: input.executions,
      reviewPath,
      failedGates,
    };
  }

  return {
    status: "verified",
    executions: input.executions,
    reviewPath,
  };
}

/** Return the first defensive input-contract violation. */
const findUsageError = (input: ClassifyReviewEvidenceInput): string | undefined => {
  if (input.requiredGates.length === 0) {
    return "review evidence requires at least one gate";
  }

  const duplicateGate = findDuplicateExecutionGate(input.executions);
  if (duplicateGate !== undefined) {
    return `duplicate execution evidence for gate: ${duplicateGate}`;
  }

  if (!input.executionEnabled) {
    return undefined;
  }

  const executedGates = new Set(input.executions.map((execution) => execution.gate));
  const missingGate = input.requiredGates.find((gate) => !executedGates.has(gate));

  if (missingGate !== undefined) {
    return `missing execution evidence for required gate: ${missingGate}`;
  }

  return undefined;
};

/** Find the first gate that appears more than once in execution evidence. */
const findDuplicateExecutionGate = (
  executions: readonly GateExecution[],
): ReviewGateId | undefined => {
  const seenGates = new Set<ReviewGateId>();

  for (const execution of executions) {
    if (seenGates.has(execution.gate)) {
      return execution.gate;
    }

    seenGates.add(execution.gate);
  }

  return undefined;
};

/** Collect every trust-gap reason that should outrank ordinary gate failures. */
const degradedEvidenceReasons = (
  input: ClassifyReviewEvidenceInput,
  reviewPath: ReviewPathSelection,
): readonly string[] => {
  return [
    ...executionAvailabilityReasons(input),
    ...unavailableGateReasons(input.executions, input.requiredGates),
    ...(reviewPath.isDegraded ? ["no independent dual-review path available"] : []),
  ];
};

/** Explain when gate commands did not run independently in this reviewer. */
const executionAvailabilityReasons = (input: ClassifyReviewEvidenceInput): readonly string[] => {
  if (input.executionEnabled) {
    return [];
  }

  return ["command execution unavailable; gates were not independently executed"];
};

/** Explain each required gate whose command could not be spawned. */
const unavailableGateReasons = (
  executions: readonly GateExecution[],
  requiredGates: readonly ReviewGateId[],
): readonly string[] => {
  return executions.flatMap((execution) => {
    if (execution.status !== "unavailable" || !requiredGates.includes(execution.gate)) {
      return [];
    }

    return [`${execution.gate} unavailable: ${execution.detail}`];
  });
};
