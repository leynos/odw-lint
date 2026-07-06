/**
 * @file Private package entry for ODW static-analysis helpers.
 *
 * The package is still private, but this entry is the single consumer-facing
 * surface pinned by `package.json`. It re-exports inert diagnostic contracts
 * and static-analysis source helpers only; it does not import or evaluate any
 * ODW runtime code.
 */

export { applyConfiguredRuleSeverities } from "./config/apply-config-severities";
export {
  CONFIGURED_RULE_SEVERITIES,
  type ConfiguredRuleSeverity,
  type ConfigValidationError,
  type ConfigValidationResult,
  type ConfigValidationWarning,
  type LinterConfig,
  validateLinterConfig,
} from "./config/linter-config";
export {
  type ConfigFileReader,
  type ConfigLoadError,
  type ConfigLoadResult,
  type ConfigReadFailureReason,
  DEFAULT_CONFIG_FILENAME,
  type LoadLinterConfigOptions,
  loadLinterConfig,
} from "./config/load-config";
export {
  createMessageTemplate,
  type MessageTemplate,
  type MessageTemplateValues,
  messageMatchesTemplate,
  renderMessageTemplate,
} from "./diagnostics/message-template";
export { countDiagnostics, createDiagnosticReport } from "./diagnostics/report";
export { formatJsonReport } from "./diagnostics/report-json";
export {
  findRuleDefinition,
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
  ruleAllowsMessage,
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
export {
  promoteStrictClaudeSeverity,
  STRICT_CLAUDE_PROMOTION_POLICY,
} from "./diagnostics/strict-claude";
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
  collectWorkflowAstFacts,
  createOriginalSourceFile,
  isIdentifierBound,
  isIndexInInertRegion,
  type LexicalBindingFacts,
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
  scanDeterministicTimeWarnings,
  scanOdwOnlyValidateNotes,
  scanWorkflowEnvelope,
  sliceSourceSpan,
  snippetForSpan,
  spanFromOffsets,
  type UnsupportedWorkflowSyntax,
  type WorkflowAstFacts,
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
  type WorkflowSuppressionMasks,
} from "./static-analysis";
