/**
 * @file Public diagnostic consumer fixture.
 *
 * This suite keeps a package-entry-only consumer compiling against the
 * diagnostic fields that downstream callers rely on.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  DiagnosticSummary,
  InvalidRuleId,
  InvalidRuleIdReason,
  OriginalSourceFile,
  RuleId,
  RuleIdParseResult,
  SourceLine,
  SourcePosition,
  SourceSnippet,
  SourceSpan,
  StaticAnalysisComponent,
  StaticAnalysisStage,
  ToolInfo,
  WorkflowSource,
} from "odw-lint";
import {
  countDiagnostics,
  createDiagnosticReport,
  createOriginalSourceFile,
  DIAGNOSTIC_REPORT_SCHEMA,
  DIAGNOSTIC_SCHEMA_VERSION,
  DIAGNOSTIC_SEVERITIES,
  formatTextDiagnostics,
  InvalidRuleIdError,
  isRuleId,
  makeRuleId,
  parseRuleId,
  positionAtOffset,
  SourceOffsetError,
  STATIC_ANALYSIS_BOUNDARY,
  STATIC_ANALYSIS_COMPONENTS,
  STATIC_ANALYSIS_STAGES,
  sliceSourceSpan,
  snippetForSpan,
  spanFromOffsets,
  TOOL_NAME,
} from "odw-lint";

describe("public diagnostic consumer", () => {
  it("can construct and read required diagnostic report fields", () => {
    const diagnostic = {
      file: "workflows/example.js",
      rule: makeRuleId("odw/meta-required"),
      severity: "error",
      message: "Workflow source must export literal metadata.",
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
    } satisfies Diagnostic;

    const summary = {
      files: 1,
      errors: 1,
      warnings: 0,
      infos: 0,
      hints: 0,
    } satisfies DiagnosticSummary;

    const report = createDiagnosticReport({
      version: "0.1.0",
      files: summary.files,
      diagnostics: [diagnostic],
    }) satisfies DiagnosticReport;

    expect(report.schemaVersion).toBe(DIAGNOSTIC_SCHEMA_VERSION);
    expect(report.tool).toEqual({ name: TOOL_NAME, version: "0.1.0" });
    expect(report.summary).toEqual(summary);
    expect(report.diagnostics[0]?.span.start.line).toBe(1);
  });

  it("keeps public diagnostic values importable from the package entry", () => {
    const ruleId = makeRuleId("odw/meta-required");
    const diagnostic: Diagnostic = {
      file: "workflow.js",
      rule: ruleId,
      severity: "error",
      message: "Workflow source must export literal metadata.",
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
    };
    const renderedText = formatTextDiagnostics([diagnostic]);

    expect(DIAGNOSTIC_REPORT_SCHEMA.type).toBe("object");
    expect(DIAGNOSTIC_SCHEMA_VERSION).toBe(1);
    expect(DIAGNOSTIC_SEVERITIES).toEqual(["error", "warning", "info", "hint"]);
    expect(TOOL_NAME).toBe("odw-lint");
    expect(parseRuleId(String(ruleId))).toEqual({ ok: true, value: ruleId });
    expect(isRuleId(String(ruleId))).toBeTrue();
    expect(InvalidRuleIdError).toBeFunction();
    expect(countDiagnostics({ files: 1, diagnostics: [diagnostic] }).errors).toBe(1);
    expect(
      createDiagnosticReport({ version: "0.1.0", files: 1, diagnostics: [diagnostic] })
        .diagnostics[0]?.rule,
    ).toBe(ruleId);
    expect(diagnostic.file).toBe("workflow.js");
    expect(diagnostic.rule).toBe(ruleId);
    expect(diagnostic.severity).toBe("error");
    expect(renderedText).toMatchSnapshot();
  });

  it("keeps public static-analysis helpers importable from the package entry", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflow.js",
      sourceText: "meta\nbody",
    });
    const bodySpan = spanFromOffsets(sourceFile, 5, 9);

    expect(STATIC_ANALYSIS_BOUNDARY).toBe("odw-lint/static-analysis");
    expect(STATIC_ANALYSIS_COMPONENTS).toContain("source-reader");
    expect(STATIC_ANALYSIS_STAGES).toContain("diagnostic");
    expect(SourceOffsetError).toBeFunction();
    expect(positionAtOffset(sourceFile, 5)).toEqual({ offset: 5, line: 2, column: 1 });
    expect(sliceSourceSpan(sourceFile, bodySpan)).toBe("body");
    expect(snippetForSpan(sourceFile, bodySpan)).toEqual({
      text: "body",
      start: { offset: 5, line: 2, column: 1 },
      end: { offset: 9, line: 2, column: 5 },
      lineText: "body",
    });
  });

  it("keeps public diagnostic types importable from the package entry", () => {
    expectTypeOf<DiagnosticSeverity>().toEqualTypeOf<(typeof DIAGNOSTIC_SEVERITIES)[number]>();
    expectTypeOf<InvalidRuleIdReason>().toEqualTypeOf<
      "empty" | "missing-namespace" | "wrong-namespace" | "invalid-name"
    >();
    expectTypeOf<InvalidRuleId>().toEqualTypeOf<{
      readonly kind: "invalid-rule-id";
      readonly reason: InvalidRuleIdReason;
      readonly value: string;
      readonly message: string;
    }>();
    expectTypeOf<RuleId>().not.toEqualTypeOf<string>();
    expectTypeOf<RuleId>().toMatchTypeOf<string>();
    expectTypeOf<RuleIdParseResult>().toEqualTypeOf<
      | { readonly ok: true; readonly value: RuleId }
      | { readonly ok: false; readonly error: InvalidRuleId }
    >();
    expectTypeOf<SourcePosition>().toEqualTypeOf<{
      readonly offset: number;
      readonly line: number;
      readonly column: number;
    }>();
    expectTypeOf<SourceSpan>().toEqualTypeOf<{
      readonly start: SourcePosition;
      readonly end: SourcePosition;
    }>();
    expectTypeOf<Diagnostic>().toEqualTypeOf<{
      readonly file: string;
      readonly rule: RuleId;
      readonly severity: DiagnosticSeverity;
      readonly message: string;
      readonly span: SourceSpan;
      readonly docs?: string;
      readonly suggestions?: readonly { readonly message: string }[];
    }>();
    expectTypeOf<DiagnosticSummary>().toEqualTypeOf<{
      readonly files: number;
      readonly errors: number;
      readonly warnings: number;
      readonly infos: number;
      readonly hints: number;
    }>();
    expectTypeOf<ToolInfo>().toEqualTypeOf<{
      readonly name: typeof TOOL_NAME;
      readonly version: string;
    }>();
    expectTypeOf<DiagnosticReport>().toEqualTypeOf<{
      readonly schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
      readonly tool: ToolInfo;
      readonly summary: DiagnosticSummary;
      readonly diagnostics: readonly Diagnostic[];
    }>();
  });

  it("keeps public static-analysis types importable from the package entry", () => {
    expectTypeOf<WorkflowSource>().toEqualTypeOf<{
      readonly filePath: string;
      readonly sourceText: string;
    }>();
    expectTypeOf<
      Pick<OriginalSourceFile, "filePath" | "sourceText" | "byteLength" | "lines">
    >().toEqualTypeOf<{
      readonly filePath: string;
      readonly sourceText: string;
      readonly byteLength: number;
      readonly lines: readonly SourceLine[];
    }>();
    expectTypeOf<SourceLine>().toEqualTypeOf<{
      readonly line: number;
      readonly startOffset: number;
      readonly contentEndOffset: number;
      readonly terminatorEndOffset: number;
      readonly text: string;
    }>();
    expectTypeOf<SourceSnippet>().toEqualTypeOf<{
      readonly text: string;
      readonly start: SourcePosition;
      readonly end: SourcePosition;
      readonly lineText: string;
    }>();
    expectTypeOf<StaticAnalysisComponent>().toEqualTypeOf<
      (typeof STATIC_ANALYSIS_COMPONENTS)[number]
    >();
    expectTypeOf<StaticAnalysisStage>().toEqualTypeOf<(typeof STATIC_ANALYSIS_STAGES)[number]>();
  });
});
