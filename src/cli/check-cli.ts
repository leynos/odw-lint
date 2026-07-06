/**
 * @file Argument parsing and writer wiring for the explicit-path `check` CLI.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { cwd, stderr, stdout } from "node:process";
import packageJson from "../../package.json";
import type { ConfigValidationWarning, LinterConfig } from "../config/linter-config";
import {
  type ConfigFileReader,
  type ConfigLoadError,
  type ConfigLoadResult,
  loadLinterConfig,
} from "../config/load-config";
import { formatJsonReport } from "../diagnostics/report-json";
import { formatTextReport } from "../diagnostics/text";
import type { DiagnosticReport } from "../diagnostics/types";
import type { ParsedCheckRunArgs } from "./check-arg-types";
import { parseCheckArgs } from "./check-args";
import { CHECK_USAGE_TEXT } from "./check-help";
import type { CheckOutputFormat } from "./check-output-format";
import { isPathExcluded } from "./path-exclusion";
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
  readonly writeFileText?: (path: string, contents: string) => void;
  readonly readStdin?: () => string;
  readonly readFileText?: ReadFileText;
  readonly readConfigFile?: ConfigFileReader;
  readonly version?: string;
};

type CheckCliWriters = {
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
  readonly writeFileText: (path: string, contents: string) => void;
};

/** Resolve optional writer seams to the real process streams. */
const resolveWriters = (io: CheckCliIo): CheckCliWriters => {
  return {
    writeOut: io.writeOut ?? ((message) => void stdout.write(message)),
    writeErr: io.writeErr ?? ((message) => void stderr.write(message)),
    writeFileText: io.writeFileText ?? ((path, contents) => writeFileSync(path, contents, "utf8")),
  };
};

/** Render the selected diagnostic report, including the trailing CLI newline. */
const renderedReport = (outputFormat: CheckOutputFormat, report: DiagnosticReport): string => {
  if (outputFormat === "json") {
    return `${formatJsonReport(report)}\n`;
  }

  const diagnosticsText = formatTextReport(report);

  if (diagnosticsText.length === 0) {
    return "";
  }

  return `${diagnosticsText}\n`;
};
/** Emit the selected diagnostic report rendering. */
const writeReport = (
  writers: CheckCliWriters,
  parsedArgs: ParsedCheckRunArgs,
  report: DiagnosticReport,
): void => {
  const rendered = renderedReport(parsedArgs.outputFormat, report);

  if (parsedArgs.outputFile !== undefined) {
    writers.writeFileText(parsedArgs.outputFile, rendered);
    return;
  }

  if (rendered.length > 0) {
    writers.writeOut(rendered);
  }
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
const loadConfigForCheck = (parsedArgs: ParsedCheckRunArgs, io: CheckCliIo): ConfigLoadResult => {
  return loadLinterConfig({
    ...(parsedArgs.configPath === undefined ? {} : { configPath: parsedArgs.configPath }),
    ...(parsedArgs.isolated ? { isolated: true } : {}),
    ...(io.readConfigFile === undefined ? {} : { readConfigFile: io.readConfigFile }),
    cwd: cwd(),
  });
};

/** Applies command-line options whose precedence is higher than configuration. */
const configForInvocation = (
  parsedArgs: ParsedCheckRunArgs,
  config: LinterConfig,
): LinterConfig => {
  return parsedArgs.strictClaude ? { ...config, strictClaude: true } : config;
};

/** Reads standard input synchronously to preserve the current CLI contract. */
const defaultReadStdin = (): string => readFileSync(0, "utf8");
/** Builds the check request while respecting exact optional property types. */
const checkRequestFor = (
  parsedArgs: ParsedCheckRunArgs,
  io: CheckCliIo,
  configLoad: Extract<ConfigLoadResult, { readonly ok: true }>,
): CheckRequest => {
  const config = configForInvocation(parsedArgs, configLoad.config);
  const candidatePaths =
    parsedArgs.stdinFilename === undefined ? parsedArgs.paths : [parsedArgs.stdinFilename];
  const paths = pathsForInvocation(parsedArgs, candidatePaths, config);
  const readFileText = readFileTextForInvocation(parsedArgs, io);

  return readFileText === undefined
    ? {
        paths,
        version: io.version ?? packageJson.version,
        config,
      }
    : {
        paths,
        version: io.version ?? packageJson.version,
        readFileText,
        config,
      };
};

/** Applies `--force-exclude` to explicit and stdin-logical check paths. */
const pathsForInvocation = (
  parsedArgs: ParsedCheckRunArgs,
  paths: readonly string[],
  config: LinterConfig,
): readonly string[] => {
  if (!parsedArgs.forceExclude || config.exclude === undefined) {
    return paths;
  }

  return paths.filter((path) => !isPathExcluded(path, config.exclude ?? []));
};
/** Reports whether this v1 invocation applied fixes to any workflow source. */
const fixesAppliedByInvocation = (): boolean => {
  return false;
};

/** Builds optional warning-budget policy without changing the default branch. */
const checkExitPolicyFor = (parsedArgs: ParsedCheckRunArgs): CheckExitPolicy => {
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

  if ("action" in parsedArgs) {
    if (parsedArgs.action === "version") {
      writers.writeOut(`${io.version ?? packageJson.version}\n`);
      return 0;
    }

    writers.writeOut(`${CHECK_USAGE_TEXT}\n`);
    return 0;
  }

  try {
    const configLoad = loadConfigForCheck(parsedArgs, io);

    if (!configLoad.ok) {
      writeConfigLoadError(writers, configLoad.error);
      return 2;
    }

    writeConfigWarnings(writers, configLoad.warnings);

    const outcome = runCheck(checkRequestFor(parsedArgs, io, configLoad));

    writeReport(writers, parsedArgs, outcome.report);
    writeReadFailures(writers, outcome.readFailures);

    return checkExitCodeForInvocation(parsedArgs, outcome);
  } catch (error) {
    writers.writeErr(`internal error: ${messageForThrownValue(error)}\n`);
    return 2;
  }
};

/** Builds the source reader for either explicit files or stdin mode. */
const readFileTextForInvocation = (
  parsedArgs: ParsedCheckRunArgs,
  io: CheckCliIo,
): ReadFileText | undefined => {
  if (parsedArgs.stdinFilename === undefined) {
    return io.readFileText;
  }

  const readStdin = io.readStdin ?? defaultReadStdin;
  const stdinText = readStdin();

  return () => stdinText;
};

/** Applies invocation-level exit policy to the completed check outcome. */
const checkExitCodeForInvocation = (
  parsedArgs: ParsedCheckRunArgs,
  outcome: ReturnType<typeof runCheck>,
): CheckCliExitCode => {
  const defaultExitCode = checkDiagnosticsExitCode(outcome, checkExitPolicyFor(parsedArgs));

  if (parsedArgs.exitNonZeroOnFix) {
    const fixesApplied = fixesAppliedByInvocation();

    if (fixesApplied) {
      return parsedArgs.exitZero ? 0 : 1;
    }
  }

  if (parsedArgs.exitZero) {
    return defaultExitCode === 1 ? 0 : defaultExitCode;
  }

  return defaultExitCode;
};
