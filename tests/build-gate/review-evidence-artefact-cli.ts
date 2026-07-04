/**
 * @file CLI for checking recorded review-evidence artefacts.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { type CliWriters, emitCliReport, resolveCliWriters } from "./cli-support";
import {
  classifyRecordedEvidence,
  type RecordedEvidenceResult,
  resolveEvidenceArtefactPath,
} from "./review-evidence-artefact";
import { formatRecordedEvidenceResult } from "./review-evidence-artefact-report";

export type ReviewEvidenceArtefactExitCode = 0 | 1 | 2;

export type RunReviewEvidenceArtefactCliOptions = {
  readonly readFile?: (path: string) => string | undefined;
  readonly writeOut?: CliWriters["writeOut"];
  readonly writeErr?: CliWriters["writeErr"];
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
};

type ParsedCliOptions =
  | { readonly ok: true; readonly evidencePath?: string }
  | { readonly ok: false; readonly message: string };

/**
 * Run the recorded review-evidence artefact check CLI.
 *
 * @param args Command-line arguments excluding `bun` and script path.
 * @param options Injectable file reader, writers, environment, and working directory.
 * @returns Process exit code for reviewer automation.
 */
export function runReviewEvidenceArtefactCli(
  args: readonly string[] = [],
  options: RunReviewEvidenceArtefactCliOptions = {},
): ReviewEvidenceArtefactExitCode {
  const writers = resolveCliWriters({
    writeOut: options.writeOut,
    writeErr: options.writeErr,
  });
  const parsedOptions = parseCliArgs(args);
  const result = parsedOptions.ok
    ? classifyEvidenceFromOptions(parsedOptions, options)
    : ({ outcome: "usage-error", message: parsedOptions.message } satisfies RecordedEvidenceResult);
  const report = formatRecordedEvidenceResult(result);

  emitCliReport({ report, toErr: result.outcome !== "present", writers });
  return exitCodeFor(result);
}

/** Parse supported CLI flags. */
const parseCliArgs = (args: readonly string[]): ParsedCliOptions => {
  let evidencePath: string | undefined;

  for (const arg of args) {
    const parsedPath = parseFlagValue(arg, "--evidence-path=");
    if (parsedPath !== undefined) {
      evidencePath = parsedPath;
      continue;
    }

    return { ok: false, message: `unknown option: ${arg}` };
  }

  if (evidencePath === undefined) {
    return { ok: true };
  }

  return { ok: true, evidencePath };
};

/** Classify the artefact selected by parsed options and injected environment. */
const classifyEvidenceFromOptions = (
  parsedOptions: Extract<ParsedCliOptions, { ok: true }>,
  options: RunReviewEvidenceArtefactCliOptions,
): RecordedEvidenceResult => {
  const artefactPath = resolveEvidenceArtefactPath(
    parsedOptions.evidencePath === undefined
      ? { env: options.env ?? process.env }
      : { flagValue: parsedOptions.evidencePath, env: options.env ?? process.env },
  );
  const absolutePath = resolve(options.cwd ?? cwd(), artefactPath);
  const readFile = options.readFile ?? readEvidenceFile;

  try {
    return classifyRecordedEvidence({
      path: artefactPath,
      content: readFile(absolutePath),
    });
  } catch (error) {
    return {
      outcome: "invalid",
      path: artefactPath,
      reason: `could not read recorded evidence file: ${errorMessage(error)}`,
    };
  }
};

/** Read one evidence file, mapping absence to the missing-evidence path. */
const readEvidenceFile = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }

    throw error;
  }
};

/** Return the process exit code for a recorded-evidence artefact result. */
const exitCodeFor = (result: RecordedEvidenceResult): ReviewEvidenceArtefactExitCode => {
  switch (result.outcome) {
    case "present":
      return 0;
    case "missing":
    case "invalid":
      return 1;
    case "usage-error":
      return 2;
  }
};

/** Detect filesystem absence errors from Node and Bun file reads. */
const isNotFound = (error: unknown): boolean => {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
};

/** Convert unknown thrown values to deterministic CLI text. */
const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

/** Read one prefixed CLI flag value. */
const parseFlagValue = (arg: string, prefix: string): string | undefined => {
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  exit(runReviewEvidenceArtefactCli(process.argv.slice(2)));
}
