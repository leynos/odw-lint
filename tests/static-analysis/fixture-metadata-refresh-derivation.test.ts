/**
 * @file Fixture metadata refresh derivation tests.
 */

import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { captureRefreshFailure } from "./fixture-metadata-refresh-assertions";
import type { FixtureRefreshFailure } from "./fixtures/refresh-metadata";
import {
  defaultOdwReferenceCheckout,
  deriveAnchoredDiagnosticSpan,
  deriveSha256,
  FixtureRefreshError,
  MANIFEST_PATHS,
  normalizeDirectoryUrl,
  resolveOdwReferenceCheckout,
} from "./fixtures/refresh-metadata";

/** Returns the `file:` URL form for a directory path without POSIX assumptions. */
const directoryHref = (path: string): string => {
  const href = pathToFileURL(path).href;
  return href.endsWith("/") ? href : `${href}/`;
};

const syntheticProjectsRootPath = join(tmpdir(), "Projects");
const syntheticWorktreeRootPath = join(
  syntheticProjectsRootPath,
  "odw-lint.worktrees",
  "roadmap-1-3-5",
);
const syntheticWorktreeRoot = pathToFileURL(syntheticWorktreeRootPath);
const syntheticOdwReferenceCheckoutHref = directoryHref(
  join(syntheticProjectsRootPath, "open-dynamic-workflows"),
);

describe("fixture metadata refresh derivation", () => {
  it("derives SHA-256 digests using the fixture corpus contract", () => {
    const sourceText = "export const meta = { name: 'hash' };\n";
    const expected = createHash("sha256").update(sourceText, "utf8").digest("hex");

    expect(deriveSha256(sourceText)).toBe(expected);
  });

  it("preserves refresh error failure identity", () => {
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

    expect(error.failure).toBe(failure);
  });

  it("pins the managed refresh manifest paths", () => {
    expect(MANIFEST_PATHS).toEqual([
      "tests/static-analysis/fixtures/odw-examples.ts",
      "tests/static-analysis/fixtures/masking.ts",
      "tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts",
      "tests/static-analysis/fixtures/invalid-workflows/manifests/malformed-metadata.ts",
      "tests/static-analysis/fixtures/invalid-workflows/manifests/missing-metadata.ts",
      "tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts",
      "tests/static-analysis/fixtures/invalid-workflows/manifests/unsupported-import-export.ts",
    ]);
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
    // Overlapping anchors must advance one source position at a time, not by
    // match length, or `aaaa` would hide the second `aaa` occurrence.
    const failure = captureRefreshFailure("aaaa", "aaa");

    expect(failure.code).toBe("duplicate-anchor");
    expect(failure.occurrenceCount).toBe(2);
  });

  it("normalizes directory URLs without treating non-trailing paths as files", () => {
    const normalized = normalizeDirectoryUrl(new URL(`${syntheticWorktreeRoot.href}?x=1#fragment`));

    expect(normalized.href).toBe(directoryHref(syntheticWorktreeRootPath));
  });

  it("resolves the default ODW checkout from worktree directory URLs", () => {
    expect(defaultOdwReferenceCheckout(syntheticWorktreeRoot).href).toBe(
      syntheticOdwReferenceCheckoutHref,
    );
    expect(
      defaultOdwReferenceCheckout(new URL(directoryHref(syntheticWorktreeRootPath))).href,
    ).toBe(syntheticOdwReferenceCheckoutHref);
  });

  it("resolves the default ODW checkout from ordinary checkout directory URLs", () => {
    expect(
      defaultOdwReferenceCheckout(pathToFileURL(join(syntheticProjectsRootPath, "odw-lint"))).href,
    ).toBe(syntheticOdwReferenceCheckoutHref);
  });

  it("resolves relative ODW checkout overrides from the repository root", () => {
    expect(resolveOdwReferenceCheckout(syntheticWorktreeRoot, "../reference").href).toBe(
      directoryHref(join(syntheticProjectsRootPath, "odw-lint.worktrees", "reference")),
    );
  });

  it("resolves empty ODW checkout overrides through the default checkout", () => {
    expect(resolveOdwReferenceCheckout(syntheticWorktreeRoot, "").href).toBe(
      syntheticOdwReferenceCheckoutHref,
    );
  });

  it("resolves missing ODW checkout overrides through the default checkout", () => {
    expect(resolveOdwReferenceCheckout(syntheticWorktreeRoot, undefined).href).toBe(
      syntheticOdwReferenceCheckoutHref,
    );
  });
});
