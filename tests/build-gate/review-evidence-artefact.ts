/**
 * @file Pure helpers for recorded review-evidence artefacts.
 */

import {
  compareTreeProvenance,
  parseTreeProvenance,
  type TreeProvenance,
} from "./review-evidence-provenance";
import { REVIEW_EVIDENCE_REPORT_PREFIX } from "./review-evidence-report";

export type RecordedStatus = "verified" | "failed" | "degraded";

export type RecordedEvidenceResult =
  | {
      readonly outcome: "present";
      readonly path: string;
      readonly provenance?: TreeProvenance;
      readonly status: RecordedStatus;
    }
  | { readonly outcome: "missing"; readonly path: string }
  | { readonly outcome: "invalid"; readonly path: string; readonly reason: string }
  | {
      readonly outcome: "mismatched";
      readonly path: string;
      readonly actual: TreeProvenance;
      readonly expected: TreeProvenance;
      readonly status: RecordedStatus;
    }
  | { readonly outcome: "usage-error"; readonly message: string };

export const DEFAULT_EVIDENCE_ARTEFACT_PATH = ".review-evidence/report.txt";

const terminalStatuses = new Set<RecordedStatus>(["verified", "failed", "degraded"]);
const REQUIRED_COMMON_REPORT_LINES = ["- gate ", "- dual-review path: "] as const;
const REQUIRED_STATUS_REPORT_LINES = {
  verified: [],
  failed: ["- failed gate: "],
  degraded: ["- degraded reason: "],
} satisfies Readonly<Record<RecordedStatus, readonly string[]>>;

/**
 * Read the terminal status from a formatted review-evidence report.
 *
 * @param content - Formatted review-evidence report text.
 * @returns The terminal recorded status, or undefined when the text is not a completed report.
 * @example
 * parseRecordedStatus("Review evidence: verified\n")
 * // => "verified"
 */
export function parseRecordedStatus(content: string): RecordedStatus | undefined {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";

  if (!firstLine.startsWith(REVIEW_EVIDENCE_REPORT_PREFIX)) {
    return undefined;
  }

  const status = firstLine.slice(REVIEW_EVIDENCE_REPORT_PREFIX.length);
  return terminalStatuses.has(status as RecordedStatus) ? (status as RecordedStatus) : undefined;
}

/**
 * Classify a recorded artefact by presence and report authenticity.
 *
 * @param input - Artefact path and optional file content read from that path.
 * @returns The presence, missing, or invalid classification for the artefact.
 * @example
 * classifyRecordedEvidence({ path: "report.txt", content: undefined })
 * // => { outcome: "missing", path: "report.txt" }
 */
export function classifyRecordedEvidence(input: {
  readonly path: string;
  readonly content: string | undefined;
}): RecordedEvidenceResult {
  if (input.content === undefined) {
    return { outcome: "missing", path: input.path };
  }

  if (input.content.trim() === "") {
    return {
      outcome: "invalid",
      path: input.path,
      reason: "recorded evidence file is empty",
    };
  }

  const status = parseRecordedStatus(input.content);
  if (status === undefined) {
    return {
      outcome: "invalid",
      path: input.path,
      reason: "recorded evidence is not a completed review report",
    };
  }

  if (!hasCompletedReportStructure(input.content, status)) {
    return {
      outcome: "invalid",
      path: input.path,
      reason: "recorded evidence is not a completed review report",
    };
  }

  return { outcome: "present", path: input.path, status };
}

/**
 * Classify a recorded artefact and prove it belongs to the current tree state.
 *
 * @param input - Artefact path, optional content, and current tree provenance.
 * @returns Present when the artefact is complete and bound to the current tree.
 * @example
 * classifyBoundEvidence({ path: "report.txt", content, current })
 * // => { outcome: "present", path: "report.txt", status: "verified", provenance: current }
 */
export function classifyBoundEvidence(input: {
  readonly path: string;
  readonly content: string | undefined;
  readonly current: TreeProvenance;
}): RecordedEvidenceResult {
  const result = classifyRecordedEvidence(input);

  if (result.outcome !== "present") {
    return result;
  }

  const provenance = parseTreeProvenance(input.content ?? "");
  if (provenance === undefined) {
    return {
      outcome: "invalid",
      path: input.path,
      reason: "recorded evidence is not bound to a reviewed tree state",
    };
  }

  if (compareTreeProvenance(provenance, input.current) === "mismatch") {
    return {
      outcome: "mismatched",
      path: input.path,
      actual: input.current,
      expected: provenance,
      status: result.status,
    };
  }

  return { ...result, provenance };
}

/** Check for the report body lines that prove recording reached completion. */
const hasCompletedReportStructure = (content: string, status: RecordedStatus): boolean => {
  const lines = content.split(/\r?\n/);
  const requiredPrefixes = [
    ...REQUIRED_COMMON_REPORT_LINES,
    ...REQUIRED_STATUS_REPORT_LINES[status],
  ];

  return requiredPrefixes.every((requiredPrefix) =>
    lines.some((line) => line.startsWith(requiredPrefix)),
  );
};

/**
 * Resolve the review-evidence artefact path from flag, environment, or default.
 *
 * @param input - Explicit flag value and process environment to inspect.
 * @returns The artefact path selected by flag, environment, or default precedence.
 * @example
 * resolveEvidenceArtefactPath({ flagValue: "report.txt", env: {} })
 * // => "report.txt"
 */
export function resolveEvidenceArtefactPath(input: {
  readonly flagValue?: string | undefined;
  readonly env: NodeJS.ProcessEnv;
}): string {
  const { ODW_LINT_REVIEW_EVIDENCE_PATH: envValue } = input.env;

  return nonBlankPath(input.flagValue) ?? nonBlankPath(envValue) ?? DEFAULT_EVIDENCE_ARTEFACT_PATH;
}

/** Return undefined for blank path strings so default resolution remains fail-safe. */
const nonBlankPath = (value: string | undefined): string | undefined => {
  const trimmedValue = value?.trim();

  return trimmedValue === "" ? undefined : trimmedValue;
};
