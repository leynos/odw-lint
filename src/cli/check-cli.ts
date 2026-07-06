/**
 * @file Argument parsing and writer wiring for the explicit-path `check` CLI.
 */

import { stderr, stdout } from "node:process";
import packageJson from "../../package.json";
import { formatJsonReport } from "../diagnostics/report-json";
import { formatTextReport } from "../diagnostics/text";
import type { DiagnosticReport } from "../diagnostics/types";
import type { ReadFileText, WorkflowSourceReadFailure } from "./read-workflow-source";
import { checkDiagnosticsExitCode, runCheck } from "./run-check";

export type CheckCliExitCode = 0 | 1 | 2;

export type CheckCliIo = {
  readonly writeOut?: (message: string) => void;
  readonly writeErr?: (message: string) => void;
  readonly readFileText?: ReadFileText;
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
    }
  | { readonly ok: false; readonly usageError: string };

type ParsedCheckOperand =
  | { readonly ok: true; readonly kind: "path"; readonly path: string }
  | {
      readonly ok: true;
      readonly kind: "output-format";
      readonly outputFormat: CheckOutputFormat;
      readonly consumedNext: boolean;
    }
  | { readonly ok: false; readonly usageError: string };

const USAGE = "usage: odw-lint check <workflow.js ...>";

/** Resolve optional writer seams to the real process streams. */
const resolveWriters = (io: CheckCliIo): CheckCliWriters => {
  return {
    writeOut: io.writeOut ?? ((message) => void stdout.write(message)),
    writeErr: io.writeErr ?? ((message) => void stderr.write(message)),
  };
};

/** Parse flag and path operands for the explicit-path `check` command. */
const parseCheckOperands = (operands: readonly string[]): ParsedCheckArgs => {
  const paths: string[] = [];
  let outputFormat: CheckOutputFormat = "full";

  for (let index = 0; index < operands.length; index += 1) {
    const parsedOperand = parseCheckOperand(operands[index], operands[index + 1]);

    if (!parsedOperand.ok) {
      return parsedOperand;
    }

    if (parsedOperand.kind === "path") {
      paths.push(parsedOperand.path);
      continue;
    }

    outputFormat = parsedOperand.outputFormat;
    if (parsedOperand.consumedNext) {
      index += 1;
    }
  }

  if (paths.length === 0) {
    return { ok: false, usageError: USAGE };
  }

  return { ok: true, outputFormat, paths };
};

/** Parse one path or output-format operand. */
const parseCheckOperand = (
  operand: string | undefined,
  nextOperand: string | undefined,
): ParsedCheckOperand => {
  if (operand === undefined) {
    return { ok: false, usageError: USAGE };
  }

  if (operand === "--output-format") {
    return parseOutputFormatOperand(nextOperand, true);
  }

  if (operand.startsWith("--output-format=")) {
    return parseOutputFormatOperand(operand.slice("--output-format=".length), false);
  }

  if (operand.startsWith("-")) {
    return { ok: false, usageError: `unknown option: ${operand}` };
  }

  return { ok: true, kind: "path", path: operand };
};

/** Parse the minimal explicit-path `check` command shape. */
const parseCheckArgs = (args: readonly string[]): ParsedCheckArgs => {
  const [subcommand, ...operands] = args;

  if (subcommand === undefined) {
    return { ok: false, usageError: USAGE };
  }

  if (subcommand !== "check") {
    return { ok: false, usageError: `unknown command: ${subcommand}` };
  }

  return parseCheckOperands(operands);
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

/** Parse the value side of an output-format flag. */
const parseOutputFormatOperand = (
  value: string | undefined,
  consumedNext: boolean,
): ParsedCheckOperand => {
  if (value === undefined) {
    return { ok: false, usageError: "unsupported output format: " };
  }

  const parsedFormat = parseOutputFormat(value);
  if (!parsedFormat.ok) {
    return parsedFormat;
  }

  return {
    ok: true,
    kind: "output-format",
    outputFormat: parsedFormat.outputFormat,
    consumedNext,
  };
};

/** Convert unexpected thrown values to stable CLI text. */
const messageForThrownValue = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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
    const request =
      io.readFileText === undefined
        ? {
            paths: parsedArgs.paths,
            version: io.version ?? packageJson.version,
          }
        : {
            paths: parsedArgs.paths,
            version: io.version ?? packageJson.version,
            readFileText: io.readFileText,
          };
    const outcome = runCheck({
      ...request,
    });

    writeReport(writers, parsedArgs.outputFormat, outcome.report);
    writeReadFailures(writers, outcome.readFailures);

    return checkDiagnosticsExitCode(outcome);
  } catch (error) {
    writers.writeErr(`internal error: ${messageForThrownValue(error)}\n`);
    return 2;
  }
};
