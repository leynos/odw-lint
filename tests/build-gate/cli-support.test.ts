/**
 * @file Tests for shared build-gate command-line writer support.
 */

import { describe, expect, it } from "bun:test";
import { withProcessStreamWriteHarness } from "./cli-stream-test-support";
import { emitCliReport, resolveCliWriters } from "./cli-support";

describe("resolveCliWriters", () => {
  it("uses process streams when no writers are provided", () => {
    withProcessStreamWriteHarness((streamWrites) => {
      streamWrites.useCapturedStdout();
      streamWrites.useCapturedStderr();

      const writers = resolveCliWriters();

      writers.writeOut("ready\n");
      writers.writeErr("failed\n");

      expect(streamWrites.writes).toEqual(["stdout:ready\n", "stderr:failed\n"]);
    });
  });

  it("mixes explicit writer overrides with default process streams", () => {
    withProcessStreamWriteHarness((streamWrites) => {
      streamWrites.useCapturedStderr();

      const writers = resolveCliWriters({
        writeOut: (message) => streamWrites.recordWrite("custom", message),
      });

      writers.writeOut("custom\n");
      writers.writeErr("default\n");

      expect(streamWrites.writes).toEqual(["custom:custom\n", "stderr:default\n"]);
    });
  });

  it("falls back to defaults for explicitly undefined overrides", () => {
    withProcessStreamWriteHarness((streamWrites) => {
      streamWrites.useCapturedStdout();
      streamWrites.useCapturedStderr();

      const writers = resolveCliWriters({
        writeOut: undefined,
        writeErr: undefined,
      });

      writers.writeOut("default out\n");
      writers.writeErr("default err\n");

      expect(streamWrites.writes).toEqual(["stdout:default out\n", "stderr:default err\n"]);
    });
  });
});

describe("emitCliReport", () => {
  it("writes stdout reports only to the output writer", () => {
    const writes: string[] = [];

    emitCliReport({
      report: "passed\n",
      toErr: false,
      writers: {
        writeOut: (message) => writes.push(`out:${message}`),
        writeErr: (message) => writes.push(`err:${message}`),
      },
    });

    expect(writes).toEqual(["out:passed\n"]);
  });

  it("writes stderr reports only to the error writer", () => {
    const writes: string[] = [];

    emitCliReport({
      report: "failed\n",
      toErr: true,
      writers: {
        writeOut: (message) => writes.push(`out:${message}`),
        writeErr: (message) => writes.push(`err:${message}`),
      },
    });

    expect(writes).toEqual(["err:failed\n"]);
  });
});
