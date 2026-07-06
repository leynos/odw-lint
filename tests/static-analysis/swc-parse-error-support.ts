/**
 * @file Shared helpers for observing the real SWC parser-error surface.
 */

import { parseSync } from "@swc/core";

export const SWC_PARSE_ERROR_TEST_OPTIONS = {
  syntax: "ecmascript",
  jsx: false,
} as const;

/**
 * Captures the thrown SWC parser error for a normalized source string.
 *
 * @param normalizedText - Malformed normalized workflow source passed to SWC.
 * @returns The value thrown by `parseSync`.
 * @throws Error when SWC unexpectedly accepts the malformed source.
 */
export const catchSwcParseError = (normalizedText: string): unknown => {
  try {
    parseSync(normalizedText, SWC_PARSE_ERROR_TEST_OPTIONS);
  } catch (error) {
    return error;
  }

  throw new Error("Expected SWC to reject malformed normalized source.");
};
