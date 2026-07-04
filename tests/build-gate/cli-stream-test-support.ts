/**
 * @file Process stream capture support for build-gate CLI tests.
 */

import { stderr, stdout } from "node:process";

type StreamWrite = typeof stdout.write;
type CapturedStreamName = "custom" | "stderr" | "stdout";

type ProcessStreamWriteHarness = {
  readonly writes: readonly string[];
  readonly recordWrite: (streamName: CapturedStreamName, message: string) => void;
  readonly useCapturedStdout: () => void;
  readonly useCapturedStderr: () => void;
};

/**
 * Override process stream writers for one test body and always restore them.
 *
 * @param testBody Test body that installs captured stream writers as needed.
 * @throws Error when the test body throws while using captured writers.
 */
export function withProcessStreamWriteHarness(
  testBody: (harness: ProcessStreamWriteHarness) => void,
): void {
  const originalStdoutWrite = stdout.write;
  const originalStderrWrite = stderr.write;
  const writes: string[] = [];

  const captureStdout = captureStreamWrite(writes, "stdout");
  const captureStderr = captureStreamWrite(writes, "stderr");

  try {
    testBody({
      writes,
      recordWrite: (streamName, message) => recordStreamWrite(writes, streamName, message),
      useCapturedStdout: () => {
        stdout.write = captureStdout;
      },
      useCapturedStderr: () => {
        stderr.write = captureStderr;
      },
    });
  } finally {
    stdout.write = originalStdoutWrite;
    stderr.write = originalStderrWrite;
  }
}

/** Create a process stream writer that records tagged messages. */
function captureStreamWrite(writes: string[], streamName: "stderr" | "stdout"): StreamWrite {
  return ((message: string) => {
    recordStreamWrite(writes, streamName, message);
    return true;
  }) as StreamWrite;
}

/** Record one write using the harness-wide stream tag format. */
function recordStreamWrite(
  writes: string[],
  streamName: CapturedStreamName,
  message: string,
): void {
  writes.push(`${streamName}:${message}`);
}
