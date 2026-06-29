/**
 * @file Fixture metadata refresh helper tests.
 */

import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FixtureRefreshFailure, FixtureRefreshReport } from "./fixtures/refresh-metadata";
import {
  defaultOdwReferenceCheckout,
  deriveAnchoredDiagnosticSpan,
  deriveSha256,
  FixtureRefreshError,
  MANIFEST_PATHS,
  normalizeDirectoryUrl,
  refreshFixtureMetadata,
  resolveOdwReferenceCheckout,
} from "./fixtures/refresh-metadata";

declare global {
  // The hostile fixture writes this marker only if source is evaluated.
  var __odwLintHostileMetadataWasEvaluated: string | undefined;
}

const repositoryRootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repositoryRoot = pathToFileURL(repositoryRootPath);
const syntheticWorktreeRoot = pathToFileURL("/tmp/Projects/odw-lint.worktrees/roadmap-1-3-5");

describe("fixture metadata refresh helpers", () => {
  it("derives SHA-256 digests using the fixture corpus contract", () => {
    const sourceText = "export const meta = { name: 'hash' };\n";
    const expected = createHash("sha256").update(sourceText, "utf8").digest("hex");

    expect(deriveSha256(sourceText)).toBe(expected);
  });

  it("exposes the public refresh report API shape at runtime", () => {
    const failure: FixtureRefreshFailure = {
      code: "missing-anchor",
      message: "fixtures/example.js diagnostic anchor is missing.",
      path: "fixtures/example.js",
      rule: "odw/meta-name",
      anchor: "name",
      occurrenceCount: 0,
      remediation: "Update the manifest spanText anchor.",
    };
    const error = new FixtureRefreshError(failure);
    const report = refreshFixtureMetadata({
      repositoryRoot,
      odwReferenceCheckout: repositoryRoot,
      shouldWrite: false,
    });

    expect(error.failure).toBe(failure);
    expect(Object.keys(report).sort()).toEqual(
      [
        "counts",
        "extraUpstreamExamples",
        "failures",
        "managedPaths",
        "mode",
        "odwReferenceCheckout",
        "repositoryRoot",
        "unchangedPaths",
        "wouldWritePaths",
        "writtenPaths",
      ].sort(),
    );
    expect(MANIFEST_PATHS).toContain("tests/static-analysis/fixtures/odw-examples.ts");
  });

  it("derives ASCII spans and reviewer text from a unique anchor", () => {
    const refreshed = deriveAnchoredDiagnosticSpan(
      { filePath: "fixtures/ascii.js", sourceText: "before\nexport const helper = 1;\nafter\n" },
      {
        fixturePath: "fixtures/ascii.js",
        rule: "odw/no-import-export",
        spanText: "export const helper = 1;",
        fallbackByteOffset: 0,
      },
    );

    expect(refreshed).toEqual({
      span: {
        start: { offset: 7, line: 2, column: 1 },
        end: { offset: 31, line: 2, column: 25 },
      },
      spanText: "export const helper = 1;",
    });
  });

  it("derives Unicode-aware byte offsets and display columns from a unique anchor", () => {
    const refreshed = deriveAnchoredDiagnosticSpan(
      { filePath: "fixtures/unicode.js", sourceText: '😀 prefix\nvalue: "café"\n' },
      {
        fixturePath: "fixtures/unicode.js",
        rule: "odw/meta-description",
        spanText: '"café"',
        fallbackByteOffset: 0,
      },
    );

    expect(refreshed).toEqual({
      span: {
        start: { offset: 19, line: 2, column: 8 },
        end: { offset: 26, line: 2, column: 14 },
      },
      spanText: '"café"',
    });
  });

  it("derives a zero-length span from an empty anchor", () => {
    const refreshed = deriveAnchoredDiagnosticSpan(
      { filePath: "fixtures/missing-meta.js", sourceText: "await agent('draft');\n" },
      {
        fixturePath: "fixtures/missing-meta.js",
        rule: "odw/meta-required",
        spanText: "",
        fallbackByteOffset: 0,
      },
    );

    expect(refreshed).toEqual({
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
      spanText: "",
    });
  });

  it("rejects an empty-anchor fallback byte offset outside the source", () => {
    const failure = captureRefreshFailure("await agent('draft');\n", "", 99);

    expect(failure.code).toBe("missing-anchor");
    expect(failure.message).toContain("fallback byte offset");
    expect(failure.occurrenceCount).toBeNull();
  });

  it("rejects missing anchors with actionable fixture context", () => {
    expect(() =>
      deriveAnchoredDiagnosticSpan(
        { filePath: "fixtures/missing.js", sourceText: "export const meta = {};\n" },
        {
          fixturePath: "fixtures/missing.js",
          rule: "odw/meta-name",
          spanText: "name: missing",
          fallbackByteOffset: 0,
        },
      ),
    ).toThrow(FixtureRefreshError);

    const failure = captureRefreshFailure("export const meta = {};\n", "name: missing");
    expect(failure.code).toBe("missing-anchor");
    expect(failure.message).toContain("fixtures/example.js");
    expect(failure.message).toContain("odw/meta-name");
  });

  it("rejects duplicate anchors with actionable fixture context", () => {
    const failure = captureRefreshFailure("name: duplicate\nname: duplicate\n", "name: duplicate");

    expect(failure.code).toBe("duplicate-anchor");
    expect(failure.occurrenceCount).toBe(2);
    expect(failure.path).toBe("fixtures/example.js");
    expect(failure.rule).toBe("odw/meta-name");
  });

  it("rejects overlapping duplicate anchors", () => {
    const failure = captureRefreshFailure("aaaa", "aaa");

    expect(failure.code).toBe("duplicate-anchor");
    expect(failure.occurrenceCount).toBe(2);
  });

  it("normalizes directory URLs without treating non-trailing paths as files", () => {
    const normalized = normalizeDirectoryUrl(
      new URL("file:///tmp/Projects/odw-lint.worktrees/roadmap-1-3-5?x=1#fragment"),
    );

    expect(normalized.href).toBe("file:///tmp/Projects/odw-lint.worktrees/roadmap-1-3-5/");
  });

  it("resolves the default ODW checkout from df12 worktree directory URLs", () => {
    expect(defaultOdwReferenceCheckout(syntheticWorktreeRoot).href).toBe(
      "file:///tmp/Projects/open-dynamic-workflows/",
    );
    expect(defaultOdwReferenceCheckout(new URL(`${syntheticWorktreeRoot.href}/`)).href).toBe(
      "file:///tmp/Projects/open-dynamic-workflows/",
    );
  });

  it("resolves the default ODW checkout from ordinary checkout directory URLs", () => {
    expect(defaultOdwReferenceCheckout(pathToFileURL("/tmp/Projects/odw-lint")).href).toBe(
      "file:///tmp/Projects/open-dynamic-workflows/",
    );
  });

  it("resolves relative ODW checkout overrides from the repository root", () => {
    expect(resolveOdwReferenceCheckout(syntheticWorktreeRoot, "../reference").href).toBe(
      "file:///tmp/Projects/odw-lint.worktrees/reference",
    );
  });

  it("returns a sorted dry-run report for the current checked-out corpus", () => {
    const temp = mkdtempSync(join(tmpdir(), "odw-lint-refresh-"));
    try {
      mkdirSync(join(temp, "open-dynamic-workflows"));
      const report = refreshFixtureMetadata({
        repositoryRoot,
        odwReferenceCheckout: pathToFileURL(join(temp, "open-dynamic-workflows")),
        shouldWrite: false,
      });

      expect(report.mode).toBe("dry-run");
      expect(report.failures).toEqual([]);
      expect(report.counts.totalFixtures).toBe(
        report.counts.odwExamples + report.counts.masking + report.counts.invalidWorkflows,
      );
      expect(report.counts.hostileMetadata).toBeLessThanOrEqual(report.counts.invalidWorkflows);
      expect(report.writtenPaths).toEqual([]);
      expect(report.managedPaths).toEqual([...report.managedPaths].sort());
      expect(normalizeReportForAssertion(report)).toMatchSnapshot();
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("rejects write-mode refresh until manifest writing is implemented", () => {
    const report = refreshFixtureMetadata({
      repositoryRoot,
      odwReferenceCheckout: repositoryRoot,
      shouldWrite: true,
    });

    expect(report.mode).toBe("write");
    expect(report.writtenPaths).toEqual([]);
    expect(report.failures).toEqual([
      {
        code: "invalid-arguments",
        message: "Write-mode fixture refresh is implemented by roadmap work item 2.",
        path: null,
        rule: null,
        anchor: null,
        occurrenceCount: null,
        remediation:
          "Run dry-run mode for this helper slice, or continue with work item 2 before using write mode.",
      },
    ]);
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
    expect(result.stderr).toBe("");
  });
});

/**
 * Captures an expected refresh failure from span derivation.
 */
const captureRefreshFailure = (
  sourceText: string,
  spanText: string,
  fallbackByteOffset = 0,
): FixtureRefreshReport["failures"][number] => {
  try {
    deriveAnchoredDiagnosticSpan(
      { filePath: "fixtures/example.js", sourceText },
      {
        fixturePath: "fixtures/example.js",
        rule: "odw/meta-name",
        spanText,
        fallbackByteOffset,
      },
    );
  } catch (error) {
    if (error instanceof FixtureRefreshError) {
      return error.failure;
    }
    throw error;
  }
  throw new Error("Expected fixture refresh failure.");
};

/**
 * Removes machine-specific paths from a refresh report before snapshotting.
 */
const normalizeReportForAssertion = (report: FixtureRefreshReport): FixtureRefreshReport => {
  return {
    ...report,
    repositoryRoot: "<repositoryRoot>",
    odwReferenceCheckout: "<odwReferenceCheckout>",
  };
};
