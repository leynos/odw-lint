/**
 * @file Git-backed tracked-file trailing whitespace hygiene guard.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { type CliWriters, emitCliReport, resolveCliWriters } from "./cli-support";
import { lsTrackedFiles } from "./git-support";
import {
  findTrailingWhitespaceViolations,
  formatWhitespaceViolations,
} from "./whitespace-hygiene-support";

export type WhitespaceHygieneExitCode = 0 | 1 | 2;

type WhitespaceHygieneCliOutcome = {
  readonly report: string;
  readonly toErr: boolean;
  readonly exitCode: WhitespaceHygieneExitCode;
};

/**
 * Run the command-line guard and return its process exit code.
 *
 * @param repositoryPath Repository directory to scan.
 * @param writers Output writers for tests and the real CLI.
 * @returns Process exit code.
 */
export function runWhitespaceHygieneCli(
  repositoryPath = cwd(),
  writers: CliWriters = resolveCliWriters(),
): WhitespaceHygieneExitCode {
  const outcome = checkWhitespaceHygiene(repositoryPath);

  emitCliReport({ report: outcome.report, toErr: outcome.toErr, writers });
  return outcome.exitCode;
}

/** Check whitespace hygiene and return one already-formatted CLI outcome. */
function checkWhitespaceHygiene(repositoryPath: string): WhitespaceHygieneCliOutcome {
  try {
    const paths = trackedRepositoryFiles(repositoryPath);
    const violations = findTrailingWhitespaceViolations(paths, (path) =>
      readTrackedFile(repositoryPath, path),
    );

    if (violations.length === 0) {
      return {
        report: "Whitespace hygiene check passed.\n",
        toErr: false,
        exitCode: 0,
      };
    }

    return {
      report: `Trailing whitespace found in tracked files:\n${formatWhitespaceViolations(violations)}\n`,
      toErr: true,
      exitCode: 1,
    };
  } catch (error) {
    return {
      report: `whitespace hygiene check failed: ${errorMessage(error)}\n`,
      toErr: true,
      exitCode: 2,
    };
  }
}

/**
 * List every tracked repository path using Git's NUL-separated output.
 */
function trackedRepositoryFiles(repositoryPath: string): readonly string[] {
  return lsTrackedFiles({ repositoryPath });
}

/**
 * Read one tracked file as bytes and convert filesystem failures to stable errors.
 */
function readTrackedFile(repositoryPath: string, path: string): Buffer {
  try {
    return readFileSync(join(repositoryPath, path));
  } catch {
    throw new Error(`could not read tracked file ${path}`);
  }
}

/**
 * Convert unknown thrown values to deterministic CLI text.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  exit(runWhitespaceHygieneCli());
}
