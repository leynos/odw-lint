/**
 * @file Reviewer-facing report formatting for recorded review-evidence artefacts.
 */

import { assertNever, singleLine } from "./report-format-helpers";
import type { RecordedEvidenceResult } from "./review-evidence-artefact";

/**
 * Format recorded review-evidence artefact results as stable CLI output.
 *
 * @param result - Recorded artefact classification to render.
 * @returns Reviewer-facing report text with a trailing newline.
 * @example
 * formatRecordedEvidenceResult({ outcome: "missing", path: "report.txt" })
 * // => "Review evidence artefact: missing\n- artefact path: report.txt\n"
 */
export function formatRecordedEvidenceResult(result: RecordedEvidenceResult): string {
  switch (result.outcome) {
    case "present":
      return formatReportLines([
        "Review evidence artefact: present",
        `- recorded status: ${result.status}`,
        `- artefact path: ${result.path}`,
      ]);
    case "missing":
      return formatReportLines([
        "Review evidence artefact: missing",
        `- artefact path: ${result.path}`,
      ]);
    case "invalid":
      return formatReportLines([
        "Review evidence artefact: invalid",
        `- artefact path: ${result.path}`,
        `- reason: ${singleLine(result.reason)}`,
      ]);
    case "mismatched":
      return formatReportLines([
        "Review evidence artefact: mismatched",
        `- recorded status: ${result.status}`,
        `- artefact path: ${result.path}`,
        `- recorded commit: ${result.expected.commit}`,
        `- recorded tree: ${result.expected.tree}`,
        `- current commit: ${result.actual.commit}`,
        `- current tree: ${result.actual.tree}`,
      ]);
    case "usage-error":
      return formatReportLines([
        "Review evidence artefact: usage-error",
        `- usage error: ${singleLine(result.message)}`,
      ]);
    default: {
      return assertNever(result, "recorded evidence artefact variant");
    }
  }
}

/** Join one-fact-per-line report entries and preserve the final newline. */
const formatReportLines = (lines: readonly string[]): string => {
  return `${lines.join("\n")}\n`;
};
