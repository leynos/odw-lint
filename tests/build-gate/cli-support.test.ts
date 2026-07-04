/**
 * @file Tests for shared build-gate command-line writer support.
 */

import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { withProcessStreamWriteHarness } from "./cli-stream-test-support";
import { emitCliReport, resolveCliWriters, runCliEntrypoint } from "./cli-support";

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

describe("runCliEntrypoint", () => {
  const moduleUrl = import.meta.url;
  const modulePath = fileURLToPath(moduleUrl);

  it("hard-exits with the runner exit code when the module path matches", () => {
    const calls: string[] = [];

    runCliEntrypoint({
      host: {
        invokedPath: modulePath,
        exit: (code) => calls.push(`exit:${code}`),
        setExitCode: (code) => calls.push(`exitCode:${code}`),
      },
      moduleUrl,
      run: () => {
        calls.push("run");
        return 7;
      },
    });

    expect(calls).toEqual(["run", "exit:7"]);
  });

  it("sets the process exit code in exitCode mode when the module path matches", () => {
    const calls: string[] = [];

    runCliEntrypoint({
      host: {
        invokedPath: modulePath,
        exit: (code) => calls.push(`exit:${code}`),
        setExitCode: (code) => calls.push(`exitCode:${code}`),
      },
      mode: "exitCode",
      moduleUrl,
      run: () => {
        calls.push("run");
        return 3;
      },
    });

    expect(calls).toEqual(["run", "exitCode:3"]);
  });

  it.each([
    ["a different module path", "/tmp/other-cli.ts"],
    ["no invoked path", undefined],
  ] as const)("does not run the CLI for %s", (_description, invokedPath) => {
    const calls: string[] = [];

    runCliEntrypoint({
      host: {
        invokedPath,
        exit: (code) => calls.push(`exit:${code}`),
        setExitCode: (code) => calls.push(`exitCode:${code}`),
      },
      moduleUrl,
      run: () => {
        calls.push("run");
        return 1;
      },
    });

    expect(calls).toEqual([]);
  });
});
