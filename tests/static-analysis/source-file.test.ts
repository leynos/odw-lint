/**
 * @file Original source-file metadata tests.
 */

import { describe, expect, it } from "bun:test";
import type { OriginalSourceFile } from "odw-lint";
import {
  createOriginalSourceFile,
  positionAtOffset,
  SourceOffsetError,
  sliceSourceSpan,
  snippetForSpan,
  spanFromOffsets,
} from "odw-lint";
import { SOURCE_FILE_FIXTURES } from "./source-file-line-fixtures";
import { INVALID_OFFSET_CASES, SOURCE_POSITION_CASES } from "./source-file-position-cases";
import { INVALID_SOURCE_SPAN_CASES, SOURCE_SPAN_CASES } from "./source-file-span-cases";

describe("original source files", () => {
  for (const fixture of SOURCE_FILE_FIXTURES) {
    it(`records line metadata for ${fixture.name}`, () => {
      const sourceFile = createOriginalSourceFile({
        filePath: "workflows/example.js",
        sourceText: fixture.sourceText,
      });

      expect(sourceFile).toMatchObject({
        filePath: "workflows/example.js",
        sourceText: fixture.sourceText,
        byteLength: fixture.byteLength,
        lines: fixture.lines,
      } satisfies Pick<OriginalSourceFile, "filePath" | "sourceText" | "byteLength" | "lines">);
    });
  }

  it("freezes source records and line metadata at runtime", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "meta\nbody",
    });

    expect(Object.isFrozen(sourceFile)).toBeTrue();
    expect(Object.isFrozen(sourceFile.lines)).toBeTrue();
    expect(sourceFile.lines.every((line) => Object.isFrozen(line))).toBeTrue();
  });

  it("requires factory construction at the type and helper boundary", () => {
    // @ts-expect-error OriginalSourceFile records carry a private factory brand.
    const structuralSourceFile: OriginalSourceFile = {
      filePath: "workflows/example.js",
      sourceText: "",
      byteLength: 0,
      lines: [],
    };

    expect(() => positionAtOffset(structuralSourceFile, 0)).toThrow(SourceOffsetError);
  });

  for (const positionCase of SOURCE_POSITION_CASES) {
    it(`maps ${positionCase.name}`, () => {
      const sourceFile = createOriginalSourceFile({
        filePath: "workflows/example.js",
        sourceText: positionCase.sourceText,
      });

      expect(positionAtOffset(sourceFile, positionCase.offset)).toEqual(positionCase.position);
    });
  }

  for (const invalidCase of INVALID_OFFSET_CASES) {
    it(`rejects ${invalidCase.name}`, () => {
      const sourceFile = createOriginalSourceFile({
        filePath: "workflows/example.js",
        sourceText: invalidCase.sourceText,
      });

      expect(() => positionAtOffset(sourceFile, invalidCase.offset)).toThrow(SourceOffsetError);
    });
  }

  for (const spanCase of SOURCE_SPAN_CASES) {
    it(`round-trips ${spanCase.name} spans and snippets`, () => {
      const sourceFile = createOriginalSourceFile({
        filePath: "workflows/example.js",
        sourceText: spanCase.sourceText,
      });

      const span = spanFromOffsets(sourceFile, spanCase.startOffset, spanCase.endOffset);

      expect(span).toEqual(spanCase.span);
      expect(sliceSourceSpan(sourceFile, span)).toBe(spanCase.text);
      expect(snippetForSpan(sourceFile, span)).toEqual({
        text: spanCase.text,
        start: spanCase.span.start,
        end: spanCase.span.end,
        lineText: spanCase.lineText,
      });
    });
  }

  for (const invalidCase of INVALID_SOURCE_SPAN_CASES) {
    it(`rejects ${invalidCase.name} spans before slicing`, () => {
      const sourceFile = createOriginalSourceFile({
        filePath: "workflows/example.js",
        sourceText: invalidCase.sourceText,
      });

      expect(() => sliceSourceSpan(sourceFile, invalidCase.span)).toThrow(SourceOffsetError);
      expect(() => snippetForSpan(sourceFile, invalidCase.span)).toThrow(SourceOffsetError);
    });
  }
});
