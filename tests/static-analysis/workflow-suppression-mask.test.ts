/**
 * @file Tests for workflow suppression directive source masks.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { createOriginalSourceFile } from "odw-lint";
import {
  buildSuppressionMasks,
  isIndexInInertRegion,
} from "../../src/static-analysis/workflow-suppression-mask";

const DECOY_DIRECTIVE = "odw-lint-disable";
const PROPERTY_RUNNER = { numRuns: 100 } as const;

type DecoyCase = Readonly<{
  label: string;
  sourceText: string;
  markerText: string;
}>;

/** Creates an original source file for suppression-mask tests. */
const sourceFileFor = (sourceText: string) =>
  createOriginalSourceFile({ filePath: "workflows/suppression-mask.js", sourceText });

/** Finds a required marker index with a useful failure message. */
const markerIndex = (sourceText: string, markerText: string): number => {
  const index = sourceText.indexOf(markerText);

  expect(index, `missing marker ${markerText}`).toBeGreaterThanOrEqual(0);

  return index;
};

/** Finds every line terminator position in source text. */
const lineTerminatorIndexes = (sourceText: string): readonly number[] => {
  const indexes: number[] = [];

  for (let index = 0; index < sourceText.length; index += 1) {
    if (isLineTerminator(sourceText[index])) {
      indexes.push(index);
    }
  }

  return indexes;
};

/** Checks for JavaScript line terminator characters. */
const isLineTerminator = (character: string | undefined): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

describe("buildSuppressionMasks", () => {
  it("keeps line-comment directives visible and non-inert", () => {
    const sourceText = `export const meta = { name: "mask", description: "ok" };\n// ${DECOY_DIRECTIVE}\n`;
    const sourceFile = sourceFileFor(sourceText);
    const masks = buildSuppressionMasks(sourceFile);
    const directiveIndex = markerIndex(sourceText, DECOY_DIRECTIVE);

    expect(JSON.stringify(masks.directiveScanText)).toMatchSnapshot();
    expect(masks.sourceFile).toBe(sourceFile);
    expect(masks.directiveScanText).toContain(`// ${DECOY_DIRECTIVE}`);
    expect(isIndexInInertRegion(masks, directiveIndex)).toBeFalse();
    expect(Object.isFrozen(masks)).toBeTrue();
    expect(Object.isFrozen(masks.inertRanges)).toBeTrue();
  });

  for (const { label, sourceText, markerText } of [
    {
      label: "quoted string",
      sourceText: `const value = "${DECOY_DIRECTIVE}";\n// real directive stays visible\n`,
      markerText: DECOY_DIRECTIVE,
    },
    {
      label: "template literal",
      sourceText: `const value = \`before ${DECOY_DIRECTIVE} after\`;\n// real directive stays visible\n`,
      markerText: DECOY_DIRECTIVE,
    },
    {
      label: "regex literal",
      sourceText: `const value = /${DECOY_DIRECTIVE}/g;\n// real directive stays visible\n`,
      markerText: DECOY_DIRECTIVE,
    },
    {
      label: "block comment",
      sourceText: `/* ${DECOY_DIRECTIVE} */\n// real directive stays visible\n`,
      markerText: DECOY_DIRECTIVE,
    },
  ] satisfies readonly DecoyCase[]) {
    it(`blanks directive-like text inside ${label}`, () => {
      const masks = buildSuppressionMasks(sourceFileFor(sourceText));
      const decoyIndex = markerIndex(sourceText, markerText);

      expect(JSON.stringify(masks.directiveScanText)).toMatchSnapshot();
      expect(masks.directiveScanText.indexOf(markerText)).toBe(-1);
      expect(isIndexInInertRegion(masks, decoyIndex)).toBeTrue();
    });
  }

  it("preserves source length and line terminators across multi-line masks", () => {
    const sourceText = [
      "const before = 1;",
      "/* block start",
      `${DECOY_DIRECTIVE}`,
      "block end */",
      `// ${DECOY_DIRECTIVE}`,
      "const after = 2;",
    ].join("\n");
    const masks = buildSuppressionMasks(sourceFileFor(sourceText));

    expect(JSON.stringify(masks.directiveScanText)).toMatchSnapshot();
    expect(masks.directiveScanText).toHaveLength(sourceText.length);
    for (const index of lineTerminatorIndexes(sourceText)) {
      expect(masks.directiveScanText[index]).toBe(sourceText[index]);
    }

    const blockDirectiveIndex = markerIndex(sourceText, DECOY_DIRECTIVE);
    const lineDirectiveIndex = sourceText.lastIndexOf(DECOY_DIRECTIVE);
    expect(isIndexInInertRegion(masks, blockDirectiveIndex)).toBeTrue();
    expect(isIndexInInertRegion(masks, lineDirectiveIndex)).toBeFalse();
  });

  it("preserves mask invariants for generated directive sources", () => {
    const textFragment = fc
      .array(fc.constantFrom("a", "b", "c", " ", "_", "-"), { maxLength: 16 })
      .map((characters) => characters.join(""));

    fc.assert(
      fc.property(textFragment, textFragment, (prefix, suffix) => {
        const sourceText = [
          `const prefix = "${prefix}";`,
          `/* ${DECOY_DIRECTIVE} ${suffix} */`,
          `// ${DECOY_DIRECTIVE}`,
          `const suffix = "${suffix}";`,
        ].join("\n");
        const masks = buildSuppressionMasks(sourceFileFor(sourceText));
        const blockDirectiveIndex = markerIndex(sourceText, DECOY_DIRECTIVE);
        const lineDirectiveIndex = sourceText.lastIndexOf(DECOY_DIRECTIVE);

        expect(masks.directiveScanText).toHaveLength(sourceText.length);
        for (const index of lineTerminatorIndexes(sourceText)) {
          expect(masks.directiveScanText[index]).toBe(sourceText[index]);
        }
        expect(isIndexInInertRegion(masks, blockDirectiveIndex)).toBeTrue();
        expect(isIndexInInertRegion(masks, lineDirectiveIndex)).toBeFalse();
      }),
      PROPERTY_RUNNER,
    );
  });
});
