/**
 * @file Reviewed diagnostic architecture fixture lists.
 */

/**
 * Package-entry module specifiers expected from `src/index.ts`.
 */
export const EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS = [
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
  "report.ts",
  "rule-catalogue.ts",
  "rule-id.ts",
  "schema.ts",
  "severity.ts",
  "text.ts",
  "types.ts",
] as const;

/**
 * Representative production source files that must remain parseable.
 */
export const EXPECTED_PARSEABLE_SOURCE_FILES = [
  "src/index.ts",
  "src/diagnostics/report.ts",
  "src/diagnostics/rule-catalogue.ts",
  "src/diagnostics/rule-id.ts",
  "src/diagnostics/schema.ts",
  "src/diagnostics/severity.ts",
  "src/diagnostics/text.ts",
  "src/diagnostics/types.ts",
  "src/static-analysis/source-file.ts",
] as const;
