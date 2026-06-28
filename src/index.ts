/**
 * @file Public diagnostic contract for ODW static-analysis results.
 *
 * The module contains inert data shapes and pure constructors only. It does not
 * import or evaluate any ODW runtime code.
 */

export { countDiagnostics, createDiagnosticReport } from "./diagnostics/report";
export {
  type InvalidRuleId,
  InvalidRuleIdError,
  type InvalidRuleIdReason,
  isRuleId,
  makeRuleId,
  parseRuleId,
  type RuleId,
  type RuleIdParseResult,
} from "./diagnostics/rule-id";
export { DIAGNOSTIC_REPORT_SCHEMA } from "./diagnostics/schema";
export { DIAGNOSTIC_SEVERITIES, type DiagnosticSeverity } from "./diagnostics/severity";
export { formatTextDiagnostics } from "./diagnostics/text";
export {
  DIAGNOSTIC_SCHEMA_VERSION,
  type Diagnostic,
  type DiagnosticReport,
  type DiagnosticSuggestion,
  type DiagnosticSummary,
  type SourcePosition,
  type SourceSpan,
  TOOL_NAME,
  type ToolInfo,
} from "./diagnostics/types";
export {
  createOriginalSourceFile,
  type OriginalSourceFile,
  positionAtOffset,
  type SourceLine,
  SourceOffsetError,
  type SourceSnippet,
  STATIC_ANALYSIS_BOUNDARY,
  STATIC_ANALYSIS_COMPONENTS,
  STATIC_ANALYSIS_STAGES,
  type StaticAnalysisComponent,
  type StaticAnalysisStage,
  sliceSourceSpan,
  snippetForSpan,
  spanFromOffsets,
  type WorkflowSource,
} from "./static-analysis";
