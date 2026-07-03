/**
 * @file Tests for shared build-gate command-line writer support.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { stderr, stdout } from "node:process";
import { emitCliReport, resolveCliWriters } from "./cli-support";

type StreamWrite = typeof stdout.write;

const originalStdoutWrite = stdout.write.bind(stdout) as StreamWrite;
const originalStderrWrite = stderr.write.bind(stderr) as StreamWrite;

afterEach(() => {
  stdout.write = originalStdoutWrite;
  stderr.write = originalStderrWrite;
});

describe("resolveCliWriters", () => {
  it("uses process streams when no writers are provided", () => {
    const writes: string[] = [];
    stdout.write = ((message: string) => {
      writes.push(`stdout:${message}`);
      return true;
    }) as StreamWrite;
    stderr.write = ((message: string) => {
      writes.push(`stderr:${message}`);
      return true;
    }) as StreamWrite;

    const writers = resolveCliWriters();

    writers.writeOut("ready\n");
    writers.writeErr("failed\n");

    expect(writes).toEqual(["stdout:ready\n", "stderr:failed\n"]);
  });

  it("mixes explicit writer overrides with default process streams", () => {
    const writes: string[] = [];
    stderr.write = ((message: string) => {
      writes.push(`stderr:${message}`);
      return true;
    }) as StreamWrite;

    const writers = resolveCliWriters({
      writeOut: (message) => writes.push(`out:${message}`),
    });

    writers.writeOut("custom\n");
    writers.writeErr("default\n");

    expect(writes).toEqual(["out:custom\n", "stderr:default\n"]);
  });

  it("falls back to defaults for explicitly undefined overrides", () => {
    const writes: string[] = [];
    stdout.write = ((message: string) => {
      writes.push(`stdout:${message}`);
      return true;
    }) as StreamWrite;
    stderr.write = ((message: string) => {
      writes.push(`stderr:${message}`);
      return true;
    }) as StreamWrite;

    const writers = resolveCliWriters({
      writeOut: undefined,
      writeErr: undefined,
    });

    writers.writeOut("default out\n");
    writers.writeErr("default err\n");

    expect(writes).toEqual(["stdout:default out\n", "stderr:default err\n"]);
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
