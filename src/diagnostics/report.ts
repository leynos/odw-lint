/**
 * @file Diagnostic summary counting and report envelope construction.
 */

import {
  DIAGNOSTIC_SCHEMA_VERSION,
  type Diagnostic,
  type DiagnosticReport,
  type DiagnosticSuggestion,
  type DiagnosticSummary,
  type SourcePosition,
  type SourceSpan,
  TOOL_NAME,
} from "./types";

/** Validates the file count before it is copied into report summaries. */
const validateReportFileCount = (files: number): number => {
  if (Number.isInteger(files) && files >= 0) {
    return files;
  }

  throw new RangeError(`Report file count must be a non-negative integer; received ${files}.`);
};

/**
 * Counts diagnostics by effective severity.
 *
 * @param input Files count and diagnostics to summarize.
 * @returns Summary counts for the supplied diagnostics.
 */
export const countDiagnostics = (input: {
  readonly files: number;
  readonly diagnostics: readonly Diagnostic[];
}): DiagnosticSummary => {
  const files = validateReportFileCount(input.files);
  const counts = {
    error: 0,
    warning: 0,
    info: 0,
    hint: 0,
  } satisfies Record<Diagnostic["severity"], number>;

  for (const diagnostic of input.diagnostics) {
    counts[diagnostic.severity] += 1;
  }

  return {
    files,
    errors: counts.error,
    warnings: counts.warning,
    infos: counts.info,
    hints: counts.hint,
  };
};

/** Clones a source position so reports do not retain caller-owned objects. */
const cloneSourcePosition = (position: SourcePosition): SourcePosition => {
  return { ...position };
};

/** Clones a source span so reports do not retain caller-owned nested objects. */
const cloneSourceSpan = (span: SourceSpan): SourceSpan => {
  return {
    start: cloneSourcePosition(span.start),
    end: cloneSourcePosition(span.end),
  };
};

/** Clones a suggestion so report diagnostics are detached from caller state. */
const cloneSuggestion = (suggestion: DiagnosticSuggestion): DiagnosticSuggestion => {
  return { ...suggestion };
};

/** Clones a diagnostic payload before report summary and envelope creation. */
const cloneDiagnostic = (diagnostic: Diagnostic): Diagnostic => {
  const clone = {
    ...diagnostic,
    span: cloneSourceSpan(diagnostic.span),
  };

  if (diagnostic.suggestions === undefined) {
    return clone;
  }

  return {
    ...clone,
    suggestions: diagnostic.suggestions.map(cloneSuggestion),
  };
};

/**
 * Creates a versioned diagnostic report envelope.
 *
 * @param input Tool version, files count, and diagnostics to report.
 * @returns Diagnostic report envelope.
 */
export const createDiagnosticReport = (input: {
  readonly version: string;
  readonly files: number;
  readonly diagnostics: readonly Diagnostic[];
}): DiagnosticReport => {
  const diagnostics = input.diagnostics.map(cloneDiagnostic);

  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    tool: {
      name: TOOL_NAME,
      version: input.version,
    },
    summary: countDiagnostics({ files: input.files, diagnostics }),
    diagnostics,
  };
};
