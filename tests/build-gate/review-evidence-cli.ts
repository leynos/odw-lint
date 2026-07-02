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
const reviewerAvailabilityValues = ["available", "quota-blocked", "unavailable"] as const;
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
  const parsedOptions = parseCliArgs(args, env);
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
  const executions = cliOptions.executionEnabled ? runGateCommands(gateCommands, options) : [];

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
): readonly GateExecution[] => {
  const createRunner = options.createRunner ?? createCommandRunner;
  const commandOptions = {
    cwd: options.cwd ?? cwd(),
    env: options.env ?? process.env,
    timeoutMs: options.timeoutMs ?? defaultGateTimeoutMs,
    maxBufferBytes: options.maxBufferBytes ?? defaultGateMaxBufferBytes,
  } satisfies CommandRunnerOptions;

  return gateCommands.map(([gate, command, args]) => {
    const result = createRunner(command, commandOptions).run(args);
    return gateExecutionFromResult(gate, result);
  });
};

/** Convert a captured command result into review-evidence gate facts. */
const gateExecutionFromResult = (gate: ReviewGateId, result: CommandResult): GateExecution => {
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

/** Preserve useful child-process context without leaking multiline report text. */
const commandFailureDetail = (result: CommandResult): string => {
  const output = result.stderr.trim() || result.stdout.trim();

  if (output.length > 0) {
    return output;
  }

  return result.signal === null
    ? "command exited non-zero"
    : `command terminated by ${result.signal}`;
};

/** Parse CLI flags into classifier inputs. */
const parseCliArgs = (args: readonly string[], env: NodeJS.ProcessEnv): ParsedCliOptions => {
  const { ODW_LINT_REVIEW_EXEC: reviewExecutionMode } = env;
  let executionEnabled = reviewExecutionMode !== "0";
  let scrutineer: ReviewPathAvailability = defaultPathAvailability.scrutineer;
  let coderabbit: ReviewPathAvailability = defaultPathAvailability.coderabbit;

  for (const arg of args) {
    if (arg === "--no-exec") {
      executionEnabled = false;
      continue;
    }

    const scrutineerValue = parseFlagValue(arg, "--scrutineer=");
    if (scrutineerValue !== undefined) {
      const parsed = parseAvailability("scrutineer", scrutineerValue);
      if (typeof parsed === "string") {
        return { usageError: parsed };
      }
      scrutineer = parsed.value;
      continue;
    }

    const coderabbitValue = parseFlagValue(arg, "--coderabbit=");
    if (coderabbitValue !== undefined) {
      const parsed = parseAvailability("coderabbit", coderabbitValue);
      if (typeof parsed === "string") {
        return { usageError: parsed };
      }
      coderabbit = parsed.value;
      continue;
    }

    return { usageError: `unknown option: ${arg}` };
  }

  return {
    executionEnabled,
    pathAvailability: {
      scrutineer,
      coderabbit,
      "local-self-run": defaultPathAvailability["local-self-run"],
    },
  };
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
