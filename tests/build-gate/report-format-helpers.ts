/**
 * @file Shared helpers for small build-gate report formatters.
 */

/**
 * Collapse caller-owned text into one report line.
 *
 * @param value - Untrusted text that may contain whitespace or line breaks.
 * @returns A trimmed single-line representation for stable CLI reports.
 * @example
 * singleLine("first\nsecond")
 * // => "first second"
 */
export const singleLine = (value: string): string => {
  return value.replaceAll(/\s+/g, " ").trim();
};

/**
 * Fail closed when a discriminated-union formatter receives an impossible variant.
 *
 * @param value - Exhaustively checked value that should be statically unreachable.
 * @param label - Human-readable formatter label for the thrown diagnostic.
 * @returns Never returns; always throws with the unexpected payload.
 * @throws Error describing the unhandled formatter variant.
 * @example
 * assertNever(unexpected, "report variant")
 * // => throws Error("unhandled report variant: ...")
 */
export const assertNever = (value: never, label: string): never => {
  throw new Error(`unhandled ${label}: ${JSON.stringify(value)}`);
};
