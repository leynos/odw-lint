/**
 * @file Recording helpers for reviewer-run review evidence.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cwd } from "node:process";
import type { CliWriters } from "./cli-support";
import { singleLine } from "./report-format-helpers";
import type { ReviewEvidenceResult } from "./review-evidence";
import { resolveEvidenceArtefactPath } from "./review-evidence-artefact";

export type ReviewEvidenceRecordingOptions = {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly recordPath?: string;
  readonly shouldRecord: boolean;
  readonly writeArtefact?: (path: string, content: string) => void;
};

/**
 * Persist a terminal review report when the reviewer requested recording.
 *
 * @param input Recording decision, report text, result, and output writers.
 * @example
 * maybeRecordReviewEvidence({ options: { shouldRecord: false }, result, report, writers })
 * // leaves the filesystem untouched
 */
export function maybeRecordReviewEvidence(input: {
  readonly options: ReviewEvidenceRecordingOptions;
  readonly result: ReviewEvidenceResult;
  readonly report: string;
  readonly writers: CliWriters;
}): void {
  if (!shouldRecordReport(input.options, input.result)) {
    return;
  }

  const artefactPath = resolveRecordPath(input.options);
  const absolutePath = resolve(input.options.cwd ?? cwd(), artefactPath);
  const writeArtefact = input.options.writeArtefact ?? writeEvidenceArtefact;

  try {
    writeArtefact(absolutePath, input.report);
  } catch (error) {
    input.writers.writeErr(
      `review evidence recording failed: ${artefactPath}: ${singleLine(errorMessage(error))}\n`,
    );
  }
}

/** Decide whether a completed review report should be persisted. */
const shouldRecordReport = (
  options: ReviewEvidenceRecordingOptions,
  result: ReviewEvidenceResult,
): boolean => {
  if (!options.shouldRecord) {
    return false;
  }

  return result.status !== "usage-error";
};

/** Resolve the artefact path selected by record flag, environment, or default. */
const resolveRecordPath = (options: ReviewEvidenceRecordingOptions): string => {
  return resolveEvidenceArtefactPath({
    flagValue: options.recordPath,
    env: options.env ?? process.env,
  });
};

/** Write an evidence artefact, creating its parent directory on demand. */
const writeEvidenceArtefact = (path: string, content: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
};

/** Convert unknown thrown values to deterministic CLI text. */
const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
