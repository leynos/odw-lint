/**
 * @file Explicit-path check aggregation and exit-code policy.
 *
 * This module is the CLI command's static-analysis spine. It reads only the
 * paths supplied by the caller, lints readable sources without executing them,
 * and leaves argument parsing, text output, and process wiring to later CLI
 * layers.
 */

import { applyConfiguredRuleSeverities } from "../config/apply-config-severities";
import type { LinterConfig } from "../config/linter-config";
import { createDiagnosticReport } from "../diagnostics/report";
import { promoteStrictClaudeSeverity } from "../diagnostics/strict-claude";
import type { Diagnostic, DiagnosticReport, IoError } from "../diagnostics/types";
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

export type CheckExitPolicy = {
  readonly maxWarnings?: number;
};

export type CheckRequest = {
  readonly paths: readonly string[];
  readonly version: string;
  readonly readFileText?: ReadFileText;
  readonly config?: LinterConfig;
};

/** Applies configured rule settings, then strict-Claude promotion. */
const applyCheckConfiguration = (
  diagnostics: readonly Diagnostic[],
  config?: LinterConfig,
): readonly Diagnostic[] => {
  const configuredDiagnostics = applyConfiguredRuleSeverities(diagnostics, config?.rules);

  return config?.strictClaude === true
    ? promoteStrictClaudeSeverity(configuredDiagnostics)
    : configuredDiagnostics;
};

/** Converts filesystem read failures into the report's machine channel. */
const ioErrorFromReadFailure = (failure: WorkflowSourceReadFailure): IoError => {
  return {
    file: failure.filePath,
    reason: failure.reason,
    message: failure.message,
  };
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

  const configuredDiagnostics = applyCheckConfiguration(diagnostics, request.config);

  return Object.freeze({
    report: createDiagnosticReport({
      version: request.version,
      files: readFileCount,
      diagnostics: configuredDiagnostics,
      ioErrors: readFailures.map(ioErrorFromReadFailure),
    }),
    readFailures: Object.freeze(readFailures),
  });
};

/**
 * Derives the default `check` process status for diagnostics/read failures.
 *
 * Ruff parity means every remaining diagnostic fails the check, regardless of
 * severity. Warning-only, info-only, and hint-only reports therefore still
 * return exit code 1 unless a warning-budget policy explicitly tolerates the
 * final warning count.
 *
 * @param outcome - Aggregated check outcome.
 * @param policy - Optional exit policy overrides for warning diagnostics.
 * @returns 0 for a clean readable run, otherwise 1.
 */
export const checkDiagnosticsExitCode = (
  outcome: CheckOutcome,
  policy: CheckExitPolicy = {},
): 0 | 1 => {
  if (outcome.readFailures.length > 0) {
    return 1;
  }

  const { errors, warnings, infos, hints } = outcome.report.summary;
  if (errors + infos + hints > 0) {
    return 1;
  }

  if (policy.maxWarnings === undefined) {
    return warnings > 0 ? 1 : 0;
  }

  return warnings > policy.maxWarnings ? 1 : 0;
};
