/**
 * @file Fixture metadata refresh workspace tests.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeReportForAssertion } from "./fixture-metadata-refresh-assertions";
import { createTempRefreshWorkspace } from "./fixture-metadata-refresh-workspace";
import { refreshFixtureMetadata } from "./fixtures/refresh-metadata";

describe("fixture metadata refresh helpers", () => {
  it("returns a sorted dry-run report for the current checked-out corpus", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: false,
      });

      expect(report.mode).toBe("dry-run");
      expect(report.repositoryRoot).toBe(temp.repositoryRoot);
      expect(report.odwReferenceCheckout).toBe(temp.odwReferenceCheckout);
      expect(report.failures).toEqual([]);
      expect(report.counts.totalFixtures).toBe(
        report.counts.odwExamples + report.counts.masking + report.counts.invalidWorkflows,
      );
      expect(report.counts.hostileMetadata).toBeLessThanOrEqual(report.counts.invalidWorkflows);
      expect(report.writtenPaths).toEqual([]);
      expect(report.managedPaths).toEqual([...report.managedPaths].sort());
      expect(normalizeReportForAssertion(report)).toMatchSnapshot();
    } finally {
      temp.remove();
    }
  });

  it("rewrites manifests deterministically and preserves raw ODW example bytes", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const upstreamPath = join(temp.odwReferenceCheckout, "examples", "routing.js");
      const copiedPath = join(
        temp.repositoryRoot,
        "tests/static-analysis/fixtures/odw-examples/routing.js",
      );
      const upstreamBytes = readFileSync(upstreamPath);
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: true,
      });

      expect(report.mode).toBe("write");
      expect(report.failures).toEqual([]);
      expect(report.writtenPaths).toContain(
        "tests/static-analysis/fixtures/odw-examples/routing.js",
      );
      expect(readFileSync(copiedPath)).toEqual(upstreamBytes);
      expect(
        readFileSync(
          join(temp.repositoryRoot, "tests/static-analysis/fixtures/masking.ts"),
          "utf8",
        ),
      ).toContain("MASKING_FIXTURE_SNAPSHOTS");
    } finally {
      temp.remove();
    }
  });

  it("is idempotent when write mode runs twice against a temporary corpus", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const options = {
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: true,
      } as const;

      const first = refreshFixtureMetadata(options);
      const second = refreshFixtureMetadata(options);

      expect(first.failures).toEqual([]);
      expect(first.writtenPaths.length).toBeGreaterThan(0);
      expect(second.failures).toEqual([]);
      expect(second.writtenPaths).toEqual([]);
      expect(second.managedPaths).toEqual(first.managedPaths);
      expect(second.unchangedPaths).toEqual(second.managedPaths);
    } finally {
      temp.remove();
    }
  });

  it("reports missing allow-listed upstream ODW examples", () => {
    const temp = createTempRefreshWorkspace({ omitExample: "routing.js" });
    try {
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: true,
      });

      expect(report.failures).toHaveLength(1);
      expect(report.failures[0]?.code).toBe("missing-upstream-example");
      expect(report.failures[0]?.message).toContain("routing.js");
      expect(report.failures[0]?.message).toContain("ODW_REFERENCE_CHECKOUT");
    } finally {
      temp.remove();
    }
  });

  it("reports extra upstream ODW examples without copying them", () => {
    const temp = createTempRefreshWorkspace({ extraExample: "new-upstream.js" });
    try {
      const report = refreshFixtureMetadata({
        repositoryRoot: pathToFileURL(temp.repositoryRoot),
        odwReferenceCheckout: pathToFileURL(temp.odwReferenceCheckout),
        shouldWrite: true,
      });

      expect(report.failures).toEqual([]);
      expect(report.extraUpstreamExamples).toEqual(["new-upstream.js"]);
      expect(report.managedPaths).not.toContain(
        "tests/static-analysis/fixtures/odw-examples/new-upstream.js",
      );
    } finally {
      temp.remove();
    }
  });
});
