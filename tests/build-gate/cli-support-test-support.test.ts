/**
 * @file Tests for build-gate command-line support test helpers.
 */

import { describe, expect, it } from "bun:test";
import { expectSharedCliWriterSeam } from "./cli-support-test-support";

describe("expectSharedCliWriterSeam", () => {
  it("accepts a CLI that imports the shared writer type", () => {
    expectSharedCliWriterSeam({
      importPath: "./cli-support",
      source: `
        import { type CliWriters, resolveCliWriters } from "./cli-support";

        export function runCli(writers: CliWriters = resolveCliWriters()): void {
          writers.writeOut("ok\\n");
        }
      `,
    });
  });

  it("accepts aliased imports from the shared helper", () => {
    expectSharedCliWriterSeam({
      importPath: "./cli-support",
      source: `
        import { type CliWriters as SharedCliWriters, resolveCliWriters } from "./cli-support";

        export function runCli(writers: SharedCliWriters = resolveCliWriters()): void {
          writers.writeOut("ok\\n");
        }
      `,
    });
  });

  it("rejects a local property-shaped writer contract", () => {
    expect(() =>
      expectSharedCliWriterSeam({
        importPath: "./cli-support",
        source: `
          import { type CliWriters, resolveCliWriters } from "./cli-support";

          type LocalWriters = {
            readonly writeOut: (message: string) => void;
            readonly writeErr: (message: string) => void;
          };

          export function runCli(writers: CliWriters = resolveCliWriters()): void {
            writers.writeOut("ok\\n");
          }
        `,
      }),
    ).toThrow("build-gate CLI must not declare local writer contracts: LocalWriters");
  });

  it("rejects a local method-shaped writer contract", () => {
    expect(() =>
      expectSharedCliWriterSeam({
        importPath: "./cli-support",
        source: `
          import { type CliWriters, resolveCliWriters } from "./cli-support";

          interface LocalWriters {
            writeOut(message: string): void;
            writeErr(message: string): void;
          }

          export function runCli(writers: CliWriters = resolveCliWriters()): void {
            writers.writeOut("ok\\n");
          }
        `,
      }),
    ).toThrow("build-gate CLI must not declare local writer contracts: LocalWriters");
  });

  it("rejects a nested local writer contract", () => {
    expect(() =>
      expectSharedCliWriterSeam({
        importPath: "./cli-support",
        source: `
          import { type CliWriters, resolveCliWriters } from "./cli-support";

          export function runCli(writers: CliWriters = resolveCliWriters()): void {
            type LocalWriters = {
              readonly writeOut: (message: string) => void;
              readonly writeErr: (message: string) => void;
            };
            const local: LocalWriters = writers;
            local.writeOut("ok\\n");
          }
        `,
      }),
    ).toThrow("build-gate CLI must not declare local writer contracts: LocalWriters");
  });

  it("rejects a wrapped local writer contract", () => {
    expect(() =>
      expectSharedCliWriterSeam({
        importPath: "./cli-support",
        source: `
          import { type CliWriters, resolveCliWriters } from "./cli-support";

          type LocalWriters = Readonly<{
            readonly writeOut: (message: string) => void;
            readonly writeErr: (message: string) => void;
          }>;

          export function runCli(writers: CliWriters = resolveCliWriters()): void {
            writers.writeOut("ok\\n");
          }
        `,
      }),
    ).toThrow("build-gate CLI must not declare local writer contracts: LocalWriters");
  });

  it("rejects a class-shaped writer contract", () => {
    expect(() =>
      expectSharedCliWriterSeam({
        importPath: "./cli-support",
        source: `
          import { type CliWriters, resolveCliWriters } from "./cli-support";

          class LocalWriters {
            writeOut(message: string): void {
              process.stdout.write(message);
            }

            writeErr(message: string): void {
              process.stderr.write(message);
            }
          }

          export function runCli(writers: CliWriters = resolveCliWriters()): void {
            writers.writeOut("ok\\n");
          }
        `,
      }),
    ).toThrow("build-gate CLI must not declare local writer contracts: LocalWriters");
  });

  it("rejects a local default process-stream writer object", () => {
    expect(() =>
      expectSharedCliWriterSeam({
        importPath: "./cli-support",
        source: `
          import { stderr, stdout } from "node:process";
          import { type CliWriters } from "./cli-support";

          export function runCli(
            writers: CliWriters = {
              writeOut: (message) => stdout.write(message),
              writeErr: (message) => stderr.write(message),
            },
          ): void {
            writers.writeOut("ok\\n");
          }
        `,
      }),
    ).toThrow("build-gate CLI must not inline default process-stream writer objects");
  });

  it("allows unrelated local stdout and stderr names", () => {
    expectSharedCliWriterSeam({
      importPath: "./cli-support",
      source: `
        import { type CliWriters, resolveCliWriters } from "./cli-support";

        const stdout = { write: (message: string) => message.length };
        const stderr = { write: (message: string) => message.length };

        export function runCli(writers: CliWriters = resolveCliWriters()): void {
          stdout.write("audit");
          stderr.write("audit");
          writers.writeOut("ok\\n");
        }
      `,
    });
  });
});
