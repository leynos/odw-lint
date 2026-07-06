/**
 * @file Argument parsing and writer wiring for the explicit-path `check` CLI.
 */

import { stderr, stdout } from "node:process";
import packageJson from "../../package.json";
import { formatTextDiagnostics } from "../diagnostics/text";
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

type ParsedCheckArgs =
  | { readonly ok: true; readonly paths: readonly string[] }
  | { readonly ok: false; readonly usageError: string };

const USAGE = "usage: odw-lint check <workflow.js ...>";

/** Resolve optional writer seams to the real process streams. */
const resolveWriters = (io: CheckCliIo): CheckCliWriters => {
  return {
    writeOut: io.writeOut ?? ((message) => void stdout.write(message)),
    writeErr: io.writeErr ?? ((message) => void stderr.write(message)),
  };
};

/** Parse the minimal explicit-path `check` command shape. */
const parseCheckArgs = (args: readonly string[]): ParsedCheckArgs => {
  const [subcommand, ...paths] = args;

  if (subcommand === undefined) {
    return { ok: false, usageError: USAGE };
  }

  const firstFlag = args.find((arg) => arg.startsWith("-"));
  if (firstFlag !== undefined) {
    return { ok: false, usageError: `unknown option: ${firstFlag}` };
  }

  if (subcommand !== "check") {
    return { ok: false, usageError: `unknown command: ${subcommand}` };
  }

  if (paths.length === 0) {
    return { ok: false, usageError: USAGE };
  }

  return { ok: true, paths };
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

    writeTextDiagnostics(writers, formatTextDiagnostics(outcome.report.diagnostics));
    writeReadFailures(writers, outcome.readFailures);

    return checkDiagnosticsExitCode(outcome);
  } catch (error) {
    writers.writeErr(`internal error: ${messageForThrownValue(error)}\n`);
    return 2;
  }
};
