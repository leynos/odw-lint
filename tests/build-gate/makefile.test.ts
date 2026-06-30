/**
 * @file Makefile build-gate dependency freshness tests.
 */

import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageInput = "package.json" | "bun.lock";

type PackageInputTime = {
  readonly file: PackageInput;
  readonly mtime: Date;
};

type MakeDryRunResult = {
  readonly status: number | null;
  readonly output: string;
};

type MakeTarget = "build" | "refresh-fixtures";

const olderThanMarker = new Date("2026-01-01T00:00:00.000Z");
const markerTime = new Date("2026-01-01T00:01:00.000Z");
const newerThanMarker = new Date("2026-01-01T00:02:00.000Z");

const packageInputs: readonly PackageInput[] = ["package.json", "bun.lock"];
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Create an isolated project that exercises the repository Makefile.
 */
function createTemporaryProject(inputTimes: readonly PackageInputTime[]): string {
  const projectPath = mkdtempSync(join(tmpdir(), "odw-lint-makefile-"));

  copyFileSync(join(repositoryRoot, "Makefile"), join(projectPath, "Makefile"));

  for (const file of packageInputs) {
    writeFileSync(join(projectPath, file), "{}\n");
    utimesSync(join(projectPath, file), olderThanMarker, olderThanMarker);
  }

  mkdirSync(join(projectPath, "node_modules"));
  utimesSync(join(projectPath, "node_modules"), markerTime, markerTime);

  for (const inputTime of inputTimes) {
    utimesSync(join(projectPath, inputTime.file), inputTime.mtime, inputTime.mtime);
  }

  return projectPath;
}

/**
 * Run a Make target in dry-run mode without performing build actions.
 */
function runMakeDryRun(cwd: string, target: MakeTarget): MakeDryRunResult {
  const result = spawnSync("make", ["--dry-run", "--no-print-directory", target], {
    cwd,
    encoding: "utf8",
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

/**
 * Assert whether Make schedules dependency installation for package input mtimes.
 */
function expectInstallScheduling(
  inputTimes: readonly PackageInputTime[],
  shouldInstall: boolean,
): void {
  const projectPath = createTemporaryProject(inputTimes);

  try {
    const result = runMakeDryRun(projectPath, "build");

    expect(result.status).toBe(0);
    expect(result.output.includes("bun install")).toBe(shouldInstall);
  } finally {
    rmSync(projectPath, { recursive: true, force: true });
  }
}

describe("Makefile build gate", () => {
  it("keeps installed dependencies when package inputs are older than node_modules", () => {
    expectInstallScheduling([], false);
  });

  it("installs dependencies when package.json is newer than node_modules", () => {
    expectInstallScheduling([{ file: "package.json", mtime: newerThanMarker }], true);
  });

  it("keeps installed dependencies when package.json matches node_modules freshness", () => {
    expectInstallScheduling([{ file: "package.json", mtime: markerTime }], false);
  });

  it("installs dependencies when bun.lock is newer than node_modules", () => {
    expectInstallScheduling([{ file: "bun.lock", mtime: newerThanMarker }], true);
  });

  it("keeps installed dependencies when bun.lock matches node_modules freshness", () => {
    expectInstallScheduling([{ file: "bun.lock", mtime: markerTime }], false);
  });

  it("documents the fixture refresh target and wires it through Bun", () => {
    const projectPath = createTemporaryProject([]);

    try {
      const result = runMakeDryRun(projectPath, "refresh-fixtures");

      expect(result.status).toBe(0);
      expect(result.output).toContain("bun run tests/static-analysis/fixtures/refresh-metadata.ts");
      expect(result.output).not.toContain("bun install");
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });
});
