/**
 * @file Argument parsing and writer wiring for the explicit-path `check` CLI.
 */

import { cwd, stderr, stdout } from "node:process";
import packageJson from "../../package.json";
import type { ConfigValidationWarning } from "../config/linter-config";
import {
  type ConfigFileReader,
  type ConfigLoadError,
  type ConfigLoadResult,
  loadLinterConfig,
} from "../config/load-config";
import { formatJsonReport } from "../diagnostics/report-json";
import { formatTextReport } from "../diagnostics/text";
import type { DiagnosticReport } from "../diagnostics/types";
import { type CheckOutputFormat, type ParsedCheckArgs, parseCheckArgs } from "./check-cli-args";
import type { ReadFileText, WorkflowSourceReadFailure } from "./read-workflow-source";
import {
  type CheckExitPolicy,
  type CheckRequest,
  checkDiagnosticsExitCode,
  runCheck,
} from "./run-check";
import { messageForThrownValue } from "./thrown-value-message";

export type CheckCliExitCode = 0 | 1 | 2;

export type CheckCliIo = {
  readonly writeOut?: (message: string) => void;
  readonly writeErr?: (message: string) => void;
  readonly readFileText?: ReadFileText;
  readonly readConfigFile?: ConfigFileReader;
  readonly version?: string;
};

type CheckCliWriters = {
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

/** Resolve optional writer seams to the real process streams. */
const resolveWriters = (io: CheckCliIo): CheckCliWriters => {
  return {
    writeOut: io.writeOut ?? ((message) => void stdout.write(message)),
    writeErr: io.writeErr ?? ((message) => void stderr.write(message)),
  };
};

/** Emit the current minimal text diagnostics contract. */
const writeTextDiagnostics = (writers: CheckCliWriters, diagnosticsText: string): void => {
  if (diagnosticsText.length === 0) {
    return;
  }

  writers.writeOut(`${diagnosticsText}\n`);
};

/** Emit the selected diagnostic report rendering. */
const writeReport = (
  writers: CheckCliWriters,
  outputFormat: CheckOutputFormat,
  report: DiagnosticReport,
): void => {
  if (outputFormat === "json") {
    writers.writeOut(`${formatJsonReport(report)}\n`);
    return;
  }

  writeTextDiagnostics(writers, formatTextReport(report));
};

/** Emit read failures as CLI-level errors until JSON IO diagnostics exist. */
const writeReadFailures = (
  writers: CheckCliWriters,
  failures: readonly WorkflowSourceReadFailure[],
): void => {
  for (const failure of failures) {
    writers.writeErr(`error: cannot read ${failure.filePath}: ${failure.message}\n`);
  }
};

/** Emits configuration validation warnings without blocking the check. */
const writeConfigWarnings = (
  writers: CheckCliWriters,
  warnings: readonly ConfigValidationWarning[],
): void => {
  for (const warning of warnings) {
    writers.writeErr(`warning: configuration: ${warning.message}\n`);
  }
};

/** Emits a project-owned configuration load error as stable CLI text. */
const writeConfigLoadError = (writers: CheckCliWriters, error: ConfigLoadError): void => {
  switch (error.kind) {
    case "usage-error":
      writers.writeErr(`${error.message}\n`);
      return;
    case "read-failed":
      writers.writeErr(`error: configuration: cannot read ${error.filePath}: ${error.message}\n`);
      return;
    case "parse-failed":
      writers.writeErr(`error: configuration: ${error.message}\n`);
      return;
    case "invalid-config":
      writers.writeErr(`error: configuration: ${error.message}\n`);
      for (const validationError of error.errors) {
        writers.writeErr(`error: configuration: ${validationError.message}\n`);
      }
      for (const warning of error.warnings) {
        writers.writeErr(`warning: configuration: ${warning.message}\n`);
      }
  }
};

/** Loads configuration for a parsed check invocation through the CLI seams. */
const loadConfigForCheck = (
  parsedArgs: Extract<ParsedCheckArgs, { readonly ok: true }>,
  io: CheckCliIo,
): ConfigLoadResult => {
  return loadLinterConfig({
    ...(parsedArgs.configPath === undefined ? {} : { configPath: parsedArgs.configPath }),
    ...(parsedArgs.isolated ? { isolated: true } : {}),
    ...(io.readConfigFile === undefined ? {} : { readConfigFile: io.readConfigFile }),
    cwd: cwd(),
  });
};

/** Builds the check request while respecting exact optional property types. */
const checkRequestFor = (
  parsedArgs: Extract<ParsedCheckArgs, { readonly ok: true }>,
  io: CheckCliIo,
  configLoad: Extract<ConfigLoadResult, { readonly ok: true }>,
): CheckRequest => {
  return io.readFileText === undefined
    ? {
        paths: parsedArgs.paths,
        version: io.version ?? packageJson.version,
        config: configLoad.config,
      }
    : {
        paths: parsedArgs.paths,
        version: io.version ?? packageJson.version,
        readFileText: io.readFileText,
        config: configLoad.config,
      };
};

/** Builds optional warning-budget policy without changing the default branch. */
const checkExitPolicyFor = (
  parsedArgs: Extract<ParsedCheckArgs, { readonly ok: true }>,
): CheckExitPolicy => {
  return parsedArgs.maxWarnings === undefined ? {} : { maxWarnings: parsedArgs.maxWarnings };
};

/**
 * Run the explicit-path `check` command over parsed command-line arguments.
 *
 * @param args Command-line arguments excluding `bun` and the script path.
 * @param io Optional writer, reader, and version seams for deterministic tests.
 * @returns Stable process exit code for the CLI caller.
 */
export const runCheckCli = (args: readonly string[], io: CheckCliIo = {}): CheckCliExitCode => {
  const writers = resolveWriters(io);
  const parsedArgs = parseCheckArgs(args);

  if (!parsedArgs.ok) {
    writers.writeErr(`${parsedArgs.usageError}\n`);
    return 2;
  }

  try {
    const configLoad = loadConfigForCheck(parsedArgs, io);

    if (!configLoad.ok) {
      writeConfigLoadError(writers, configLoad.error);
      return 2;
    }

    writeConfigWarnings(writers, configLoad.warnings);

    const outcome = runCheck(checkRequestFor(parsedArgs, io, configLoad));

    writeReport(writers, parsedArgs.outputFormat, outcome.report);
    writeReadFailures(writers, outcome.readFailures);

    return checkDiagnosticsExitCode(outcome, checkExitPolicyFor(parsedArgs));
  } catch (error) {
    writers.writeErr(`internal error: ${messageForThrownValue(error)}\n`);
    return 2;
  }
};
