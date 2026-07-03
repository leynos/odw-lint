/**
 * @file Shared normalized byte-range helpers for parser-span tests.
 */

import { utf8ByteLength } from "../../src/static-analysis/utf8";

export type NormalizedByteSpan = {
  readonly start: number;
  readonly end: number;
};

/**
 * Returns the UTF-8 byte length of a text slice.
 *
 * @param text - Source text slice to measure.
 * @returns UTF-8 byte length of `text`.
 */
export const byteLength = (text: string): number => {
  return utf8ByteLength(text);
};

/**
 * Builds a normalized byte range for a token inside a workflow body.
 *
 * @param bodyText - Original workflow body text.
 * @param token - Token text expected inside `bodyText`.
 * @param normalizedPrefixByteLength - Byte length of the injected normalized
 *   parser wrapper before the body text.
 * @returns Normalized-source byte range covering `token`.
 * @throws Error when `token` is not present in `bodyText` or when the token
 *   appears more than once.
 */
export const normalizedTokenRange = (
  bodyText: string,
  token: string,
  normalizedPrefixByteLength: number,
): NormalizedByteSpan => {
  const tokenStartIndex = bodyText.indexOf(token);
  if (tokenStartIndex < 0) {
    throw new Error(`Expected body to contain token ${token}.`);
  }
  const duplicateTokenIndex = bodyText.indexOf(token, tokenStartIndex + token.length);
  if (duplicateTokenIndex >= 0) {
    throw new Error(`Expected body to contain token ${token} exactly once.`);
  }

  const tokenStart = normalizedPrefixByteLength + byteLength(bodyText.slice(0, tokenStartIndex));

  return {
    start: tokenStart,
    end: tokenStart + byteLength(token),
  };
};

/**
 * Converts a normalized range to body-relative parser coordinates.
 *
 * @param range - Normalized-source byte range to convert.
 * @param normalizedPrefixByteLength - Byte length of the injected normalized
 *   parser wrapper before the body text.
 * @returns Body-relative byte range for parser errors that report body
 *   coordinates.
 */
export const bodyRelativeRange = (
  range: NormalizedByteSpan,
  normalizedPrefixByteLength: number,
): NormalizedByteSpan => {
  return {
    start: range.start - normalizedPrefixByteLength,
    end: range.end - normalizedPrefixByteLength,
  };
};
