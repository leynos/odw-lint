/**
 * @file Directive-scan source masks for workflow suppression comments.
 */

import { maskNonCodeSource } from "./source-mask";
import type { SourceMaskRange } from "./source-mask-types";
import type { OriginalSourceFile } from "./types";

export type WorkflowSuppressionMasks = Readonly<{
  sourceFile: OriginalSourceFile;
  directiveScanText: string;
  inertRanges: readonly SourceMaskRange[];
}>;

/**
 * Builds a directive-scan view with line comments visible.
 *
 * @param sourceFile - Factory-created original workflow source file.
 * @returns Frozen suppression-mask facts aligned to the original source text.
 */
export const buildSuppressionMasks = (sourceFile: OriginalSourceFile): WorkflowSuppressionMasks => {
  const maskedSource = maskNonCodeSource(sourceFile);
  const directiveCharacters = maskedSource.maskedText.split("");
  const inertRanges: SourceMaskRange[] = [];

  for (const range of maskedSource.ranges) {
    if (isLineCommentRange(sourceFile.sourceText, range)) {
      revealRange(directiveCharacters, sourceFile.sourceText, range);
      continue;
    }
    inertRanges.push(range);
  }

  // `maskNonCodeSource` emits sorted, non-overlapping ranges; filtering line
  // comments preserves that order for the binary search predicate below.
  return Object.freeze({
    sourceFile,
    directiveScanText: directiveCharacters.join(""),
    inertRanges: Object.freeze(inertRanges),
  });
};

/**
 * Checks whether one UTF-16 source-text index falls inside an inert region.
 *
 * @param masks - Suppression masks returned by `buildSuppressionMasks`.
 * @param index - UTF-16 source-text index to classify.
 * @returns Whether the index is inside a blanked directive-scan range.
 */
export const isIndexInInertRegion = (masks: WorkflowSuppressionMasks, index: number): boolean => {
  let lowIndex = 0;
  let highIndex = masks.inertRanges.length - 1;

  while (lowIndex <= highIndex) {
    const midpoint = Math.floor((lowIndex + highIndex) / 2);
    const range = masks.inertRanges[midpoint];
    if (range === undefined) {
      return false;
    }
    if (index < range.startIndex) {
      highIndex = midpoint - 1;
      continue;
    }
    if (index >= range.endIndex) {
      lowIndex = midpoint + 1;
      continue;
    }

    return true;
  }

  return false;
};

/** Checks whether a comment range is a JavaScript line comment. */
const isLineCommentRange = (sourceText: string, range: SourceMaskRange): boolean => {
  if (range.kind !== "comment") {
    return false;
  }

  return sourceText[range.startIndex + 1] === "/";
};

/** Copies original characters back into a masked range. */
const revealRange = (characters: string[], sourceText: string, range: SourceMaskRange): void => {
  for (let index = range.startIndex; index < range.endIndex; index += 1) {
    characters[index] = sourceText[index] ?? "";
  }
};
