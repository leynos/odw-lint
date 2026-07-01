/**
 * @file Inert-region source masking for static envelope scans.
 *
 * This module blanks comments, quoted strings, whole template literals, and
 * ODW-recognized regex literals while preserving original UTF-16 indexes.
 */

import { scanCommentRange } from "./source-mask-comments";
import { blankMaskedRange } from "./source-mask-delimiters";
import { scanRegexRange } from "./source-mask-regex";
import { scanQuotedStringRange } from "./source-mask-strings";
import { scanTemplateRange } from "./source-mask-templates";
import type { MaskedSource, SourceMaskRange } from "./source-mask-types";
import type { OriginalSourceFile } from "./types";

export type { MaskedSource, SourceMaskKind, SourceMaskRange } from "./source-mask-types";

/**
 * Masks inert source regions while leaving code and line terminators aligned.
 *
 * @param sourceFile - Factory-created original source file to mask.
 * @returns Frozen masked source data aligned to the original source text.
 */
export const maskNonCodeSource = (sourceFile: OriginalSourceFile): MaskedSource => {
  const sourceText = sourceFile.sourceText;
  const characters = sourceText.split("");
  const ranges: SourceMaskRange[] = [];
  let previousSignificantCharacter = "";
  let previousSignificantToken = "";
  let index = 0;

  while (index < sourceText.length) {
    const range = scanMaskRange(
      sourceText,
      index,
      previousSignificantCharacter,
      previousSignificantToken,
    );

    if (range !== undefined) {
      blankMaskedRange(characters, sourceText, range);
      ranges.push(range);
      previousSignificantToken = nextSignificantTokenAfterRange(
        sourceText,
        range,
        previousSignificantToken,
      );
      previousSignificantCharacter = nextSignificantCharacterAfterRange(
        sourceText,
        range,
        previousSignificantCharacter,
      );
      index = range.endIndex;
      continue;
    }

    const character = sourceText[index] ?? "";
    if (!/\s/u.test(character)) {
      previousSignificantCharacter = character;
      previousSignificantToken = significantTokenEndingAt(sourceText, index);
    }
    index += 1;
  }

  const frozenRanges = Object.freeze(ranges.map((range) => Object.freeze(range)));

  return Object.freeze({
    sourceFile,
    maskedText: characters.join(""),
    ranges: frozenRanges,
  });
};

/** Preserves expression context across masked non-comment tokens. */
const nextSignificantCharacterAfterRange = (
  sourceText: string,
  range: SourceMaskRange,
  previousSignificantCharacter: string,
): string => {
  if (range.kind === "comment") {
    return previousSignificantCharacter;
  }
  return lastSignificantCharacterInRange(sourceText, range) ?? previousSignificantCharacter;
};

/** Preserves token context across masked non-comment tokens. */
const nextSignificantTokenAfterRange = (
  sourceText: string,
  range: SourceMaskRange,
  previousSignificantToken: string,
): string => {
  if (range.kind === "comment") {
    return previousSignificantToken;
  }
  return lastSignificantTokenInRange(sourceText, range) ?? previousSignificantToken;
};

/** Finds the final non-whitespace source character inside a masked range. */
const lastSignificantCharacterInRange = (
  sourceText: string,
  range: SourceMaskRange,
): string | undefined => {
  for (let index = range.endIndex - 1; index >= range.startIndex; index -= 1) {
    const character = sourceText[index] ?? "";
    if (!/\s/u.test(character)) {
      return character;
    }
  }
  return undefined;
};

/** Finds the final non-whitespace token inside a masked range. */
const lastSignificantTokenInRange = (
  sourceText: string,
  range: SourceMaskRange,
): string | undefined => {
  for (let index = range.endIndex - 1; index >= range.startIndex; index -= 1) {
    if (!/\s/u.test(sourceText[index] ?? "")) {
      return significantTokenEndingAt(sourceText, index);
    }
  }
  return undefined;
};

/** Finds the source token ending at a non-whitespace index. */
const significantTokenEndingAt = (sourceText: string, index: number): string => {
  const character = sourceText[index] ?? "";
  if (!/[A-Za-z0-9_$]/u.test(character)) {
    return significantOperatorEndingAt(sourceText, index);
  }

  let cursor = index;
  while (cursor >= 0 && /[A-Za-z0-9_$]/u.test(sourceText[cursor] ?? "")) {
    cursor -= 1;
  }

  return sourceText.slice(cursor + 1, index + 1);
};

/** Finds a compact operator token ending at a non-identifier index. */
const significantOperatorEndingAt = (sourceText: string, index: number): string => {
  const character = sourceText[index] ?? "";
  const previousCharacter = sourceText[index - 1] ?? "";
  if (character === "+" && previousCharacter === "+") {
    return "++";
  }
  if (character === "-" && previousCharacter === "-") {
    return "--";
  }

  return character;
};

/** Scans for any maskable range at one source-text index. */
const scanMaskRange = (
  sourceText: string,
  startIndex: number,
  previousSignificantCharacter: string,
  previousSignificantToken: string,
): SourceMaskRange | undefined => {
  const character = sourceText[startIndex] ?? "";
  const nextCharacter = sourceText[startIndex + 1] ?? "";
  return (
    scanCommentRange(sourceText, startIndex, character, nextCharacter) ??
    scanQuotedStringRange(sourceText, startIndex, character) ??
    scanTemplateRange(sourceText, startIndex, character) ??
    scanRegexRange(
      sourceText,
      startIndex,
      character,
      previousSignificantCharacter,
      previousSignificantToken,
    )
  );
};
