/**
 * @file Pure helpers for recorded review-evidence artefacts.
 */

import { REVIEW_EVIDENCE_REPORT_PREFIX } from "./review-evidence-report";

export type RecordedStatus = "verified" | "failed" | "degraded";

export type RecordedEvidenceResult =
  | { readonly outcome: "present"; readonly path: string; readonly status: RecordedStatus }
  | { readonly outcome: "missing"; readonly path: string }
  | { readonly outcome: "invalid"; readonly path: string; readonly reason: string }
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
