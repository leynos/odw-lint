/**
 * @file Fresh module graph helper tests.
 */

import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expectFreshModuleGraphSuccess,
  freshModuleGraphFailure,
  freshModuleGraphScript,
  runFreshModuleGraphScript,
} from "./fresh-module-graph";

const repositoryRootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const baseResult = {
  command: ["bun", "--eval", "script"],
  cwd: "/repo",
  error: undefined,
  script: "script",
  signal: null,
  status: 0,
  stderr: "",
  stdout: "",
} satisfies ReturnType<typeof runFreshModuleGraphScript>;

describe("fresh module graph helpers", () => {
  it("builds structured failure scripts in statement order", () => {
    expect(
      freshModuleGraphScript([
        "const value = 1;",
        [
          "if (value !== 1) {",
          '  failFreshModuleGraphCheck({ code: "wrong-value", status: 2 });',
          "}",
        ],
      ]),
    ).toMatchSnapshot();
  });

  it("reports the first failing process condition with context", () => {
    expect({
      clean: freshModuleGraphFailure(baseResult),
      signalBeforeStatus: freshModuleGraphFailure({
        ...baseResult,
        signal: "SIGTERM",
        status: 2,
      }),
      spawnErrorBeforeSignal: freshModuleGraphFailure({
        ...baseResult,
        error: new Error("spawn failed"),
        signal: "SIGTERM",
        status: 2,
        stderr: "stderr",
        stdout: "stdout",
      }),
      statusBeforeOutput: freshModuleGraphFailure({
        ...baseResult,
        status: 2,
        stderr: "stderr",
        stdout: "stdout",
      }),
      stderrAfterStdout: freshModuleGraphFailure({
        ...baseResult,
        stderr: "stderr",
        stdout: "stdout",
      }),
      stdoutBeforeStderr: freshModuleGraphFailure({
        ...baseResult,
        stdout: "stdout",
      }),
    }).toMatchSnapshot();
  });

  it("runs scripts in a subprocess and reports spawn failures", () => {
    const success = runFreshModuleGraphScript({
      cwd: repositoryRootPath,
      executablePath: process.execPath,
      script: "const value = 1;",
    });
    expectFreshModuleGraphSuccess(success);

    const failure = freshModuleGraphFailure(
      runFreshModuleGraphScript({
        cwd: repositoryRootPath,
        executablePath: resolve(repositoryRootPath, "missing-bun-executable"),
        script: "const value = 1;",
      }),
    );

    expect(failure?.reason).toBe("spawn-error");
    expect(failure?.command).toEqual([
      resolve(repositoryRootPath, "missing-bun-executable"),
      "--eval",
      "const value = 1;",
    ]);
  });
});
