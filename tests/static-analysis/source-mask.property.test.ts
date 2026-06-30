/**
 * @file Property tests for inert-region source masking.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import {
  createOriginalSourceFile,
  maskNonCodeSource,
  type SourceMaskKind,
  type SourceMaskRange,
} from "odw-lint";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";

type SegmentKind = SourceMaskKind | "code" | "division";

type LabelledSegment = {
  readonly kind: SegmentKind;
  readonly text: string;
};

type ExpectedMask = {
  readonly sourceText: string;
  readonly ranges: readonly SourceMaskRange[];
};

const SOURCE_SEGMENT = fc.constantFrom<LabelledSegment>(
  { kind: "code", text: "const value = 1;\n" },
  { kind: "code", text: "if (value) " },
  { kind: "comment", text: "// export const meta = {}\n" },
  { kind: "comment", text: "/* import fake */" },
  { kind: "string", text: '"export const meta = {}"' },
  { kind: "string", text: "'import fake'" },
  { kind: "template", text: "`import fake $" + "{exported}`" },
  { kind: "template", text: "`plain template`" },
  { kind: "regex", text: "/export\\s+const/g" },
  { kind: "regex", text: "/unterminated\nregex/" },
  { kind: "division", text: " / divisor" },
  { kind: "division", text: " / 2" },
);
const GENERATED_MASK_SOURCE = fc.array(SOURCE_SEGMENT, { minLength: 1, maxLength: 16 });
const REGEX_ALLOWED_PREVIOUS_CHARACTERS = new Set("([{,;:=!&|?+-*%<>~^".split(""));

/** Builds expected source and ranges independently from production masking. */
const expectedMaskFor = (segments: readonly LabelledSegment[]): ExpectedMask => {
  const ranges: SourceMaskRange[] = [];
  let sourceText = "";
  let previousSignificantCharacter = "";

  for (const segment of segments) {
    const startIndex = sourceText.length;
    const text = materializedSegmentText(segment, previousSignificantCharacter);
    sourceText += text;
    const range = expectedRangeFor(segment, text, startIndex, previousSignificantCharacter);

    if (range !== undefined) {
      ranges.push(range);
    }
    previousSignificantCharacter = nextPreviousSignificantCharacter(
      previousSignificantCharacter,
      segment,
      text,
    );
  }

  return { sourceText, ranges };
};

/** Materializes regex and division segments in contexts that prove the contract. */
const materializedSegmentText = (
  segment: LabelledSegment,
  previousSignificantCharacter: string,
): string => {
  if (segment.kind === "regex") {
    return materializedRegexText(segment.text, previousSignificantCharacter);
  }
  if (segment.kind === "division" && isRegexAllowedAfter(previousSignificantCharacter)) {
    return `value${segment.text}`;
  }

  return segment.text;
};

/** Materializes generated regex-labelled text in a deliberate context. */
const materializedRegexText = (text: string, previousSignificantCharacter: string): string => {
  if (hasRegexLineTerminatorBeforeClose(text)) {
    const prefix = isRegexAllowedAfter(previousSignificantCharacter) ? "" : "value ";
    return `${prefix}${text};`;
  }
  if (!isRegexAllowedAfter(previousSignificantCharacter)) {
    return `value ${text};`;
  }

  return `${text};`;
};

/** Builds one expected mask range when the independent oracle says it exists. */
const expectedRangeFor = (
  segment: LabelledSegment,
  text: string,
  startIndex: number,
  previousSignificantCharacter: string,
): SourceMaskRange | undefined => {
  if (segment.kind === "code" || segment.kind === "division") {
    return undefined;
  }
  if (segment.kind === "regex" && hasRegexLineTerminatorBeforeClose(text)) {
    return undefined;
  }
  if (segment.kind === "regex" && !isRegexAllowedAfter(previousSignificantCharacter)) {
    return undefined;
  }

  return {
    kind: segment.kind,
    startIndex,
    endIndex: startIndex + maskableTextLength(segment, text),
  };
};

/** Returns the part of a materialized segment expected to be masked. */
const maskableTextLength = (segment: LabelledSegment, text: string): number => {
  if (segment.kind === "regex") {
    return segment.text.length;
  }

  return text.length;
};

/** Computes the next visible context token for generated source. */
const nextPreviousSignificantCharacter = (
  previousSignificantCharacter: string,
  segment: LabelledSegment,
  text: string,
): string => {
  if (segment.kind === "comment") {
    return previousSignificantCharacter;
  }

  return lastSignificantCharacter(text) ?? previousSignificantCharacter;
};

/** Finds the last non-whitespace character in one generated segment. */
const lastSignificantCharacter = (text: string): string | undefined => {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    const character = text[index] ?? "";
    if (!/\s/u.test(character)) {
      return character;
    }
  }

  return undefined;
};

/** Checks whether a regex segment has an early JavaScript line terminator. */
const hasRegexLineTerminatorBeforeClose = (text: string): boolean => {
  for (let index = 1; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (isLineTerminatorCharacter(character)) {
      return true;
    }
    if (character === "/" && text[index - 1] !== "\\") {
      return false;
    }
  }

  return false;
};

/** Checks whether a character is a JavaScript line terminator. */
const isLineTerminatorCharacter = (character: string): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

/** Mirrors the ODW preceding-significant-character regex heuristic. */
const isRegexAllowedAfter = (previousSignificantCharacter: string): boolean => {
  return (
    previousSignificantCharacter === "" ||
    REGEX_ALLOWED_PREVIOUS_CHARACTERS.has(previousSignificantCharacter)
  );
};

/** Builds expected masked text from independent ranges. */
const expectedMaskedText = (sourceText: string, ranges: readonly SourceMaskRange[]): string => {
  const characters = sourceText.split("");

  for (const range of ranges) {
    for (let index = range.startIndex; index < range.endIndex; index += 1) {
      const character = sourceText[index] ?? "";
      characters[index] = isLineTerminatorCharacter(character) ? character : " ";
    }
  }

  return characters.join("");
};

/** Asserts range order and non-overlap invariants. */
const expectNonOverlappingRanges = (ranges: readonly SourceMaskRange[]): void => {
  let previousEndIndex = 0;

  for (const range of ranges) {
    expect(range.startIndex).toBeGreaterThanOrEqual(previousEndIndex);
    expect(range.endIndex).toBeGreaterThanOrEqual(range.startIndex);
    previousEndIndex = range.endIndex;
  }
};

/** Asserts that code outside expected mask ranges is preserved. */
const expectVisibleCodePreserved = (
  sourceText: string,
  maskedText: string,
  ranges: readonly SourceMaskRange[],
): void => {
  for (let index = 0; index < sourceText.length; index += 1) {
    if (!ranges.some((range) => index >= range.startIndex && index < range.endIndex)) {
      expect(maskedText[index]).toBe(sourceText[index]);
    }
  }
};

describe("source mask properties", () => {
  it("preserves generated source shape and masks expected inert ranges", () => {
    fc.assert(
      fc.property(GENERATED_MASK_SOURCE, (segments) => {
        const expected = expectedMaskFor(segments);
        const sourceFile = createOriginalSourceFile({
          filePath: "workflows/generated-mask.js",
          sourceText: expected.sourceText,
        });
        const maskedSource = maskNonCodeSource(sourceFile);

        expect(maskedSource.maskedText).toHaveLength(expected.sourceText.length);
        expect(maskedSource.ranges).toEqual(expected.ranges);
        expect(maskedSource.maskedText).toBe(
          expectedMaskedText(expected.sourceText, expected.ranges),
        );
        expectNonOverlappingRanges(maskedSource.ranges);
        expectVisibleCodePreserved(expected.sourceText, maskedSource.maskedText, expected.ranges);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});
