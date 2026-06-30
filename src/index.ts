/**
 * @file Private package entry for ODW static-analysis helpers.
 *
 * The package is still private, but this entry is the single consumer-facing
 * surface pinned by `package.json`. It re-exports inert diagnostic contracts
 * and static-analysis source helpers only; it does not import or evaluate any
 * ODW runtime code.
 */

export { countDiagnostics, createDiagnosticReport } from "./diagnostics/report";
export {
  PLANNED_RULE_IDS,
  RELEASED_RULE_IDS,
  RULE_CATALOGUE,
  RULE_CATEGORIES,
  RULE_IDS,
  RULE_RELEASE_STATUSES,
  type RuleCategory,
  type RuleDefinition,
  type RuleReleaseStatus,
  ruleDocsPath,
} from "./diagnostics/rule-catalogue";
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
  type MaskedSource,
  maskNonCodeSource,
  type OriginalSourceFile,
  positionAtOffset,
  type SourceLine,
  type SourceMaskKind,
  type SourceMaskRange,
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
