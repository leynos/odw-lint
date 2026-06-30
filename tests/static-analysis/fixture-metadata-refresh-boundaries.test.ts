/**
 * @file Boundary failure tests for fixture metadata refresh.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createTempRefreshWorkspace } from "./fixture-metadata-refresh-workspace";
import { type FixtureRefreshReport, refreshFixtureMetadata } from "./fixtures/refresh-metadata";
import { managedTargetFailure } from "./fixtures/refresh-targets";

const repositoryRootPath = resolve(import.meta.dir, "../..");
const expectedCounts: FixtureRefreshReport["counts"] = {
  odwExamples: 9,
  masking: 9,
  invalidWorkflows: 14,
  hostileMetadata: 2,
  invalidDiagnostics: 14,
  totalFixtures: 32,
};

describe("fixture metadata refresh boundary failures", () => {
  it("reports non-file refresh URLs as invalid arguments", () => {
    const report = refreshFixtureMetadata({
      repositoryRoot: new URL("https://example.test/repository/"),
      odwReferenceCheckout: pathToFileURL(repositoryRootPath),
      shouldWrite: false,
    });

    expect(report.mode).toBe("dry-run");
    expect(report.counts).toEqual(expectedCounts);
    expect(report.repositoryRoot).toBe("https://example.test/repository/");
    expect(report.odwReferenceCheckout).toBe(repositoryRootPath);
    expect(report.managedPaths).toEqual([]);
    expect(normalizeBoundaryFailures(report)).toMatchSnapshot();
    expect(report.failures[0]?.code).toBe("invalid-arguments");
    expect(report.failures[0]?.message).toContain("repositoryRoot");
  });

  it("reports malformed file URLs as invalid arguments", () => {
    const report = refreshFixtureMetadata({
      repositoryRoot: new URL("file:///tmp/%2Fnot-a-directory"),
      odwReferenceCheckout: pathToFileURL(repositoryRootPath),
      shouldWrite: false,
    });

    expect(report.mode).toBe("dry-run");
    expect(report.counts).toEqual(expectedCounts);
    expect(report.managedPaths).toEqual([]);
    expect(normalizeBoundaryFailures(report)).toMatchSnapshot();
    expect(report.failures[0]?.code).toBe("invalid-arguments");
    expect(report.failures[0]?.message).toContain("valid file");
  });

  it("reports file-valued repository roots as invalid arguments", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const fileRepositoryRoot = join(temp.repositoryRoot, "not-a-directory");
      writeFileSync(fileRepositoryRoot, "not a repository\n");
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(fileRepositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: false,
      });

      expect(report.mode).toBe("dry-run");
      expect(report.counts).toEqual(expectedCounts);
      expect(report.repositoryRoot).toBe(fileRepositoryRoot);
      expect(report.odwReferenceCheckout).toBe(temp.odwReferenceCheckout);
      expect(report.managedPaths).toEqual([]);
      expect(normalizeBoundaryFailures(report)).toMatchSnapshot();
      expect(report.failures[0]?.code).toBe("invalid-arguments");
      expect(report.failures[0]?.message).toContain("not a directory");
    } finally {
      temp.remove();
    }
  });

  it("reports file-valued ODW reference checkouts as missing directories", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const fileCheckout = join(temp.odwReferenceCheckout, "not-a-directory");
      writeFileSync(fileCheckout, "not a checkout\n");
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(fileCheckout),
        shouldWrite: false,
      });

      expect(report.mode).toBe("dry-run");
      expect(report.counts).toEqual(expectedCounts);
      expect(report.repositoryRoot).toBe(temp.repositoryRoot);
      expect(report.odwReferenceCheckout).toBe(fileCheckout);
      expect(report.managedPaths).toEqual([]);
      expect(normalizeBoundaryFailures(report)).toMatchSnapshot();
      expect(report.failures[0]?.code).toBe("missing-odw-reference-checkout");
      expect(report.failures[0]?.message).toContain("not a directory");
    } finally {
      temp.remove();
    }
  });

  it("reports directory placeholders for upstream ODW examples", () => {
    const temp = createTempRefreshWorkspace({ omitExample: "routing.js" });
    try {
      mkdirSync(join(temp.odwReferenceCheckout, "examples", "routing.js"));
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: true,
      });

      expect(report.mode).toBe("write");
      expect(report.counts).toEqual(expectedCounts);
      expect(report.failures[0]?.code).toBe("missing-upstream-example");
      expect(report.failures[0]?.path).toContain("routing.js");
      expect(report.writtenPaths).toEqual([]);
      expect(normalizeBoundaryFailures(report)).toMatchSnapshot();
    } finally {
      rmSync(join(temp.odwReferenceCheckout, "examples", "routing.js"), {
        recursive: true,
        force: true,
      });
      temp.remove();
    }
  });

  it("rejects managed fixture paths outside the repository root", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const failure = managedTargetFailure(pathToFileURL(temp.repositoryRoot), "../escape.js");

      expect(failure?.code).toBe("invalid-arguments");
      expect(failure?.message).toContain("escapes the repository root");
    } finally {
      temp.remove();
    }
  });

  it("reports non-regular managed targets before writing", () => {
    const temp = createTempRefreshWorkspace();
    try {
      mkdirSync(
        join(temp.repositoryRoot, "tests/static-analysis/fixtures/odw-examples/routing.js"),
        { recursive: true },
      );
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: true,
      });

      expect(report.failures[0]?.code).toBe("invalid-arguments");
      expect(report.failures[0]?.message).toContain("not a regular file");
      expect(report.writtenPaths).toEqual([]);
      expect(report.unchangedPaths).toEqual([]);
    } finally {
      rmSync(join(temp.repositoryRoot, "tests/static-analysis/fixtures/odw-examples/routing.js"), {
        recursive: true,
        force: true,
      });
      temp.remove();
    }
  });
});

/**
 * Removes temp-directory detail while preserving failure structure.
 */
const normalizeBoundaryFailures = (
  report: FixtureRefreshReport,
): FixtureRefreshReport["failures"] =>
  report.failures.map((failure) => ({
    ...failure,
    message: normalizePath(failure.message),
    path: failure.path === null ? null : normalizePath(failure.path),
  }));

/**
 * Replaces local absolute paths in boundary reports with stable placeholders.
 */
const normalizePath = (value: string): string =>
  normalizeSeparators(value)
    .replaceAll(normalizeSeparators(repositoryRootPath), "<repositoryRoot>")
    .replace(
      new RegExp(`${escapeRegExp(normalizeSeparators(tmpdir()))}/odw-lint-refresh-[^/]+`, "g"),
      "<temp>",
    );

/**
 * Normalizes path separators before snapshot placeholder replacement.
 */
const normalizeSeparators = (value: string): string => value.replaceAll("\\", "/");

/**
 * Escapes a literal path for use in a normalization regular expression.
 */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
