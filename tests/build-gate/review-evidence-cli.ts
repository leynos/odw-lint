/**
 * @file Reviewer-run CLI for independent roadmap audit evidence.
 */

import { cwd, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
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
  type ReviewPath,
  type ReviewPathAvailability,
} from "./review-evidence";
import { formatReviewEvidenceResult } from "./review-evidence-report";

export type GateCommand = readonly [ReviewGateId, string, readonly string[]];
export type ReviewEvidenceExitCode = 0 | 1 | 2 | 3;

type CliWriters = {
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

type CliOptions = {
  readonly executionEnabled: boolean;
  readonly gateTimeoutMs: number;
  readonly pathAvailability: Readonly<Record<ReviewPath, ReviewPathAvailability>>;
};

type ParsedCliOptions = CliOptions | { readonly usageError: string };

export type RunReviewEvidenceCliOptions = {
  readonly createRunner?: (command: string, options?: CommandRunnerOptions) => CommandRunner;
  readonly gateCommands?: readonly GateCommand[];
  readonly writeOut?: (message: string) => void;
  readonly writeErr?: (message: string) => void;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
};

const defaultGateCommands: readonly GateCommand[] = [
  ["make all", "make", ["all"]],
  ["make markdownlint", "make", ["markdownlint"]],
  ["make nixie", "make", ["nixie"]],
];

const defaultGateTimeoutMs = 5 * 60 * 1000;
const defaultGateMaxBufferBytes = 64 * 1024 * 1024;
const reviewerAvailabilityValues = [
  "available",
  "quota-blocked",
  "unavailable",
  "no-output",
] as const;
const defaultPathAvailability = {
  scrutineer: "available",
  coderabbit: "available",
  "local-self-run": "available",
} as const;

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
  const result =
    "usageError" in parsedOptions
      ? ({
          status: "usage-error",
          message: parsedOptions.usageError,
        } satisfies ReviewEvidenceResult)
      : collectReviewEvidence(parsedOptions, options);
  const report = formatReviewEvidenceResult(result);
  const writers = cliWriters(options);

  if (result.status === "usage-error") {
    writers.writeErr(report);
  } else {
    writers.writeOut(report);
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
    ODW_LINT_REVIEW_GATE_TIMEOUT_MS: environmentGateTimeoutMs,
  } = env;
  const parsedEnvironmentTimeout = parseEnvironmentGateTimeoutMs(
    environmentGateTimeoutMs,
    defaultTimeoutMs,
  );
  if (typeof parsedEnvironmentTimeout === "string") {
    return { usageError: parsedEnvironmentTimeout };
  }

  let options: CliOptions = {
    executionEnabled: reviewExecutionMode !== "0",
    gateTimeoutMs: parsedEnvironmentTimeout.value,
    pathAvailability: defaultPathAvailability,
  };

  for (const arg of args) {
    const parsedArg = parseCliArg(arg, options);
    if (typeof parsedArg === "string") {
      return { usageError: parsedArg };
    }
    options = parsedArg;
  }

  return options;
};

/** Parse one CLI flag into the accumulated options. */
const parseCliArg = (arg: string, options: CliOptions): CliOptions | string => {
  if (arg === "--no-exec") {
    return { ...options, executionEnabled: false };
  }

  const gateTimeoutMsValue = parseFlagValue(arg, "--gate-timeout-ms=");
  if (gateTimeoutMsValue !== undefined) {
    const parsedTimeout = parseGateTimeoutMs(gateTimeoutMsValue, "--gate-timeout-ms");
    if (typeof parsedTimeout === "string") {
      return parsedTimeout;
    }
    return { ...options, gateTimeoutMs: parsedTimeout.value };
  }

  const scrutineerValue = parseFlagValue(arg, "--scrutineer=");
  if (scrutineerValue !== undefined) {
    const parsed = parseAvailability("scrutineer", scrutineerValue);
    if (typeof parsed === "string") {
      return parsed;
    }
    return setPathAvailability(options, "scrutineer", parsed.value);
  }

  const coderabbitValue = parseFlagValue(arg, "--coderabbit=");
  if (coderabbitValue !== undefined) {
    const parsed = parseAvailability("coderabbit", coderabbitValue);
    if (typeof parsed === "string") {
      return parsed;
    }
    return setPathAvailability(options, "coderabbit", parsed.value);
  }

  return `unknown option: ${arg}`;
};

/** Parse the optional environment gate timeout. */
const parseEnvironmentGateTimeoutMs = (
  value: string | undefined,
  defaultTimeoutMs: number,
): { readonly value: number } | string => {
  if (value === undefined) {
    return { value: defaultTimeoutMs };
  }

  return parseGateTimeoutMs(value, "environment");
};

/** Update one review-path availability flag without dropping other paths. */
const setPathAvailability = (
  options: CliOptions,
  path: "scrutineer" | "coderabbit",
  value: ReviewPathAvailability,
): CliOptions => {
  return {
    ...options,
    pathAvailability: {
      ...options.pathAvailability,
      [path]: value,
    },
  };
};

/** Parse the per-gate timeout, rejecting values that would disable the bound. */
const parseGateTimeoutMs = (
  value: string,
  source: "--gate-timeout-ms" | "environment",
): { readonly value: number } | string => {
  const timeoutMs = Number(value);

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    return `invalid gate timeout from ${source}: ${value}`;
  }

  return { value: timeoutMs };
};

/** Parse `--name=value` flags without accepting bare values. */
const parseFlagValue = (arg: string, prefix: string): string | undefined => {
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
};

/** Parse reviewer availability with a stable usage-error message. */
const parseAvailability = (
  name: "scrutineer" | "coderabbit",
  value: string,
): { readonly value: ReviewPathAvailability } | string => {
  if (reviewerAvailabilityValues.includes(value as ReviewPathAvailability)) {
    return { value: value as ReviewPathAvailability };
  }

  return `invalid ${name} availability: ${value}`;
};

/** Resolve output writers for tests and the real CLI. */
const cliWriters = (options: RunReviewEvidenceCliOptions): CliWriters => ({
  writeOut: options.writeOut ?? ((message) => stdout.write(message)),
  writeErr: options.writeErr ?? ((message) => stderr.write(message)),
});

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
