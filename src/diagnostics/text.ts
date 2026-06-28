/**
 * @file Human-readable diagnostic text formatting.
 */

import type { Diagnostic } from "./types";

/** Checks for control whitespace that can break one-line text diagnostics. */
const isControlWhitespace = (character: string): boolean => {
  const codePoint = character.codePointAt(0);

  if (codePoint === undefined) {
    return false;
  }

  if (codePoint >= 9 && codePoint <= 13) {
    return true;
  }

  return codePoint === 0x85 || codePoint === 0x2028 || codePoint === 0x2029;
};

/** Normalizes text-only control whitespace so diagnostics remain line-oriented. */
const normalizeTextField = (value: string): string => {
  let output = "";
  let previousWasControlWhitespace = false;

  for (const character of value) {
    const shouldReplace = isControlWhitespace(character);

    if (!shouldReplace) {
      output += character;
      previousWasControlWhitespace = false;
      continue;
    }

    if (!previousWasControlWhitespace) {
      output += " ";
    }
    previousWasControlWhitespace = true;
  }

  return output;
};

/**
 * Formats diagnostics as stable one-line text output.
 *
 * @param diagnostics Diagnostics to format.
 * @returns Text output with one line per diagnostic.
 */
export const formatTextDiagnostics = (diagnostics: readonly Diagnostic[]): string => {
  const lines = diagnostics.map((diagnostic) => {
    return `${normalizeTextField(diagnostic.file)}:${diagnostic.span.start.line}:${diagnostic.span.start.column} ${diagnostic.severity} ${diagnostic.rule} ${normalizeTextField(diagnostic.message)}`;
  });

  return lines.join("\n");
};
