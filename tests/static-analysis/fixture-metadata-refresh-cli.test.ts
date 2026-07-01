/**
 * @file Fixture metadata refresh CLI and import-safety tests.
 */

import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeReportForAssertion } from "./fixture-metadata-refresh-assertions";
import { createTempRefreshWorkspace, runRefreshCli } from "./fixture-metadata-refresh-workspace";
import type { FixtureRefreshReport } from "./fixtures/refresh-metadata";

declare global {
  // The hostile fixture writes this marker only if source is evaluated.
  var __odwLintHostileMetadataWasEvaluated: string | undefined;
}

const repositoryRootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("fixture metadata refresh CLI", () => {
  it("prints a parseable dry-run report from the CLI", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const result = runRefreshCli(["--dry-run"], temp);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const report = JSON.parse(String(result.stdout)) as FixtureRefreshReport;
      expect(report.mode).toBe("dry-run");
      expect(report.failures).toEqual([]);
      expect(report.managedPaths.length).toBeGreaterThan(0);
      expect(report.wouldWritePaths.length).toBeGreaterThan(0);
      expect(normalizeReportForAssertion(report)).toMatchSnapshot();
    } finally {
      temp.remove();
    }
  });

  it("prints actionable CLI failures to stderr", () => {
    const temp = createTempRefreshWorkspace({ omitExample: "routing.js" });
    try {
      const result = runRefreshCli(["--dry-run"], temp);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      const report = JSON.parse(String(result.stderr)) as FixtureRefreshReport;
      expect(report.failures.length).toBeGreaterThan(0);
      expect(
        report.failures.some(
          (failure) =>
            failure.code === "missing-upstream-example" && failure.message.includes("routing.js"),
        ),
      ).toBeTrue();
      expect(normalizeReportForAssertion(report)).toMatchSnapshot();
    } finally {
      temp.remove();
    }
  });

  it("stays import-safe for hostile metadata fixtures in a fresh module graph", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--eval",
        [
          "globalThis.__odwLintHostileMetadataWasEvaluated = undefined;",
          'const module = await import("./tests/static-analysis/fixtures/refresh-metadata.ts");',
          'if (module.deriveSha256("safe").length !== 64) process.exit(2);',
          "if (globalThis.__odwLintHostileMetadataWasEvaluated !== undefined) process.exit(3);",
        ].join("\n"),
      ],
      {
        cwd: repositoryRootPath,
        encoding: "utf8",
        timeout: 5_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
