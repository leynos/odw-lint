/**
 * @file Passive boundary constants and types for the static-analysis pipeline.
 */

/**
 * Stable identifier for the owned production static-analysis boundary.
 */
export const STATIC_ANALYSIS_BOUNDARY = "odw-lint/static-analysis";

/**
 * Original workflow source as read from a file or future standard input.
 */
export interface WorkflowSource {
  /**
   * Repository or invocation path used when reporting source locations.
   */
  readonly filePath: string;

  /**
   * Raw workflow source text before any static-analysis normalization.
   */
  readonly sourceText: string;
}

/**
 * Passive labels for the static-analysis components described by the design.
 */
export const STATIC_ANALYSIS_COMPONENTS = [
  "source-reader",
  "envelope-scanner",
  "static-meta-parser",
  "body-normalizer",
  "swc-parser-adapter",
  "span-mapper",
  "rule-engine",
  "reporter",
] as const;

/**
 * Component label for a static-analysis pipeline responsibility.
 */
export type StaticAnalysisComponent = (typeof STATIC_ANALYSIS_COMPONENTS)[number];

/**
 * Passive labels for the source-to-diagnostic analysis stages.
 */
export const STATIC_ANALYSIS_STAGES = [
  "source",
  "envelope",
  "metadata",
  "body",
  "ast",
  "diagnostic",
] as const;

/**
 * Stage label for a static-analysis pipeline checkpoint.
 */
export type StaticAnalysisStage = (typeof STATIC_ANALYSIS_STAGES)[number];
