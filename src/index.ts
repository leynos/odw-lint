/**
 * @file Private package entry for ODW static-analysis helpers.
 *
 * The package is still private, but this entry is the single consumer-facing
 * surface pinned by `package.json`. It re-exports inert diagnostic contracts
 * and static-analysis source helpers only; it does not import or evaluate any
 * ODW runtime code.
 */

export {
  createMessageTemplate,
  type MessageTemplate,
  type MessageTemplateValues,
  messageMatchesTemplate,
  renderMessageTemplate,
} from "./diagnostics/message-template";
export { countDiagnostics, createDiagnosticReport } from "./diagnostics/report";
export {
  firstReviewedRuleMessage,
  PLANNED_RULE_IDS,
  RELEASED_RULE_IDS,
  RULE_CATALOGUE,
  RULE_CATEGORIES,
  RULE_IDS,
  RULE_RELEASE_STATUSES,
  type RuleCategory,
  type RuleDefinition,
  type RuleDocumentationPath,
  type RuleReleaseStatus,
  reviewedRuleMessage,
  ruleDefinitionFor,
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
  classifyWorkflowMetadata,
  createOriginalSourceFile,
  lintWorkflowSource,
  type MaskedSource,
  maskNonCodeSource,
  type NormalizedWorkflowBody,
  normalizeWorkflowBody,
  type OriginalSourceFile,
  originalSpanFromNormalizedOffsets,
  type ParsedMetadataPrimitive,
  type ParsedMetadataProperty,
  type ParsedMetadataValue,
  parseWorkflowBody,
  parseWorkflowMetadataLiteral,
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
  scanWorkflowEnvelope,
  sliceSourceSpan,
  snippetForSpan,
  spanFromOffsets,
  type UnsupportedWorkflowSyntax,
  type WorkflowBodyParseResult,
  type WorkflowEnvelope,
  type WorkflowEnvelopeScanResult,
  type WorkflowLintResult,
  type WorkflowMetadataClassification,
  type WorkflowMetadataFacts,
  type WorkflowMetadataParseResult,
  type WorkflowMetadataPortability,
  type WorkflowMetaValue,
  type WorkflowSource,
} from "./static-analysis";
