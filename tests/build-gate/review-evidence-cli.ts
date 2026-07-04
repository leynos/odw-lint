/**
 * @file Reviewer-run CLI for independent roadmap audit evidence.
 */

import { cwd } from "node:process";
import { fileURLToPath } from "node:url";
import { type CliWriters, emitCliReport, resolveCliWriters } from "./cli-support";
import {
  type CommandResult,
  type CommandRunner,
  type CommandRunnerOptions,
  createCommandRunner,
} from "./git-support";
import {
  classifyReviewEvidence,
  type GateExecution,
  type ReviewEvidenceResult,
  type ReviewGateId,
} from "./review-evidence";
import {
  deriveHarnessPathAvailability,
  type PathAvailabilityFacts,
  parseAvailabilityValue,
  setPathAvailability,
} from "./review-evidence-availability";
import { maybeRecordReviewEvidence } from "./review-evidence-recording";
import { formatReviewEvidenceResult } from "./review-evidence-report";

export type GateCommand = readonly [ReviewGateId, string, readonly string[]];
export type ReviewEvidenceExitCode = 0 | 1 | 2 | 3;

type CliOptions = {
  readonly executionEnabled: boolean;
  readonly gateTimeoutMs: number;
  readonly pathAvailability: PathAvailabilityFacts;
  readonly recordPath?: string;
  readonly shouldRecord: boolean;
};

type ParsedCliOption<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly usageError: string };

type ParsedCliOptions = ParsedCliOption<CliOptions>;

type AvailabilityFlag = {
  readonly prefix: string;
  readonly path: keyof PathAvailabilityFacts;
};
export type RunReviewEvidenceCliOptions = {
  readonly createRunner?: (command: string, options?: CommandRunnerOptions) => CommandRunner;
  readonly gateCommands?: readonly GateCommand[];
  readonly writeOut?: CliWriters["writeOut"];
  readonly writeErr?: CliWriters["writeErr"];
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
  readonly writeArtefact?: (path: string, content: string) => void;
};

const defaultGateCommands: readonly GateCommand[] = [
  ["make all", "make", ["all"]],
  ["make markdownlint", "make", ["markdownlint"]],
  ["make nixie", "make", ["nixie"]],
];

const defaultGateTimeoutMs = 5 * 60 * 1000;
const defaultGateMaxBufferBytes = 64 * 1024 * 1024;

const availabilityFlags = [
  { prefix: "--scrutineer=", path: "scrutineer" },
  { prefix: "--coderabbit=", path: "coderabbit" },
  { prefix: "--local-self-run=", path: "local-self-run" },
] as const satisfies readonly AvailabilityFlag[];
/**
 * Run the review-evidence CLI and return its process exit code.
 *
 * @param args Command-line arguments excluding `bun` and script path.
 * @param options Injectable command runners, gate commands, writers, and environment.
 * @returns Process exit code for reviewer automation.
 */
export function runReviewEvidenceCli(
  args: readonly string[] = [],
  options: RunReviewEvidenceCliOptions = {},
): ReviewEvidenceExitCode {
  const env = options.env ?? process.env;
  const parsedOptions = parseCliArgs(args, env, options.timeoutMs ?? defaultGateTimeoutMs);
  const result = !parsedOptions.ok
    ? ({
        status: "usage-error",
        message: parsedOptions.usageError,
      } satisfies ReviewEvidenceResult)
    : collectReviewEvidence(parsedOptions.value, options);
  const report = formatReviewEvidenceResult(result);
  const writers = resolveCliWriters({
    writeOut: options.writeOut,
    writeErr: options.writeErr,
  });

  emitCliReport({ report, toErr: result.status === "usage-error", writers });
  if (parsedOptions.ok) {
    maybeRecordReviewEvidence({
      options: { ...options, ...parsedOptions.value },
      result,
      report,
      writers,
    });
  }
  return exitCodeFor(result);
}

/** Collect gate execution facts and classify the review evidence. */
const collectReviewEvidence = (
  cliOptions: CliOptions,
  options: RunReviewEvidenceCliOptions,
): ReviewEvidenceResult => {
  const gateCommands = options.gateCommands ?? defaultGateCommands;
  const requiredGates = gateCommands.map(([gate]) => gate);
  const executions = cliOptions.executionEnabled
    ? runGateCommands(gateCommands, options, cliOptions)
    : [];

  return classifyReviewEvidence({
    executionEnabled: cliOptions.executionEnabled,
    executions,
    requiredGates,
    pathAvailability: cliOptions.pathAvailability,
  });
};

/** Run every configured gate command through the shared build-gate runner. */
const runGateCommands = (
  gateCommands: readonly GateCommand[],
  options: RunReviewEvidenceCliOptions,
  cliOptions: CliOptions,
): readonly GateExecution[] => {
  const createRunner = options.createRunner ?? createCommandRunner;
  const commandOptions = {
    cwd: options.cwd ?? cwd(),
    env: options.env ?? process.env,
    timeoutMs: cliOptions.gateTimeoutMs,
    maxBufferBytes: options.maxBufferBytes ?? defaultGateMaxBufferBytes,
  } satisfies CommandRunnerOptions;

  return gateCommands.map(([gate, command, args]) => {
    const result = createRunner(command, commandOptions).run(args);
    return gateExecutionFromResult(gate, result);
  });
};

/** Convert a captured command result into review-evidence gate facts. */
const gateExecutionFromResult = (gate: ReviewGateId, result: CommandResult): GateExecution => {
  if (hasTimedOut(result)) {
    return {
      gate,
      status: "failed",
      exitCode: 1,
      detail: commandFailureDetail(result),
    };
  }

  if (result.error !== undefined) {
    return { gate, status: "unavailable", detail: result.error.message };
  }

  if (result.status !== 0) {
    return {
      gate,
      status: "failed",
      exitCode: result.status ?? 1,
      detail: commandFailureDetail(result),
    };
  }

  return { gate, status: "passed" };
};

/** Treat runner timeouts as failed gates, not missing executables. */
const hasTimedOut = (result: CommandResult): boolean => {
  return result.error?.code === "ETIMEDOUT";
};

/** Preserve useful child-process context without leaking multiline report text. */
const commandFailureDetail = (result: CommandResult): string => {
  const output = result.stderr.trim() || result.stdout.trim();

  if (output.length > 0) {
    return output;
  }

  if (hasTimedOut(result)) {
    return "command timed out";
  }

  return result.signal === null
    ? "command exited non-zero"
    : `command terminated by ${result.signal}`;
};

/** Parse CLI flags into classifier inputs. */
const parseCliArgs = (
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  defaultTimeoutMs: number,
): ParsedCliOptions => {
  const {
    ODW_LINT_REVIEW_EXEC: reviewExecutionMode,
    ODW_LINT_REVIEW_EVIDENCE_PATH: recordEnvironmentPath,
    ODW_LINT_REVIEW_GATE_TIMEOUT_MS: environmentGateTimeoutMs,
  } = env;
  const parsedEnvironmentTimeout = parseEnvironmentGateTimeoutMs(
    environmentGateTimeoutMs,
    defaultTimeoutMs,
  );
  if (!parsedEnvironmentTimeout.ok) {
    return parsedEnvironmentTimeout;
  }
  const parsedPathAvailability = deriveHarnessPathAvailability(env);
  if (!parsedPathAvailability.ok) {
    return parsedPathAvailability;
  }

  let options: CliOptions = {
    executionEnabled: reviewExecutionMode !== "0",
    gateTimeoutMs: parsedEnvironmentTimeout.value,
    pathAvailability: parsedPathAvailability.value,
    shouldRecord: recordEnvironmentPath !== undefined,
  };

  for (const arg of args) {
    const parsedArg = parseCliArg(arg, options);
    if (!parsedArg.ok) {
      return parsedArg;
    }
    options = parsedArg.value;
  }

  return { ok: true, value: options };
};

/** Parse one CLI flag into the accumulated options. */
const parseCliArg = (arg: string, options: CliOptions): ParsedCliOptions => {
  if (arg === "--no-exec") {
    return { ok: true, value: { ...options, executionEnabled: false } };
  }

  const gateTimeoutMsValue = parseFlagValue(arg, "--gate-timeout-ms=");
  if (gateTimeoutMsValue !== undefined) {
    const parsedTimeout = parseGateTimeoutMs(gateTimeoutMsValue, "--gate-timeout-ms");
    if (!parsedTimeout.ok) {
      return parsedTimeout;
    }
    return { ok: true, value: { ...options, gateTimeoutMs: parsedTimeout.value } };
  }

  const availabilityOptions = parseAvailabilityFlag(arg, options);
  if (availabilityOptions !== undefined) {
    return availabilityOptions;
  }

  const recordPath = parseFlagValue(arg, "--record=");
  if (recordPath !== undefined) {
    return { ok: true, value: { ...options, recordPath, shouldRecord: true } };
  }

  return { ok: false, usageError: `unknown option: ${arg}` };
};

/** Parse reviewer availability flags into the accumulated options. */
const parseAvailabilityFlag = (arg: string, options: CliOptions): ParsedCliOptions | undefined => {
  for (const flag of availabilityFlags) {
    const value = parseFlagValue(arg, flag.prefix);
    if (value === undefined) {
      continue;
    }

    const parsed = parseAvailabilityValue(flag.path, value);
    if (!parsed.ok) {
      return parsed;
    }

    return {
      ok: true,
      value: {
        ...options,
        pathAvailability: setPathAvailability(options.pathAvailability, flag.path, parsed.value),
      },
    };
  }

  return undefined;
};
/** Parse the optional environment gate timeout. */
const parseEnvironmentGateTimeoutMs = (
  value: string | undefined,
  defaultTimeoutMs: number,
): ParsedCliOption<number> => {
  if (value === undefined) {
    return { ok: true, value: defaultTimeoutMs };
  }

  return parseGateTimeoutMs(value, "environment");
};
/** Parse the per-gate timeout, rejecting values that would disable the bound. */
const parseGateTimeoutMs = (
  value: string,
  source: "--gate-timeout-ms" | "environment",
): ParsedCliOption<number> => {
  const timeoutMs = Number(value);

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    return { ok: false, usageError: `invalid gate timeout from ${source}: ${value}` };
  }

  return { ok: true, value: timeoutMs };
};

/** Parse `--name=value` flags without accepting bare values. */
const parseFlagValue = (arg: string, prefix: string): string | undefined => {
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
};

/**
 * Map review-evidence statuses to stable process exit codes.
 *
 * @param result Classified review evidence result.
 * @returns Process exit code for reviewer automation.
 */
export const exitCodeFor = (result: ReviewEvidenceResult): ReviewEvidenceExitCode => {
  switch (result.status) {
    case "verified":
      return 0;
    case "failed":
      return 1;
    case "usage-error":
      return 2;
    case "degraded":
      return 3;
    default: {
      return assertNever(result);
    }
  }
};

/** Preserve compile-time exhaustiveness checks for result handling. */
const assertNever = (value: never): never => {
  throw new Error(`unhandled review evidence result: ${JSON.stringify(value)}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runReviewEvidenceCli(process.argv.slice(2));
}
