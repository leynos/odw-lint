/**
 * @file Recording helpers for reviewer-run review evidence.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cwd } from "node:process";
import type { CliWriters } from "./cli-support";
import { createGitRunner } from "./git-support";
import { singleLine } from "./report-format-helpers";
import type { ReviewEvidenceResult } from "./review-evidence";
import { resolveEvidenceArtefactPath } from "./review-evidence-artefact";
import {
  formatProvenanceTrailer,
  type ReadTreeProvenanceResult,
  readTreeProvenance,
} from "./review-evidence-provenance";

export type ReviewEvidenceRecordingOptions = {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly readProvenance?: (cwd: string) => ReadTreeProvenanceResult;
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
  const workingDirectory = input.options.cwd ?? cwd();
  const absolutePath = resolve(workingDirectory, artefactPath);
  const writeArtefact = input.options.writeArtefact ?? writeEvidenceArtefact;
  const content = recordedReportContent({
    report: input.report,
    readProvenance: input.options.readProvenance ?? defaultReadProvenance,
    workingDirectory,
    writers: input.writers,
  });

  try {
    writeArtefact(absolutePath, content);
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

/** Read current provenance through the shared Git command seam. */
const defaultReadProvenance = (workingDirectory: string): ReadTreeProvenanceResult => {
  return readTreeProvenance(createGitRunner(workingDirectory));
};

/** Append provenance when available and leave unbound evidence otherwise. */
const recordedReportContent = (input: {
  readonly report: string;
  readonly readProvenance: (cwd: string) => ReadTreeProvenanceResult;
  readonly workingDirectory: string;
  readonly writers: CliWriters;
}): string => {
  const result = input.readProvenance(input.workingDirectory);
  if (result.ok) {
    return `${input.report}${formatProvenanceTrailer(result.provenance)}`;
  }

  input.writers.writeErr(`review evidence provenance unavailable: ${result.message}\n`);
  return input.report;
};

/** Convert unknown thrown values to deterministic CLI text. */
const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
