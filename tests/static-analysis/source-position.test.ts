/**
 * @file Source-position validator and text-index conversion tests.
 */

import { describe, expect, it } from "bun:test";
import type { SourceSpan } from "../../src/diagnostics/types";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import { spanFromTextIndexes, validateSourceSpan } from "../../src/static-analysis/source-position";
import { SourceOffsetError } from "../../src/static-analysis/types";

describe("source-position validation", () => {
  it("rejects malformed caller span shapes directly", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "alpha",
    });
    const malformedSpan = {
      start: { offset: 0, line: 1, column: 1 },
    } as unknown as SourceSpan;

    expect(() => validateSourceSpan(sourceFile, malformedSpan)).toThrow(SourceOffsetError);
  });

  it("rejects reversed caller span offsets directly", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "alpha",
    });
    const reversedSpan: SourceSpan = {
      start: { offset: 4, line: 1, column: 5 },
      end: { offset: 1, line: 1, column: 2 },
    };

    expect(() => validateSourceSpan(sourceFile, reversedSpan)).toThrow(SourceOffsetError);
  });

  it("rejects mismatched start positions directly", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "alpha",
    });
    const mismatchedStartSpan: SourceSpan = {
      start: { offset: 1, line: 1, column: 99 },
      end: { offset: 4, line: 1, column: 5 },
    };

    expect(() => validateSourceSpan(sourceFile, mismatchedStartSpan)).toThrow(SourceOffsetError);
  });

  it("rejects mismatched end positions directly", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "alpha",
    });
    const mismatchedEndSpan: SourceSpan = {
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 4, line: 2, column: 1 },
    };

    expect(() => validateSourceSpan(sourceFile, mismatchedEndSpan)).toThrow(SourceOffsetError);
  });
});

describe("source-position text-index conversion", () => {
  it("maps representative UTF-16 text-index spans to UTF-8 source spans", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "aé\n😀z",
    });

    expect(spanFromTextIndexes(sourceFile, 1, 5)).toEqual({
      start: { offset: 1, line: 1, column: 2 },
      end: { offset: 8, line: 2, column: 2 },
    } satisfies SourceSpan);
  });

  it("maps zero-length text-index spans at line boundaries", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "aé\n😀z",
    });

    expect(spanFromTextIndexes(sourceFile, 3, 3)).toEqual({
      start: { offset: 4, line: 2, column: 1 },
      end: { offset: 4, line: 2, column: 1 },
    } satisfies SourceSpan);
  });
});
