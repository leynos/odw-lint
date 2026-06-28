/**
 * @file Invalid ODW workflow fixture manifest tests.
 */

import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { TextDecoder } from "node:util";
import type { SourceSpan, WorkflowSource } from "odw-lint";
import {
  copiedFixtureFileNames,
  fixtureSourceUrl,
  readFixtureSource,
  sha256,
} from "./fixtures/corpus-support";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./fixtures/invalid-workflows";

const FIXTURE_DIRECTORY = new URL("./fixtures/invalid-workflows/", import.meta.url);
const MANIFEST_FIXTURE_ROOT = "tests/static-analysis/fixtures/invalid-workflows/";
const FIXTURE_CORPUS = {
  fixtureDirectory: FIXTURE_DIRECTORY,
  manifestRoot: MANIFEST_FIXTURE_ROOT,
  recursive: true,
} as const;
const SPAN_DECODER = new TextDecoder("utf-8", { fatal: true });
const HOSTILE_MARKER_PROPERTY = "__odwLintHostileMetadataWasEvaluated";
const EXPECTED_FILE_NAMES = [
  "missing-metadata/missing-meta-description.js",
  "missing-metadata/missing-meta-name.js",
  "missing-metadata/missing-meta.js",
  "malformed-metadata/computed-meta-expression.js",
  "malformed-metadata/empty-meta-name.js",
  "malformed-metadata/meta-not-object.js",
  "malformed-metadata/numeric-meta-description.js",
  "malformed-metadata/unterminated-meta-object.js",
  "hostile-metadata/global-marker.js",
  "hostile-metadata/throw-marker.js",
  "unsupported-import-export/extra-export-const.js",
  "unsupported-import-export/top-level-import.js",
  "syntax-error/body-unclosed-block.js",
  "syntax-error/body-unclosed-call.js",
] as const;
const EXPECTED_RULES = [
  "odw/body-syntax",
  "odw/body-syntax",
  "odw/meta-description",
  "odw/meta-description",
  "odw/meta-name",
  "odw/meta-name",
  "odw/meta-object",
  "odw/meta-object",
  "odw/meta-required",
  "odw/meta-statically-unprovable",
  "odw/meta-statically-unprovable",
  "odw/meta-statically-unprovable",
  "odw/no-import-export",
  "odw/no-import-export",
] as const;
const FAMILY_ORDER = [
  "missing-metadata",
  "malformed-metadata",
  "hostile-metadata",
  "unsupported-import-export",
  "syntax-error",
] as const;

/** Sorts fixture paths by the manifest family order, then filename. */
const orderInvalidFixtureNames = (fileNames: readonly string[]): string[] => {
  return [...fileNames].sort((left, right) => {
    const [leftFamily = "", leftFileName = ""] = left.split("/");
    const [rightFamily = "", rightFileName = ""] = right.split("/");
    const familySort =
      FAMILY_ORDER.indexOf(leftFamily as (typeof FAMILY_ORDER)[number]) -
      FAMILY_ORDER.indexOf(rightFamily as (typeof FAMILY_ORDER)[number]);

    return familySort === 0 ? leftFileName.localeCompare(rightFileName) : familySort;
  });
};

/** Clears the hostile fixture marker without declaring a real global. */
const clearHostileMarker = (): void => {
  delete (globalThis as Record<string, unknown>)[HOSTILE_MARKER_PROPERTY];
};

/** Reads the hostile fixture marker without coupling tests to global types. */
const hostileMarkerValue = (): unknown => {
  return (globalThis as Record<string, unknown>)[HOSTILE_MARKER_PROPERTY];
};

/** Decodes a UTF-8 byte range from source text. */
const decodeSpanText = (sourceText: string, span: SourceSpan): string => {
  const sourceBytes = Buffer.from(sourceText, "utf8");

  return SPAN_DECODER.decode(sourceBytes.subarray(span.start.offset, span.end.offset));
};

/** Converts a UTF-8 byte offset into one-based line and Unicode-code-point column. */
const positionForOffset = (sourceText: string, offset: number): SourceSpan["start"] => {
  const prefix = Buffer.from(sourceText, "utf8").subarray(0, offset);
  const prefixText = SPAN_DECODER.decode(prefix);
  const lines = prefixText.split("\n");
  const finalLine = lines.at(-1) ?? "";

  return {
    offset,
    line: lines.length,
    column: Array.from(finalLine).length + 1,
  };
};

/** Asserts that a source span matches the repository UTF-8 byte-offset contract. */
const expectSpanToMatchSource = (
  sourceText: string,
  span: SourceSpan,
  expectedSpanText: string,
): void => {
  const sourceByteLength = Buffer.byteLength(sourceText, "utf8");

  expect(span.start.offset).toBeGreaterThanOrEqual(0);
  expect(span.end.offset).toBeGreaterThanOrEqual(span.start.offset);
  expect(span.end.offset).toBeLessThanOrEqual(sourceByteLength);
  expect(positionForOffset(sourceText, span.start.offset)).toEqual(span.start);
  expect(positionForOffset(sourceText, span.end.offset)).toEqual(span.end);
  expect(decodeSpanText(sourceText, span)).toBe(expectedSpanText);
};

describe("invalid workflow fixture snapshots", () => {
  it("lists invalid fixture families in sorted order", () => {
    const manifestFileNames = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.map((fixture) =>
      fixture.fixturePath.replace(MANIFEST_FIXTURE_ROOT, ""),
    );

    expect(manifestFileNames).toEqual([...EXPECTED_FILE_NAMES]);
    expect(manifestFileNames).toEqual(orderInvalidFixtureNames(manifestFileNames));
    expect(orderInvalidFixtureNames(copiedFixtureFileNames(FIXTURE_CORPUS))).toEqual([
      ...EXPECTED_FILE_NAMES,
    ]);
  });

  it("freezes manifest metadata and diagnostic expectation arrays at runtime", () => {
    expect(Object.isFrozen(INVALID_WORKFLOW_FIXTURE_SNAPSHOTS)).toBeTrue();

    for (const fixture of INVALID_WORKFLOW_FIXTURE_SNAPSHOTS) {
      expect(Object.isFrozen(fixture)).toBeTrue();
      expect(Object.isFrozen(fixture.expectedDiagnostics)).toBeTrue();

      for (const diagnostic of fixture.expectedDiagnostics) {
        expect(Object.isFrozen(diagnostic)).toBeTrue();
        expect(Object.isFrozen(diagnostic.span)).toBeTrue();
        expect(Object.isFrozen(diagnostic.span.start)).toBeTrue();
        expect(Object.isFrozen(diagnostic.span.end)).toBeTrue();

        const originalStartOffset = diagnostic.span.start.offset;
        const originalEndOffset = diagnostic.span.end.offset;

        expect(() => {
          (diagnostic.span.start as { offset: number }).offset = 999;
        }).toThrow(TypeError);
        expect(() => {
          (diagnostic.span.end as { offset: number }).offset = 999;
        }).toThrow(TypeError);
        expect(diagnostic.span.start.offset).toBe(originalStartOffset);
        expect(diagnostic.span.end.offset).toBe(originalEndOffset);
      }
    }
  });

  it("hashes source text with the manifest SHA-256 contract", () => {
    expect(sha256("export const meta = {};\n")).toBe(
      "ff5fd837b27b0ce65dd29ff5fdfb55806d63ab6bb796e78b639b89e79e0583db",
    );
  });

  it("represents passive workflow source text without importing fixtures", () => {
    const workflowSource = {
      filePath: "tests/static-analysis/fixtures/invalid-workflows/example.js",
      sourceText: 'return agent("ok");\n',
    } satisfies WorkflowSource;

    expect(workflowSource.sourceText).toContain("agent");
  });

  it("reads hostile fixture source without setting the global marker", () => {
    clearHostileMarker();

    const fixtures = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
      (candidate) => candidate.family === "hostile-metadata",
    );

    expect(fixtures.map((fixture) => fixture.fileName).sort()).toEqual([
      "global-marker.js",
      "throw-marker.js",
    ]);

    for (const fixture of fixtures) {
      const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fixturePath);

      expect(sourceText).toContain(
        fixture.fileName === "global-marker.js"
          ? HOSTILE_MARKER_PROPERTY
          : "ODW_LINT_HOSTILE_METADATA_EVALUATED",
      );
      expect(hostileMarkerValue()).toBeUndefined();
      expect(sha256(sourceText)).toBe(fixture.sha256);

      for (const diagnostic of fixture.expectedDiagnostics) {
        expectSpanToMatchSource(sourceText, diagnostic.span, diagnostic.spanText);
      }

      expect(hostileMarkerValue()).toBeUndefined();
    }
  });

  it("matches ASCII spans through UTF-8 byte decoding", () => {
    const sourceText = "alpha\nbeta\n";
    const span = {
      start: { offset: 6, line: 2, column: 1 },
      end: { offset: 10, line: 2, column: 5 },
    };

    expectSpanToMatchSource(sourceText, span, "beta");
  });

  it("recomputes Unicode line and column positions from UTF-8 byte offsets", () => {
    const sourceText = "meta: cafe\nname: café\n";
    const startOffset = Buffer.byteLength("meta: cafe\nname: ", "utf8");
    const endOffset = Buffer.byteLength("meta: cafe\nname: café", "utf8");
    const span = {
      start: { offset: startOffset, line: 2, column: 7 },
      end: { offset: endOffset, line: 2, column: 11 },
    };

    expect(endOffset).not.toBe("meta: cafe\nname: café".length);
    expectSpanToMatchSource(sourceText, span, "café");
  });

  it("validates manifest fixture hashes and diagnostic spans", () => {
    const manifestFileNames = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.map((fixture) =>
      fixture.fixturePath.replace(MANIFEST_FIXTURE_ROOT, ""),
    ).sort();

    expect(copiedFixtureFileNames(FIXTURE_CORPUS)).toEqual(manifestFileNames);

    for (const fixture of INVALID_WORKFLOW_FIXTURE_SNAPSHOTS) {
      const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fixturePath);

      expect(existsSync(fixtureSourceUrl(FIXTURE_CORPUS, fixture.fixturePath))).toBeTrue();
      expect(sha256(sourceText)).toBe(fixture.sha256);
      expect(Buffer.from(sourceText, "utf8").every((byte) => byte <= 0x7f)).toBeTrue();

      for (const diagnostic of fixture.expectedDiagnostics) {
        expectSpanToMatchSource(sourceText, diagnostic.span, diagnostic.spanText);
      }
    }
  });

  it("records the expected metadata status and rule coverage", () => {
    const families = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.map((fixture) => fixture.family);
    const statuses = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.map((fixture) => fixture.expectedStatus);
    const rules = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.flatMap((fixture) =>
      fixture.expectedDiagnostics.map((diagnostic) => String(diagnostic.rule)),
    ).sort();

    expect(new Set(families)).toEqual(
      new Set([
        "malformed-metadata",
        "hostile-metadata",
        "missing-metadata",
        "syntax-error",
        "unsupported-import-export",
      ]),
    );
    expect(new Set(statuses)).toEqual(new Set(["error", "warning"]));
    expect(rules).toEqual([...EXPECTED_RULES]);
  });

  it("matches the compact invalid manifest snapshot", () => {
    expect(
      INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.map((fixture) => ({
        family: fixture.family,
        fileName: fixture.fileName,
        expectedStatus: fixture.expectedStatus,
        diagnostics: fixture.expectedDiagnostics.map((diagnostic) => ({
          rule: String(diagnostic.rule),
          severity: diagnostic.severity,
          spanTextLines: diagnostic.spanText.split("\n"),
        })),
      })),
    ).toMatchSnapshot();
  });
});
