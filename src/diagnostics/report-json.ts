/**
 * @file Canonical JSON serialization for diagnostic report envelopes.
 */

import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSuggestion,
  SourcePosition,
  SourceSpan,
} from "./types";

/** Projects a source position into the public JSON field order. */
const projectPosition = (position: SourcePosition): SourcePosition => {
  return {
    offset: position.offset,
    line: position.line,
    column: position.column,
  };
};

/** Projects a source span into the public JSON field order. */
const projectSpan = (span: SourceSpan): SourceSpan => {
  return {
    start: projectPosition(span.start),
    end: projectPosition(span.end),
  };
};

/** Projects a suggestion into the public JSON field order. */
const projectSuggestion = (suggestion: DiagnosticSuggestion): DiagnosticSuggestion => {
  return {
    message: suggestion.message,
  };
};

/** Projects a diagnostic into the documented JSON contract shape. */
const projectDiagnostic = (diagnostic: Diagnostic): Diagnostic => {
  const projectedDiagnostic = {
    file: diagnostic.file,
    rule: diagnostic.rule,
    severity: diagnostic.severity,
    message: diagnostic.message,
    span: projectSpan(diagnostic.span),
    ...(diagnostic.docs === undefined ? {} : { docs: diagnostic.docs }),
    suggestions: (diagnostic.suggestions ?? []).map(projectSuggestion),
  };

  return projectedDiagnostic;
};

/**
 * Formats a diagnostic report as the versioned canonical JSON envelope.
 *
 * @param report Diagnostic report envelope to serialize.
 * @returns Pretty-printed JSON without a trailing newline.
 */
export const formatJsonReport = (report: DiagnosticReport): string => {
  const projection = {
    schemaVersion: report.schemaVersion,
    tool: {
      name: report.tool.name,
      version: report.tool.version,
    },
    summary: {
      files: report.summary.files,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
      infos: report.summary.infos,
      hints: report.summary.hints,
    },
    diagnostics: report.diagnostics.map(projectDiagnostic),
  };

  return JSON.stringify(projection, null, 2);
};
