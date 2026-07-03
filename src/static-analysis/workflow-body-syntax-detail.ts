/**
 * @file Parser error detail extraction for workflow-body syntax diagnostics.
 *
 * This module turns a thrown parser value into a bounded, single-line detail
 * string. It is intentionally import-safe and depends only on JavaScript
 * primitives, so loading it cannot execute workflow source or parser code.
 */

export const BODY_SYNTAX_DETAIL_MAX_LENGTH = 200;

const LINE_TERMINATOR_PATTERN = /\r\n|[\n\r\u2028\u2029]/u;
const WHITESPACE_RUN_PATTERN = /\s+/gu;
const MARKER_PREFIX_PATTERN = /^(?:[×x]\s*|Syntax Error:?\s*)/iu;
const LEADING_PUNCTUATION_PATTERN = /^[\s:;,.!-]+/u;

/**
 * Extracts a reviewed diagnostic detail from a thrown parser error.
 *
 * @param error - Value thrown by the parser boundary.
 * @returns A bounded single-line detail, or `""` when no usable text exists.
 */
export const bodySyntaxDetail = (error: unknown): string => {
  const text = textFromThrownValue(error);

  if (text.length === 0) {
    return "";
  }

  const line = firstNonEmptyLine(text);

  if (line.length === 0) {
    return "";
  }

  const detail = line
    .replace(MARKER_PREFIX_PATTERN, "")
    .replace(LEADING_PUNCTUATION_PATTERN, "")
    .replace(WHITESPACE_RUN_PATTERN, " ")
    .trim();

  return detail.slice(0, BODY_SYNTAX_DETAIL_MAX_LENGTH);
};

/** Reduces parser-boundary throws to owned text only. */
const textFromThrownValue = (error: unknown): string => {
  if (error === null || error === undefined) {
    return "";
  }

  if (typeof error === "object") {
    if (Object.hasOwn(error, "message")) {
      const message = (error as { readonly message?: unknown }).message;
      return typeof message === "string" ? message : "";
    }

    return "";
  }

  try {
    return String(error);
  } catch {
    return "";
  }
};

/** Selects the first summary-like line before source excerpts. */
const firstNonEmptyLine = (text: string): string => {
  for (const line of text.split(LINE_TERMINATOR_PATTERN)) {
    const trimmedLine = line.trim();

    if (trimmedLine.length > 0) {
      return trimmedLine;
    }
  }

  return "";
};
