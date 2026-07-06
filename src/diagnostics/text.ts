/**
 * @file Human-readable diagnostic text formatting.
 */

import type { Diagnostic, DiagnosticReport, DiagnosticSummary } from "./types";

type SummaryPart = {
  readonly count: number;
  readonly singular: string;
  readonly plural: string;
};

const SUMMARY_PARTS = [
  { countKey: "errors", singular: "error", plural: "errors" },
  { countKey: "warnings", singular: "warning", plural: "warnings" },
  { countKey: "infos", singular: "info", plural: "infos" },
  { countKey: "hints", singular: "hint", plural: "hints" },
] as const satisfies readonly {
  readonly countKey: keyof Pick<DiagnosticSummary, "errors" | "warnings" | "infos" | "hints">;
  readonly singular: string;
  readonly plural: string;
}[];

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

/** Selects non-zero summary counts in the reviewed output order. */
const summaryPartsFor = (summary: DiagnosticSummary): readonly SummaryPart[] => {
  return SUMMARY_PARTS.flatMap((part) => {
    const count = summary[part.countKey];

    if (count === 0) {
      return [];
    }

    return [{ count, singular: part.singular, plural: part.plural }];
  });
};

/** Formats one count with its singular or plural severity label. */
const formatSummaryPart = (part: SummaryPart): string => {
  return `${part.count} ${part.count === 1 ? part.singular : part.plural}`;
};

/** Formats report summary counts as the human-readable footer. */
const formatDiagnosticSummary = (summary: DiagnosticSummary): string => {
  const parts = summaryPartsFor(summary).map(formatSummaryPart);

  return `Found ${parts.join(", ")}.`;
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

/**
 * Formats a diagnostic report as the default human-readable text report.
 *
 * @param report Diagnostic report to format.
 * @returns Text output with diagnostic lines and a severity summary footer.
 */
export const formatTextReport = (report: DiagnosticReport): string => {
  if (report.diagnostics.length === 0) {
    return "";
  }

  return `${formatTextDiagnostics(report.diagnostics)}\n\n${formatDiagnosticSummary(report.summary)}`;
};
