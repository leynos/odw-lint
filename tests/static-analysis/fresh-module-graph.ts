/**
 * @file Fresh module graph test helpers.
 *
 * These helpers keep import-safety checks consistent when a test needs a
 * child process with a clean module graph and structured failure output.
 */

import { expect } from "bun:test";
import { spawnSync } from "node:child_process";

export type FreshModuleGraphStatement = string | readonly string[];

export type FreshModuleGraphRunOptions = {
  readonly cwd: string;
  readonly executablePath: string;
  readonly script: string;
  readonly timeoutMs?: number;
};

export type FreshModuleGraphRunResult = {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly error: Error | undefined;
  readonly script: string;
  readonly signal: NodeJS.Signals | null;
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

export type FreshModuleGraphFailure = {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly reason: "spawn-error" | "signal" | "status" | "stdout" | "stderr";
  readonly script: string;
  readonly signal: NodeJS.Signals | null;
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
  readonly error?: {
    readonly message: string;
    readonly name: string;
  };
};

const DEFAULT_TIMEOUT_MS = 5_000;

const structuredFailurePreamble = `
const failFreshModuleGraphCheck = (failure) => {
  console.error(JSON.stringify({ source: "fresh-module-graph", ...failure }));
  process.exit(typeof failure.status === "number" ? failure.status : 1);
};
`.trim();

/** Normalizes nested statement groups into the script body order. */
const flattenStatements = (statements: readonly FreshModuleGraphStatement[]): readonly string[] => {
  return statements.flat();
};

/**
 * Builds a child-process script with a shared structured failure helper.
 *
 * @param statements Script statements or statement groups to run after the
 * failure helper is installed.
 * @returns A JavaScript source string suitable for `--eval`.
 */
export const freshModuleGraphScript = (
  statements: readonly FreshModuleGraphStatement[],
): string => {
  return [structuredFailurePreamble, ...flattenStatements(statements)].join("\n");
};

/**
 * Runs a script in a fresh module graph through the configured executable.
 *
 * @param options Process options and source text for the import-safety check.
 * @returns The child-process result with command, working directory, and script
 * context for assertion failures.
 */
export const runFreshModuleGraphScript = (
  options: FreshModuleGraphRunOptions,
): FreshModuleGraphRunResult => {
  const command = [options.executablePath, "--eval", options.script] as const;
  const result = spawnSync(command[0], command.slice(1), {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return {
    command,
    cwd: options.cwd,
    error: result.error,
    script: options.script,
    signal: result.signal,
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
};

/**
 * Converts process failures into one object so assertion output stays actionable.
 *
 * @param result The captured fresh-module-graph process result.
 * @returns A structured failure object, or `undefined` when the run succeeded.
 */
export const freshModuleGraphFailure = (
  result: FreshModuleGraphRunResult,
): FreshModuleGraphFailure | undefined => {
  const base = {
    command: result.command,
    cwd: result.cwd,
    script: result.script,
    signal: result.signal,
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  } as const;

  if (result.error !== undefined) {
    return {
      ...base,
      error: {
        message: result.error.message,
        name: result.error.name,
      },
      reason: "spawn-error",
    };
  }

  if (result.signal !== null) {
    return { ...base, reason: "signal" };
  }

  if (result.status !== 0) {
    return { ...base, reason: "status" };
  }

  if (result.stdout !== "") {
    return { ...base, reason: "stdout" };
  }

  if (result.stderr !== "") {
    return { ...base, reason: "stderr" };
  }

  return undefined;
};

/**
 * Asserts that a fresh-module-graph run completed without observable output.
 *
 * @param result The captured fresh-module-graph process result.
 */
export const expectFreshModuleGraphSuccess = (result: FreshModuleGraphRunResult): void => {
  expect(freshModuleGraphFailure(result)).toBeUndefined();
};
