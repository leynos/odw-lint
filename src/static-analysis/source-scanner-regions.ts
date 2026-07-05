/** @file Region-level scanner loops shared by static source scanners. */

import {
  commentDispatchEnd,
  indexAfterEscapedUnit,
  isCrLfAt,
  isSourceLineTerminator,
  isStringLikeDelimiter,
} from "./source-scanner-primitives";

export type DelimitedRegionOptions = Readonly<{
  readonly endIndex?: number;
  readonly allowTemplateInterpolation?: boolean;
  readonly terminateAtLineTerminator?: boolean;
  readonly nextTemplateExpressionEnd?: (
    text: string,
    startIndex: number,
    endIndex: number,
  ) => number;
}>;

export type BalancedExpressionOptions = Readonly<{
  readonly open: "{" | "[" | "(";
  readonly close: "}" | "]" | ")";
  readonly initiallyOpen?: boolean;
  readonly nextInertRegionEnd?: (
    text: string,
    index: number,
    endIndex: number,
  ) => number | undefined;
}>;

/** Finds the index after a backslash escape in a delimited region. */
const escapedDelimitedContinuationEnd = (
  text: string,
  backslashIndex: number,
  shouldTreatCrLfAsContinuation: boolean,
): number => {
  const escapedEndIndex = indexAfterEscapedUnit(text, backslashIndex);
  if (shouldTreatCrLfAsContinuation && isCrLfAt(text, escapedEndIndex - 1)) {
    return escapedEndIndex + 1;
  }
  return escapedEndIndex;
};

/** Checks whether a template delimiter starts an interpolation expression. */
const isTemplateInterpolationStart = (
  text: string,
  index: number,
  delimiter: string,
  shouldAllowTemplateInterpolation: boolean,
): boolean => {
  if (!shouldAllowTemplateInterpolation || delimiter !== "`") {
    return false;
  }
  return text.startsWith("${", index);
};

/** Finds the skip target for escaped units or template interpolation. */
const delimitedRegionSkipEnd = (
  text: string,
  index: number,
  delimiter: string,
  endIndex: number,
  options: DelimitedRegionOptions,
): number | undefined => {
  const shouldTerminateAtLine = options.terminateAtLineTerminator === true;
  if (text[index] === "\\") {
    return escapedDelimitedContinuationEnd(text, index, shouldTerminateAtLine);
  }
  if (
    isTemplateInterpolationStart(
      text,
      index,
      delimiter,
      options.allowTemplateInterpolation === true,
    )
  ) {
    return (options.nextTemplateExpressionEnd ?? templateExpressionEnd)(text, index + 2, endIndex);
  }
  return undefined;
};

/** Finds a delimited region close or line-terminator stop. */
const delimitedRegionEndIndex = (
  character: string,
  index: number,
  delimiter: string,
  shouldTerminateAtLine: boolean,
): number | undefined => {
  if (shouldTerminateAtLine && isSourceLineTerminator(character)) {
    return index;
  }
  if (character === delimiter) {
    return index + 1;
  }
  return undefined;
};

/**
 * Finds the end of a backslash-escaped delimited source region.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive index of the opening delimiter.
 * @param delimiter - Source delimiter that closes the region.
 * @param options - Scan bound and grammar options for the owning scanner.
 * @returns The index after the closing delimiter, the line terminator index
 * when line termination is enabled, or the scan bound when unterminated.
 */
export const scanDelimitedRegionEnd = (
  text: string,
  startIndex: number,
  delimiter: string,
  options: DelimitedRegionOptions = {},
): number => {
  const endIndex = options.endIndex ?? text.length;
  const shouldTerminateAtLine = options.terminateAtLineTerminator === true;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const character = text[index] ?? "";
    const skipEndIndex = delimitedRegionSkipEnd(text, index, delimiter, endIndex, options);
    if (skipEndIndex !== undefined) {
      index = skipEndIndex - 1;
      continue;
    }
    const closeIndex = delimitedRegionEndIndex(character, index, delimiter, shouldTerminateAtLine);
    if (closeIndex !== undefined) {
      return closeIndex;
    }
  }

  return endIndex;
};

/**
 * Finds the end of an inert string-like or comment region.
 *
 * @param text - Source text to scan.
 * @param index - Inclusive index of a possible inert-region opener.
 * @param endIndex - Exclusive maximum scan index.
 * @returns Exclusive inert-region end index, or `undefined` for ordinary code.
 */
export const nextInertRegionEnd = (
  text: string,
  index: number,
  endIndex: number,
): number | undefined => {
  const commentEndIndex = commentDispatchEnd(text, index, endIndex);
  if (commentEndIndex !== undefined) {
    return commentEndIndex;
  }

  const character = text[index] ?? "";
  if (isStringLikeDelimiter(character)) {
    return scanDelimitedRegionEnd(text, index, character, {
      endIndex,
      allowTemplateInterpolation: true,
    });
  }

  return undefined;
};

/** Updates a single-pair balanced-expression depth for ordinary code. */
const nextBalancedExpressionDepth = (
  depth: number,
  character: string,
  options: BalancedExpressionOptions,
): number => {
  if (character === options.open) {
    return depth + 1;
  }
  if (character === options.close) {
    return depth - 1;
  }

  return depth;
};

/**
 * Finds the end of a single-pair balanced expression.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive index where the balanced scan begins.
 * @param endIndex - Exclusive maximum scan index.
 * @param options - Delimiter pair and initial-depth contract.
 * @returns The index after the matching close, or `endIndex` when unterminated.
 */
export const scanBalancedExpressionEnd = (
  text: string,
  startIndex: number,
  endIndex: number,
  options: BalancedExpressionOptions,
): number => {
  let depth = options.initiallyOpen === true ? 1 : 0;
  const inertRegionEnd = options.nextInertRegionEnd ?? nextInertRegionEnd;

  for (let index = startIndex; index < endIndex; index += 1) {
    const inertEndIndex = inertRegionEnd(text, index, endIndex);
    if (inertEndIndex !== undefined) {
      index = inertEndIndex - 1;
      continue;
    }

    const character = text[index] ?? "";
    depth = nextBalancedExpressionDepth(depth, character, options);
    if (character === options.close && depth === 0) {
      return index + 1;
    }
  }

  return endIndex;
};

/**
 * Scans a template interpolation expression while respecting nested delimiters.
 *
 * @param text - Source text to scan.
 * @param start - Inclusive index after the opening `${`.
 * @param end - Exclusive maximum scan index.
 * @returns The index after the matching `}`, or `end` when unterminated.
 */
export const templateExpressionEnd = (text: string, start: number, end: number): number => {
  return scanBalancedExpressionEnd(text, start, end, {
    open: "{",
    close: "}",
    initiallyOpen: true,
  });
};
