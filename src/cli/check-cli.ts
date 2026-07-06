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
import type { ReadFileText, WorkflowSourceReadFailure } from "./read-workflow-source";
import { type CheckRequest, checkDiagnosticsExitCode, runCheck } from "./run-check";
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

type CheckOutputFormat = "full" | "json";

type ParsedCheckArgs =
  | {
      readonly ok: true;
      readonly outputFormat: CheckOutputFormat;
      readonly paths: readonly string[];
      readonly configPath?: string;
      readonly isolated: boolean;
    }
  | { readonly ok: false; readonly usageError: string };

type ParsedCheckArgState = {
  readonly outputFormat: CheckOutputFormat;
  readonly paths: readonly string[];
  readonly configPath?: string;
  readonly isolated: boolean;
  readonly nextIndex: number;
};

type ParseCheckTokenResult =
  | { readonly ok: true; readonly state: ParsedCheckArgState }
  | { readonly ok: false; readonly usageError: string };

type ParsedCheckOption =
  | { readonly ok: true; readonly handled: true; readonly state: ParsedCheckArgState }
  | { readonly ok: true; readonly handled: false }
  | { readonly ok: false; readonly usageError: string };

const USAGE = "usage: odw-lint check <workflow.js ...>";

/** Resolve optional writer seams to the real process streams. */
const resolveWriters = (io: CheckCliIo): CheckCliWriters => {
  return {
    writeOut: io.writeOut ?? ((message) => void stdout.write(message)),
    writeErr: io.writeErr ?? ((message) => void stderr.write(message)),
  };
};

/** Builds the successful parser result without retaining mutable arrays. */
const parsedCheckArgsFromState = (state: ParsedCheckArgState): ParsedCheckArgs => {
  return state.configPath === undefined
    ? {
        ok: true,
        outputFormat: state.outputFormat,
        paths: Object.freeze([...state.paths]),
        isolated: state.isolated,
      }
    : {
        ok: true,
        outputFormat: state.outputFormat,
        paths: Object.freeze([...state.paths]),
        configPath: state.configPath,
        isolated: state.isolated,
      };
};

/** Parse the minimal explicit-path `check` command shape. */
const parseCheckArgs = (args: readonly string[]): ParsedCheckArgs => {
  const [subcommand, ...tokens] = args;

  if (subcommand === undefined) {
    return { ok: false, usageError: USAGE };
  }

  if (subcommand !== "check") {
    return { ok: false, usageError: `unknown command: ${subcommand}` };
  }

  let state: ParsedCheckArgState = {
    outputFormat: "full",
    paths: [],
    isolated: false,
    nextIndex: 0,
  };

  while (state.nextIndex < tokens.length) {
    const parsedToken = parseCheckToken(tokens, state);
    if (!parsedToken.ok) {
      return parsedToken;
    }

    state = parsedToken.state;
  }

  if (state.paths.length === 0) {
    return { ok: false, usageError: USAGE };
  }

  return parsedCheckArgsFromState(state);
};

/** Parses one option or positional token from the `check` argument tail. */
const parseCheckToken = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
): ParseCheckTokenResult => {
  const token = tokens[state.nextIndex];
  if (token === undefined) {
    return { ok: true, state };
  }

  const parsedOption = parseCheckOption(tokens, state, token);
  if (!parsedOption.ok) {
    return parsedOption;
  }
  if (parsedOption.handled) {
    return { ok: true, state: parsedOption.state };
  }

  return token.startsWith("-")
    ? { ok: false, usageError: `unknown option: ${token}` }
    : {
        ok: true,
        state: {
          ...state,
          paths: [...state.paths, token],
          nextIndex: state.nextIndex + 1,
        },
      };
};

/** Parses recognised `check` options while leaving operands to the caller. */
const parseCheckOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  if (token === "--isolated") {
    return {
      ok: true,
      handled: true,
      state: { ...state, isolated: true, nextIndex: state.nextIndex + 1 },
    };
  }

  if (token === "--config") {
    const value = tokens[state.nextIndex + 1];
    return value === undefined
      ? { ok: false, usageError: "missing value for --config" }
      : {
          ok: true,
          handled: true,
          state: { ...state, configPath: value, nextIndex: state.nextIndex + 2 },
        };
  }

  if (token === "--output-format") {
    const value = tokens[state.nextIndex + 1];
    const parsedFormat = parseOutputFormatValue(value);
    return parsedFormat.ok
      ? {
          ok: true,
          handled: true,
          state: {
            ...state,
            outputFormat: parsedFormat.outputFormat,
            nextIndex: state.nextIndex + 2,
          },
        }
      : parsedFormat;
  }

  if (token.startsWith("--output-format=")) {
    const parsedFormat = parseOutputFormatValue(token.slice("--output-format=".length));
    return parsedFormat.ok
      ? {
          ok: true,
          handled: true,
          state: {
            ...state,
            outputFormat: parsedFormat.outputFormat,
            nextIndex: state.nextIndex + 1,
          },
        }
      : parsedFormat;
  }

  return { ok: true, handled: false };
};

/** Parse the implemented output formats from the wider planned flag surface. */
const parseOutputFormat = (
  value: string,
):
  | { readonly ok: true; readonly outputFormat: CheckOutputFormat }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === "full" || value === "json") {
    return { ok: true, outputFormat: value };
  }

  return { ok: false, usageError: `unsupported output format: ${value}` };
};

/** Parse a required output-format option value. */
const parseOutputFormatValue = (
  value: string | undefined,
):
  | { readonly ok: true; readonly outputFormat: CheckOutputFormat }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === undefined) {
    return { ok: false, usageError: "unsupported output format: " };
  }

  return parseOutputFormat(value);
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

    return checkDiagnosticsExitCode(outcome);
  } catch (error) {
    writers.writeErr(`internal error: ${messageForThrownValue(error)}\n`);
    return 2;
  }
};
