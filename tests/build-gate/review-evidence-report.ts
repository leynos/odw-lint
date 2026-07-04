/**
 * @file Reviewer-facing report formatting for review evidence.
 */

import { assertNever, singleLine } from "./report-format-helpers";
import type { GateExecution, ReviewEvidenceResult, ReviewPathSelection } from "./review-evidence";

/** Prefix every review-evidence report status line with the stable grep key. */
export const REVIEW_EVIDENCE_REPORT_PREFIX = "Review evidence: ";

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
      return `${REVIEW_EVIDENCE_REPORT_PREFIX}usage-error\n- usage error: ${singleLine(result.message)}\n`;
    default: {
      return assertNever(result, "review evidence variant");
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
  lines.unshift(`${REVIEW_EVIDENCE_REPORT_PREFIX}${status}`);
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
      return assertNever(execution, "gate execution variant");
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
