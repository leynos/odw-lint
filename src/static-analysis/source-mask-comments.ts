/**
 * @file Comment range scanning for source masking.
 *
 * This module owns line and block comment token detection so the source-mask
 * facade can compose comment handling without carrying comment-specific state.
 */

import { createMaskedRange, isLineTerminatorCharacter } from "./source-mask-delimiters";
import type { SourceMaskRange } from "./source-mask-types";

/**
 * Scans line or block comments from a slash position.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index of the candidate slash.
 * @param character - Character at the candidate start index.
 * @param nextCharacter - Character immediately after the candidate slash.
 * @returns Comment mask range, or `undefined` when no comment starts here.
 */
export const scanCommentRange = (
  sourceText: string,
  startIndex: number,
  character: string,
  nextCharacter: string,
): SourceMaskRange | undefined => {
  if (!isCommentStart(character, nextCharacter)) {
    return undefined;
  }
  if (nextCharacter === "/") {
    return createMaskedRange("comment", startIndex, scanLineCommentEnd(sourceText, startIndex + 2));
  }
  const terminatorIndex = sourceText.indexOf("*/", startIndex + 2);
  const endIndex = terminatorIndex === -1 ? sourceText.length : terminatorIndex + 2;

  return createMaskedRange("comment", startIndex, endIndex);
};

/**
 * Checks for comment start characters.
 *
 * @param character - Character at the candidate start index.
 * @param nextCharacter - Character immediately after the candidate slash.
 * @returns Whether the characters open a JavaScript comment.
 */
export const isCommentStart = (character: string, nextCharacter: string): boolean => {
  if (character !== "/") {
    return false;
  }

  return nextCharacter === "/" || nextCharacter === "*";
};

/**
 * Finds a line comment end.
 *
 * @param sourceText - Original source text to scan.
 * @param startIndex - UTF-16 index immediately after the `//` marker.
 * @returns Exclusive end index for the line comment range.
 */
export const scanLineCommentEnd = (sourceText: string, startIndex: number): number => {
  let index = startIndex;

  while (index < sourceText.length) {
    if (isLineTerminatorCharacter(sourceText[index] ?? "")) {
      if (sourceText[index] === "\r" && sourceText[index + 1] === "\n") {
        return index + 2;
      }

      return index + 1;
    }
    index += 1;
  }

  return sourceText.length;
};
