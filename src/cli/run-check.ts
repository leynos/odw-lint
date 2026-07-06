/**
 * @file Explicit-path check aggregation and exit-code policy.
 *
 * This module is the CLI command's static-analysis spine. It reads only the
 * paths supplied by the caller, lints readable sources without executing them,
 * and leaves argument parsing, text output, and process wiring to later CLI
 * layers.
 */

import { createDiagnosticReport } from "../diagnostics/report";
import type { Diagnostic, DiagnosticReport } from "../diagnostics/types";
import { lintWorkflowSource } from "../static-analysis/workflow-lint";
import {
  type ReadFileText,
  readWorkflowSource,
  type WorkflowSourceReadFailure,
} from "./read-workflow-source";

export type CheckOutcome = {
  readonly report: DiagnosticReport;
  readonly readFailures: readonly WorkflowSourceReadFailure[];
};

export type CheckRequest = {
  readonly paths: readonly string[];
  readonly version: string;
  readonly readFileText?: ReadFileText;
};

/**
 * Lints explicit workflow file paths and aggregates their diagnostics.
 *
 * @param request - Explicit file paths, tool version, and optional reader seam.
 * @returns Diagnostic report for readable files plus CLI-level read failures.
 */
export const runCheck = (request: CheckRequest): CheckOutcome => {
  const diagnostics: Diagnostic[] = [];
  const readFailures: WorkflowSourceReadFailure[] = [];
  let readFileCount = 0;

  for (const path of request.paths) {
    const readOptions =
      request.readFileText === undefined ? undefined : { readFileText: request.readFileText };
    const readResult = readWorkflowSource(path, readOptions);

    if (!readResult.ok) {
      readFailures.push(readResult.failure);
      continue;
    }

    readFileCount += 1;
    diagnostics.push(...lintWorkflowSource(readResult.source).diagnostics);
  }

  return Object.freeze({
    report: createDiagnosticReport({
      version: request.version,
      files: readFileCount,
      diagnostics,
    }),
    readFailures: Object.freeze(readFailures),
  });
};

/** Returns whether diagnostics or read failures should fail the check. */
const hasRemainingCheckFindings = (outcome: CheckOutcome): boolean => {
  return outcome.report.diagnostics.length > 0 || outcome.readFailures.length > 0;
};

/**
 * Derives the default `check` process status for diagnostics/read failures.
 *
 * Ruff parity means every remaining diagnostic fails the check, regardless of
 * severity. Warning-only, info-only, and hint-only reports therefore still
 * return exit code 1 until later policy flags explicitly opt out.
 *
 * @param outcome - Aggregated check outcome.
 * @returns 0 for a clean readable run, otherwise 1.
 */
export const checkDiagnosticsExitCode = (outcome: CheckOutcome): 0 | 1 => {
  return hasRemainingCheckFindings(outcome) ? 1 : 0;
};
