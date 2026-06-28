/**
 * @file Shared diagnostic severity model.
 *
 * The tuple is the source of truth for runtime mirrors and the exported type.
 */

/**
 * Supported diagnostic severity values after caller-applied overrides.
 */
export const DIAGNOSTIC_SEVERITIES = ["error", "warning", "info", "hint"] as const;

/**
 * Supported diagnostic severity values after caller-applied overrides.
 */
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];
