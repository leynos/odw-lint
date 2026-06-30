/**
 * @file Source-mask contract tests.
 */

import { describe, expect, it } from "bun:test";
import {
  createOriginalSourceFile,
  maskNonCodeSource,
  type SourceMaskKind,
  type SourceMaskRange,
} from "../../src";

type ExpectedRange = {
  readonly kind: SourceMaskKind;
  readonly text: string;
};

/** Creates an original source file for source-mask tests. */
const sourceFileFor = (sourceText: string) =>
  createOriginalSourceFile({ filePath: "fixtures/source-mask.js", sourceText });

/** Checks whether a character should survive range blanking. */
const isLineTerminatorCharacter = (character: string | undefined): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

/** Builds the expected masked text from independent test ranges. */
const expectedMaskedText = (
  sourceText: string,
  ranges: readonly Pick<SourceMaskRange, "startIndex" | "endIndex">[],
): string => {
  const characters = sourceText.split("");

  for (const range of ranges) {
    for (let index = range.startIndex; index < range.endIndex; index += 1) {
      const character = sourceText[index];
      characters[index] = isLineTerminatorCharacter(character) ? (character ?? "") : " ";
    }
  }

  return characters.join("");
};

/** Asserts source-mask output against expected ranges and invariants. */
const assertMaskContract = (sourceText: string, expectedRanges: readonly ExpectedRange[]): void => {
  const maskedSource = maskNonCodeSource(sourceFileFor(sourceText));
  let searchStartIndex = 0;
  const expectedRangesWithIndexes = expectedRanges.map((range) => {
    const startIndex = sourceText.indexOf(range.text, searchStartIndex);
    expect(startIndex, `missing expected range text ${range.text}`).toBeGreaterThanOrEqual(0);
    searchStartIndex = startIndex + range.text.length;

    return {
      kind: range.kind,
      startIndex,
      endIndex: startIndex + range.text.length,
    };
  });

  expect(Object.isFrozen(maskedSource)).toBeTrue();
  expect(Object.isFrozen(maskedSource.ranges)).toBeTrue();
  for (const range of maskedSource.ranges) {
    expect(Object.isFrozen(range)).toBeTrue();
  }

  expect(maskedSource.sourceFile).toBeInstanceOf(Object);
  expect(maskedSource.maskedText).toHaveLength(sourceText.length);
  expect(maskedSource.ranges).toEqual(expectedRangesWithIndexes);
  expect(maskedSource.maskedText).toBe(expectedMaskedText(sourceText, expectedRangesWithIndexes));
  assertRangesAreSortedBoundedAndDisjoint(sourceText, maskedSource.ranges);
  assertLineTerminatorsArePreserved(sourceText, maskedSource.maskedText);
  assertCodeOutsideRangesIsPreserved(sourceText, maskedSource.maskedText, maskedSource.ranges);
};

/** Asserts that ranges are in ascending order and inside the source text. */
const assertRangesAreSortedBoundedAndDisjoint = (
  sourceText: string,
  ranges: readonly SourceMaskRange[],
): void => {
  let previousEndIndex = 0;

  for (const range of ranges) {
    expect(range.startIndex).toBeGreaterThanOrEqual(previousEndIndex);
    expect(range.endIndex).toBeGreaterThanOrEqual(range.startIndex);
    expect(range.endIndex).toBeLessThanOrEqual(sourceText.length);
    expect(["comment", "string", "template", "regex"]).toContain(range.kind);
    previousEndIndex = range.endIndex;
  }
};

/** Asserts that masking never changes JavaScript line terminators. */
const assertLineTerminatorsArePreserved = (sourceText: string, maskedText: string): void => {
  for (let index = 0; index < sourceText.length; index += 1) {
    if (isLineTerminatorCharacter(sourceText[index])) {
      expect(maskedText[index]).toBe(sourceText[index]);
    }
  }
};

/** Asserts that code outside mask ranges is byte-for-byte preserved. */
const assertCodeOutsideRangesIsPreserved = (
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

describe("maskNonCodeSource", () => {
  it("masks line and block comments while preserving CRLF", () => {
    assertMaskContract("const a = 1; // export const meta = {}\r\n/* import x */\nconst b = 2;", [
      { kind: "comment", text: "// export const meta = {}\r\n" },
      { kind: "comment", text: "/* import x */" },
    ]);
  });

  it("masks unterminated block comments through end of file", () => {
    assertMaskContract("const a = 1; /* export const meta = {", [
      { kind: "comment", text: "/* export const meta = {" },
    ]);
  });

  it("masks quoted strings with escaped delimiters", () => {
    assertMaskContract('const a = \'export \\\' meta\'; const b = "import \\"x\\"";', [
      { kind: "string", text: "'export \\' meta'" },
      { kind: "string", text: '"import \\"x\\""' },
    ]);
  });

  it("masks whole template literals including interpolation", () => {
    const templateText = "`text $" + "{`import fake $" + "{nested}`} export const meta = {}`";

    assertMaskContract(`const a = ${templateText}; const b = 1;`, [
      { kind: "template", text: templateText },
    ]);
  });

  it("masks regex literals after ODW-allowed preceding characters", () => {
    assertMaskContract("const a = (/a\\/[b/]/g); const b = /export\\s+const/g;", [
      { kind: "regex", text: "/a\\/[b/]/g" },
      { kind: "regex", text: "/export\\s+const/g" },
    ]);
  });

  it("leaves division-like slashes visible after string, template, and regex expressions", () => {
    const templateText = "`template`";

    assertMaskContract(
      `const a = "string" / b; const c = ${templateText} / d; const e = /x/ / f;`,
      [
        { kind: "string", text: '"string"' },
        { kind: "template", text: templateText },
        { kind: "regex", text: "/x/" },
      ],
    );
  });

  it("leaves unterminated regex candidates visible at JavaScript line terminators", () => {
    for (const terminator of ["\n", "\r", "\u2028", "\u2029"]) {
      const sourceText = `const a = (/export${terminator}const b = 1;`;
      const maskedSource = maskNonCodeSource(sourceFileFor(sourceText));

      expect(maskedSource.ranges).toEqual([]);
      expect(maskedSource.maskedText).toBe(sourceText);
    }
  });

  it("leaves division-like slashes visible", () => {
    assertMaskContract("const ratio = total / count / 2;", []);
  });
});
