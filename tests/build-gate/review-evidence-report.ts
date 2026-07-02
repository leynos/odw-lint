/**
 * @file Reviewer-facing report formatting for review evidence.
 */

import type { GateExecution, ReviewEvidenceResult, ReviewPathSelection } from "./review-evidence";

/**
 * Format review evidence as stable, greppable CLI output.
 *
 * @param result Review evidence classification to render.
 * @returns Reviewer-facing report text with a trailing newline.
 */
export function formatReviewEvidenceResult(result: ReviewEvidenceResult): string {
  switch (result.status) {
    case "verified":
      return formatResultLines(result.status, result.executions, result.reviewPath);
    case "failed":
      return formatResultLines(
        result.status,
        result.executions,
        result.reviewPath,
        result.failedGates.map((gate) => `failed gate: ${gate}`),
      );
    case "degraded":
      return formatResultLines(
        result.status,
        result.executions,
        result.reviewPath,
        result.reasons.map((reason) => `degraded reason: ${singleLine(reason)}`),
      );
    case "usage-error":
      return `Review evidence: usage-error\n- usage error: ${singleLine(result.message)}\n`;
    default: {
      return assertNever(result);
    }
  }
}

/** Build the common gate and review-path report body. */
const formatResultLines = (
  status: "verified" | "failed" | "degraded",
  executions: readonly GateExecution[],
  reviewPath: ReviewPathSelection,
  extraLines: readonly string[] = [],
): string => {
  const lines = executions.map((execution) => `- gate ${formatExecution(execution)}`);
  lines.unshift(`Review evidence: ${status}`);
  lines.push(`- dual-review path: ${formatReviewPath(reviewPath)}`);
  lines.push(...extraLines.map((line) => `- ${line}`));

  return `${lines.join("\n")}\n`;
};

/** Format one gate execution with stable failure and unavailability details. */
const formatExecution = (execution: GateExecution): string => {
  switch (execution.status) {
    case "passed":
      return `${execution.gate}: passed`;
    case "failed":
      return `${execution.gate}: failed (exit ${execution.exitCode}; ${singleLine(
        execution.detail,
      )})`;
    case "unavailable":
      return `${execution.gate}: unavailable (${singleLine(execution.detail)})`;
    default: {
      return assertNever(execution);
    }
  }
};

/** Format the chosen reviewer path and its non-silent fallback reason. */
const formatReviewPath = (reviewPath: ReviewPathSelection): string => {
  return `${reviewPath.selected} (${reviewPathKind(reviewPath)}; ${singleLine(reviewPath.reason)})`;
};

/** Name whether the selected reviewer path is primary, fallback, or degraded. */
const reviewPathKind = (reviewPath: ReviewPathSelection): string => {
  if (reviewPath.isDegraded) {
    return "degraded fallback";
  }

  return reviewPath.isFallback ? "fallback" : "primary";
};

/** Preserve one report fact per line even when caller-owned text is multiline. */
const singleLine = (value: string): string => {
  return value.replaceAll(/\s+/g, " ").trim();
};

/** Preserve compile-time exhaustiveness checks for discriminated unions. */
const assertNever = (value: never): never => {
  throw new Error(`unhandled review evidence variant: ${JSON.stringify(value)}`);
};
