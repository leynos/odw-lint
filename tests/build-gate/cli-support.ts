/**
 * @file Shared test-only command-line writer and report dispatch for build gates.
 */

import { stderr, stdout } from "node:process";

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
