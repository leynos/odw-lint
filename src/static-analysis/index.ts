/**
 * @file Entry point for `odw-lint`'s owned static-analysis implementation.
 */

export {
  createOriginalSourceFile,
  positionAtOffset,
  sliceSourceSpan,
  snippetForSpan,
  spanFromOffsets,
} from "./source-file";
export type {
  OriginalSourceFile,
  SourceLine,
  SourceSnippet,
  StaticAnalysisComponent,
  StaticAnalysisStage,
  WorkflowSource,
} from "./types";
export {
  SourceOffsetError,
  STATIC_ANALYSIS_BOUNDARY,
  STATIC_ANALYSIS_COMPONENTS,
  STATIC_ANALYSIS_STAGES,
} from "./types";
