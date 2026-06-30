/**
 * @file Branch-freshness reviewer-facing report formatting.
 */

import type { BranchFreshnessResult } from "./branch-freshness";

/**
 * Format a branch-freshness result for the command-line review guard.
 *
 * @param result Freshness result to render.
 * @returns Stable reviewer-facing output text.
 */
export function formatBranchFreshnessResult(result: BranchFreshnessResult): string {
  switch (result.status) {
    case "fresh":
      return `Branch freshness check passed for roadmap task ${result.taskId}.\n`;
    case "skipped":
      return `Branch freshness check skipped: ${result.reason}\n`;
    case "stale":
      return formatStaleResult(result);
    case "usage-error":
      return `Branch freshness check could not run: ${result.message}\n`;
  }
}

/** Format all stale findings with stable path, reason, and recovery wording. */
const formatStaleResult = (
  result: Extract<BranchFreshnessResult, { readonly status: "stale" }>,
): string => {
  const lines = [`Branch freshness check failed for roadmap task ${result.taskId}.`];

  for (const finding of result.findings) {
    lines.push(`- ${finding.path}: ${finding.reason}. ${finding.detail}`);
  }

  return `${lines.join("\n")}\n`;
};
