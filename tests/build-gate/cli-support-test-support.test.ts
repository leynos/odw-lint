/**
 * @file Tests for build-gate command-line support test helpers.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { expectSharedCliEntrypointSeam } from "./cli-entrypoint-test-support";
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

describe("expectSharedCliEntrypointSeam", () => {
  it("accepts a CLI that imports and calls the shared entrypoint helper", () => {
    expectSharedCliEntrypointSeam({
      importPath: "./cli-support",
      source: `
        import { runCliEntrypoint } from "./cli-support";

        runCliEntrypoint({
          moduleUrl: import.meta.url,
          run: () => runCli(process.argv.slice(2)),
        });
      `,
    });
  });

  it("accepts a CLI that uses exitCode mode through the shared helper", () => {
    expectSharedCliEntrypointSeam({
      importPath: "./cli-support",
      source: `
        import { runCliEntrypoint } from "./cli-support";

        runCliEntrypoint({
          mode: "exitCode",
          moduleUrl: import.meta.url,
          run: () => 3,
        });
      `,
    });
  });

  it("accepts an aliased shared entrypoint helper import", () => {
    expectSharedCliEntrypointSeam({
      importPath: "./cli-support",
      source: `
        import { runCliEntrypoint as runEntry } from "./cli-support";

        runEntry({
          moduleUrl: import.meta.url,
          run: () => 0,
        });
      `,
    });
  });

  it("rejects a CLI missing the shared entrypoint import", () => {
    expect(() =>
      expectSharedCliEntrypointSeam({
        importPath: "./cli-support",
        source: `
          export function runCli(): number {
            return 0;
          }
        `,
      }),
    ).toThrow("build-gate CLI must import runCliEntrypoint from ./cli-support");
  });

  it("rejects a CLI that imports but never calls the shared entrypoint helper", () => {
    expect(() =>
      expectSharedCliEntrypointSeam({
        importPath: "./cli-support",
        source: `
          import { runCliEntrypoint } from "./cli-support";

          export function runCli(): number {
            return 0;
          }
        `,
      }),
    ).toThrow("build-gate CLI must call runCliEntrypoint");
  });

  it("rejects an inline process argv direct-execution guard", () => {
    expect(() =>
      expectSharedCliEntrypointSeam({
        importPath: "./cli-support",
        source: `
          import { runCliEntrypoint } from "./cli-support";

          if (process.argv[1] === "cli.ts") {
            runCli();
          }
        `,
      }),
    ).toThrow("build-gate CLI must not inline the run-and-exit guard");
  });

  it("rejects direct process argv argument parsing outside the helper", () => {
    expect(() =>
      expectSharedCliEntrypointSeam({
        importPath: "./cli-support",
        source: `
          import { runCliEntrypoint } from "./cli-support";

          const args = process.argv.slice(2);
          runCliEntrypoint({
            moduleUrl: import.meta.url,
            run: () => runCli(args),
          });
        `,
      }),
    ).toThrow("build-gate CLI must not inline the run-and-exit guard");
  });

  it("rejects direct process exitCode assignment", () => {
    expect(() =>
      expectSharedCliEntrypointSeam({
        importPath: "./cli-support",
        source: `
          import { runCliEntrypoint } from "./cli-support";

          process.exitCode = runCli();
        `,
      }),
    ).toThrow("build-gate CLI must not inline the run-and-exit guard");
  });

  it("rejects direct process exit calls", () => {
    expect(() =>
      expectSharedCliEntrypointSeam({
        importPath: "./cli-support",
        source: `
          import { runCliEntrypoint } from "./cli-support";

          process.exit(runCli());
        `,
      }),
    ).toThrow("build-gate CLI must not inline the run-and-exit guard");
  });
});

describe("build-gate CLI entrypoint seams", () => {
  it("uses the shared entrypoint seam for every discovered build-gate CLI", () => {
    const cliSources = discoveredCliEntrypointSources();

    expect(cliSources.map(({ fileName }) => fileName)).toEqual([
      "branch-freshness-git.ts",
      "review-evidence-artefact-cli.ts",
      "review-evidence-cli.ts",
      "whitespace-hygiene.ts",
    ]);

    for (const { source } of cliSources) {
      expectSharedCliEntrypointSeam({
        importPath: "./cli-support",
        source,
      });
    }
  });
});

type CliSource = {
  readonly fileName: string;
  readonly source: string;
};

/** Return build-gate source files that look like direct CLI entrypoints. */
function discoveredCliEntrypointSources(): readonly CliSource[] {
  return readdirSync(new URL("./", import.meta.url), { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => ({
      fileName: entry.name,
      source: readFileSync(new URL(entry.name, import.meta.url), "utf8"),
    }))
    .filter(({ source }) => isCliEntrypointSource(source))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

/** Identify current and legacy direct-entrypoint modules for seam checks. */
function isCliEntrypointSource(source: string): boolean {
  return (
    source.includes("import.meta.url") &&
    (source.includes("runCliEntrypoint") ||
      source.includes("process.argv[1]") ||
      source.includes("process.exitCode ="))
  );
}
