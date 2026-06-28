/**
 * @file Invalid ODW workflow fixture manifest tests.
 */

import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { TextDecoder } from "node:util";
import type { SourceSpan, WorkflowSource } from "odw-lint";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./fixtures/invalid-workflows";

const FIXTURE_DIRECTORY = new URL("./fixtures/invalid-workflows/", import.meta.url);
const MANIFEST_FIXTURE_ROOT = "tests/static-analysis/fixtures/invalid-workflows/";
const SPAN_DECODER = new TextDecoder("utf-8", { fatal: true });
const EXPECTED_FILE_NAMES = [
  "missing-metadata/missing-meta-description.js",
  "missing-metadata/missing-meta-name.js",
  "missing-metadata/missing-meta.js",
  "malformed-metadata/computed-meta-expression.js",
  "malformed-metadata/empty-meta-name.js",
  "malformed-metadata/meta-not-object.js",
  "malformed-metadata/numeric-meta-description.js",
  "malformed-metadata/unterminated-meta-object.js",
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
  "odw/no-import-export",
  "odw/no-import-export",
] as const;
const FAMILY_ORDER = [
  "missing-metadata",
  "malformed-metadata",
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

/** Calculates the SHA-256 digest used to pin copied fixture content. */
const sha256 = (sourceText: string): string => {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
};

/** Returns committed JavaScript fixture names below the invalid fixture root. */
const copiedFixtureFileNames = (): readonly string[] => {
  return readdirSync(FIXTURE_DIRECTORY, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".js"))
    .sort();
};

/** Reads a copied invalid fixture through its repository-relative manifest path. */
const readFixtureSource = (fixturePath: string): string => {
  return readFileSync(
    new URL(fixturePath.replace(MANIFEST_FIXTURE_ROOT, ""), FIXTURE_DIRECTORY),
    "utf8",
  );
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
    expect(orderInvalidFixtureNames(copiedFixtureFileNames())).toEqual([...EXPECTED_FILE_NAMES]);
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

    expect(copiedFixtureFileNames()).toEqual(manifestFileNames);

    for (const fixture of INVALID_WORKFLOW_FIXTURE_SNAPSHOTS) {
      const sourceText = readFixtureSource(fixture.fixturePath);

      expect(
        existsSync(
          new URL(fixture.fixturePath.replace(MANIFEST_FIXTURE_ROOT, ""), FIXTURE_DIRECTORY),
        ),
      ).toBeTrue();
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
