/**
 * @file Fixture metadata refresh CLI and import-safety tests.
 */

import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeReportForAssertion } from "./fixture-metadata-refresh-assertions";
import { createTempRefreshWorkspace, runRefreshCli } from "./fixture-metadata-refresh-workspace";
import type { FixtureRefreshReport } from "./fixtures/refresh-metadata";
import {
  expectFreshModuleGraphSuccess,
  freshModuleGraphScript,
  runFreshModuleGraphScript,
} from "./fresh-module-graph";

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
    const result = runFreshModuleGraphScript({
      cwd: repositoryRootPath,
      executablePath: process.execPath,
      script: freshModuleGraphScript([
        "globalThis.__odwLintHostileMetadataWasEvaluated = undefined;",
        'const module = await import("./tests/static-analysis/fixtures/refresh-metadata.ts");',
        [
          'if (module.deriveSha256("safe").length !== 64) {',
          '  failFreshModuleGraphCheck({ code: "unexpected-digest", status: 2 });',
          "}",
        ],
        [
          "if (globalThis.__odwLintHostileMetadataWasEvaluated !== undefined) {",
          '  failFreshModuleGraphCheck({ code: "hostile-marker-set", status: 3 });',
          "}",
        ],
      ]),
    });

    expectFreshModuleGraphSuccess(result);
  });
});
