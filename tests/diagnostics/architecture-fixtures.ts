/**
 * @file Reviewed diagnostic architecture fixture lists.
 */

/**
 * Package-entry module specifiers expected from `src/index.ts`.
 */
export const EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS = [
  "./diagnostics/message-template",
  "./diagnostics/report",
  "./diagnostics/rule-catalogue",
  "./diagnostics/rule-id",
  "./diagnostics/schema",
  "./diagnostics/severity",
  "./diagnostics/text",
  "./diagnostics/types",
  "./static-analysis",
] as const;

/**
 * Source files expected under `src/diagnostics/`.
 */
export const EXPECTED_DIAGNOSTIC_MODULE_FILES = [
  "message-template.ts",
  "report.ts",
  "rule-catalogue.ts",
  "rule-diagnostic.ts",
  "rule-id.ts",
  "schema.ts",
  "severity.ts",
  "text.ts",
  "types.ts",
] as const;

/**
 * Source files expected under `src/static-analysis/`.
 */
export const EXPECTED_STATIC_ANALYSIS_MODULE_FILES = [
  "index.ts",
  "javascript-identifiers.ts",
  "source-file.ts",
  "source-indexes.ts",
  "source-mask-comments.ts",
  "source-mask-delimiters.ts",
  "source-mask-regex.ts",
  "source-mask-strings.ts",
  "source-mask-templates.ts",
  "source-mask-types.ts",
  "source-mask.ts",
  "source-position.ts",
  "source-scan.ts",
  "source-snippet.ts",
  "types.ts",
  "value-guards.ts",
  "workflow-ast-bindings.ts",
  "workflow-ast-facts.ts",
  "workflow-body-normalizer.ts",
  "workflow-body-parse.ts",
  "workflow-body-parser.ts",
  "workflow-body-syntax-detail.ts",
  "workflow-deterministic-time.ts",
  "workflow-envelope-meta-value.ts",
  "workflow-envelope-statement.ts",
  "workflow-envelope-unsupported.ts",
  "workflow-envelope.ts",
  "workflow-lint.ts",
  "workflow-metadata-comment-scan.ts",
  "workflow-metadata-parser-scan.ts",
  "workflow-metadata-parser.ts",
  "workflow-metadata-string-scan.ts",
  "workflow-metadata.ts",
  "workflow-suppression-mask.ts",
] as const;

/**
 * Representative production source files that must remain parseable.
 */
export const EXPECTED_PARSEABLE_SOURCE_FILES = [
  "src/index.ts",
  "src/diagnostics/message-template.ts",
  "src/diagnostics/report.ts",
  "src/diagnostics/rule-catalogue.ts",
  "src/diagnostics/rule-diagnostic.ts",
  "src/diagnostics/rule-id.ts",
  "src/diagnostics/schema.ts",
  "src/diagnostics/severity.ts",
  "src/diagnostics/text.ts",
  "src/diagnostics/types.ts",
  "src/static-analysis/source-file.ts",
] as const;
