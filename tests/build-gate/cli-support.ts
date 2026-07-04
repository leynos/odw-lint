/**
 * @file Shared test-only command-line entrypoint, writer, and report dispatch support for build gates.
 */

import { argv, exit as processExit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

/** Output writers shared by build-gate command-line entry points. */
export type CliWriters = {
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

/** Optional writer overrides that tolerate forwarded `undefined` fields. */
export type CliWriterOverrides = {
  readonly writeOut?: CliWriters["writeOut"] | undefined;
  readonly writeErr?: CliWriters["writeErr"] | undefined;
};

/** How a build-gate CLI terminates the process after producing an exit code. */
export type CliEntrypointMode = "exit" | "exitCode";

/** Injectable process-termination seam for entrypoint tests. */
export type CliEntrypointHost = {
  readonly invokedPath: string | undefined;
  readonly exit: (code: number) => void;
  readonly setExitCode: (code: number) => void;
};

const defaultCliEntrypointHost: CliEntrypointHost = {
  invokedPath: argv[1],
  exit: processExit,
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

/**
 * Run a build-gate CLI when its module was executed directly.
 *
 * @param params Module URL, CLI runner, termination mode, and optional host.
 */
export function runCliEntrypoint(params: {
  readonly moduleUrl: string;
  readonly run: () => number;
  readonly mode?: CliEntrypointMode;
  readonly host?: CliEntrypointHost;
}): void {
  const host = params.host ?? defaultCliEntrypointHost;

  if (host.invokedPath === undefined) {
    return;
  }

  if (host.invokedPath !== fileURLToPath(params.moduleUrl)) {
    return;
  }

  const code = params.run();
  if ((params.mode ?? "exit") === "exitCode") {
    host.setExitCode(code);
    return;
  }

  host.exit(code);
}

/**
 * Resolve CLI writers, defaulting to the real process streams.
 *
 * @param overrides Optional writer overrides used by focused tests.
 * @returns Complete output and error writer pair.
 */
export function resolveCliWriters(overrides: CliWriterOverrides = {}): CliWriters {
  return {
    writeOut: overrides.writeOut ?? ((message) => void stdout.write(message)),
    writeErr: overrides.writeErr ?? ((message) => void stderr.write(message)),
  };
}

/**
 * Send one formatted report to the selected stream.
 *
 * @param params Formatted report, target-stream choice, and resolved writers.
 */
export function emitCliReport(params: {
  readonly report: string;
  readonly toErr: boolean;
  readonly writers: CliWriters;
}): void {
  const write = params.toErr ? params.writers.writeErr : params.writers.writeOut;
  write(params.report);
}
