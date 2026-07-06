/**
 * @file Explicit path reader for workflow source text.
 */

import { readFileSync } from "node:fs";
import type { WorkflowSource } from "../static-analysis";
import { messageForThrownValue } from "./thrown-value-message";

export type WorkflowSourceReadFailure = {
  readonly filePath: string;
  readonly reason: "not-found" | "not-a-file" | "unreadable";
  readonly message: string;
};

export type WorkflowSourceReadResult =
  | { readonly ok: true; readonly source: WorkflowSource }
  | { readonly ok: false; readonly failure: WorkflowSourceReadFailure };

export type ReadFileText = (filePath: string) => string;

type WorkflowSourceReadOptions = {
  readonly readFileText?: ReadFileText;
};

/** Reads a workflow file as UTF-8 text using the host filesystem. */
const defaultReadFileText: ReadFileText = (filePath) => readFileSync(filePath, "utf8");

/** Extracts the POSIX-style error code surfaced by Node filesystem errors. */
const errnoCodeFor = (error: unknown): string | undefined => {
  if (error === null || typeof error !== "object") {
    return undefined;
  }

  const code = (error as NodeJS.ErrnoException).code;

  return typeof code === "string" ? code : undefined;
};

/** Maps known filesystem error codes to the CLI's stable read-failure reasons. */
const reasonForErrnoCode = (code: string | undefined): WorkflowSourceReadFailure["reason"] => {
  switch (code) {
    case "ENOENT":
      return "not-found";
    case "EISDIR":
      return "not-a-file";
    default:
      return "unreadable";
  }
};

/** Builds the project-owned read failure shape from any thrown filesystem value. */
const readFailureFor = (filePath: string, error: unknown): WorkflowSourceReadFailure =>
  Object.freeze({
    filePath,
    reason: reasonForErrnoCode(errnoCodeFor(error)),
    message: messageForThrownValue(error),
  });

/**
 * Reads one explicit workflow file path as UTF-8 source text.
 *
 * @param filePath - Invocation path to preserve in diagnostics.
 * @param options - Optional filesystem reader override for deterministic tests.
 * @returns A workflow source record or a structured read failure.
 *
 * @example
 * ```ts
 * const result = readWorkflowSource("workflows/example.js");
 * if (result.ok) {
 *   console.log(result.source.filePath);
 * }
 * ```
 */
export const readWorkflowSource = (
  filePath: string,
  options: WorkflowSourceReadOptions = {},
): WorkflowSourceReadResult => {
  const readFileText = options.readFileText ?? defaultReadFileText;

  try {
    return Object.freeze({
      ok: true,
      source: Object.freeze({
        filePath,
        sourceText: readFileText(filePath),
      }),
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      failure: readFailureFor(filePath, error),
    });
  }
};
