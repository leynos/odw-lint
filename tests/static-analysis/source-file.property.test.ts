/**
 * @file Property tests for original source-file position mapping.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import type { OriginalSourceFile } from "odw-lint";
import {
  createOriginalSourceFile,
  positionAtOffset,
  SourceOffsetError,
  sliceSourceSpan,
  spanFromOffsets,
} from "odw-lint";
import {
  expectedPositions,
  expectMonotonicPositions,
  finalExpectedPosition,
  firstExpectedPosition,
  originalSubstring,
  SOURCE_SEGMENTS,
  SOURCE_SPAN_PROPERTY_RUNNER,
  validOffsetSet,
} from "./source-file-property-oracle";

/** Arbitrary source text built from bounded line-ending and Unicode segments. */
const GENERATED_SOURCE_TEXT = fc
  .tuple(
    fc.constantFrom(...SOURCE_SEGMENTS),
    fc.constantFrom(...SOURCE_SEGMENTS),
    fc.constantFrom(...SOURCE_SEGMENTS),
    fc.constantFrom(...SOURCE_SEGMENTS),
  )
  .map((segments) => segments.join(""));

/** Builds a production source-file record for one generated test source. */
const generatedSourceFile = (sourceText: string): OriginalSourceFile => {
  return createOriginalSourceFile({
    filePath: "workflows/generated.js",
    sourceText,
  });
};

describe("original source-file position properties", () => {
  it("accepts every generated display offset", () => {
    fc.assert(
      fc.property(GENERATED_SOURCE_TEXT, (sourceText) => {
        const sourceFile = generatedSourceFile(sourceText);

        for (const position of expectedPositions(sourceText)) {
          expect(positionAtOffset(sourceFile, position.offset)).toEqual(position);
        }
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("orders generated positions monotonically", () => {
    fc.assert(
      fc.property(GENERATED_SOURCE_TEXT, (sourceText) => {
        const sourceFile = generatedSourceFile(sourceText);
        const mappedPositions = expectedPositions(sourceText).map((position) =>
          positionAtOffset(sourceFile, position.offset),
        );

        expectMonotonicPositions(mappedPositions);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("maps generated EOF offsets to the final position", () => {
    fc.assert(
      fc.property(GENERATED_SOURCE_TEXT, (sourceText) => {
        const sourceFile = generatedSourceFile(sourceText);
        const finalPosition = finalExpectedPosition(sourceText);

        expect(positionAtOffset(sourceFile, sourceFile.byteLength)).toEqual(finalPosition);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("rejects generated invalid offsets", () => {
    fc.assert(
      fc.property(GENERATED_SOURCE_TEXT, fc.integer({ min: -2, max: 30 }), (sourceText, offset) => {
        const sourceFile = generatedSourceFile(sourceText);

        if (validOffsetSet(sourceText).has(offset)) {
          return;
        }

        expect(() => positionAtOffset(sourceFile, offset)).toThrow(SourceOffsetError);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("round-trips generated valid spans to original substrings", () => {
    fc.assert(
      fc.property(GENERATED_SOURCE_TEXT, (sourceText) => {
        const sourceFile = generatedSourceFile(sourceText);

        for (const start of expectedPositions(sourceText)) {
          for (const end of expectedPositions(sourceText)) {
            if (end.offset < start.offset) {
              continue;
            }

            const span = spanFromOffsets(sourceFile, start.offset, end.offset);
            expect(sliceSourceSpan(sourceFile, span)).toBe(
              originalSubstring(sourceText, start.offset, end.offset),
            );
          }
        }
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("rejects generated reversed span pairs", () => {
    fc.assert(
      fc.property(GENERATED_SOURCE_TEXT, (sourceText) => {
        const sourceFile = generatedSourceFile(sourceText);

        for (const start of expectedPositions(sourceText)) {
          for (const end of expectedPositions(sourceText)) {
            if (end.offset >= start.offset) {
              continue;
            }

            expect(() => spanFromOffsets(sourceFile, start.offset, end.offset)).toThrow(
              SourceOffsetError,
            );
          }
        }
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("rejects generated spans with mutated caller positions", () => {
    fc.assert(
      fc.property(GENERATED_SOURCE_TEXT, (sourceText) => {
        const sourceFile = generatedSourceFile(sourceText);
        const validSpan = spanFromOffsets(
          sourceFile,
          firstExpectedPosition(sourceText).offset,
          finalExpectedPosition(sourceText).offset,
        );

        expect(() =>
          sliceSourceSpan(sourceFile, {
            start: { ...validSpan.start, line: validSpan.start.line + 1 },
            end: validSpan.end,
          }),
        ).toThrow(SourceOffsetError);
        expect(() =>
          sliceSourceSpan(sourceFile, {
            start: validSpan.start,
            end: { ...validSpan.end, column: validSpan.end.column + 1 },
          }),
        ).toThrow(SourceOffsetError);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});
