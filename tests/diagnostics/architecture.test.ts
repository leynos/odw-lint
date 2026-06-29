/**
 * @file Diagnostic module architecture tests.
 *
 * These tests inspect source shape so diagnostic and static-analysis
 * responsibilities stay behind focused internal modules while consumers keep
 * using the package entry point.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
import type { SourceFile } from "typescript";
import {
  EXPECTED_DIAGNOSTIC_MODULE_FILES,
  EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS,
  EXPECTED_PARSEABLE_SOURCE_FILES,
} from "./architecture-fixtures";
import {
  exportDeclarationFacts,
  exportedModuleSpecifiers,
  importArchitectureFactsFromSource,
  isForbiddenOdwImport,
  parseSource,
  topLevelDeclarationNames,
} from "./import-architecture";

type PackageJson = {
  readonly exports: {
    readonly ".": Record<string, string>;
    readonly "./package.json": string;
  };
};

type SourceText = { readonly filePath: string; readonly sourceText: string };

type ImportViolation = Record<string, string>;

/** Lists current internal diagnostic source modules. */
const diagnosticModuleFiles = (): readonly string[] => {
  const diagnosticsPath = "src/diagnostics";

  if (!existsSync(diagnosticsPath)) {
    return [];
  }

  return readdirSync(diagnosticsPath)
    .filter((fileName) => fileName.endsWith(".ts"))
    .sort();
};

/** Lists sorted production TypeScript source paths. */
const productionTypeScriptFiles = (directory: string): readonly string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        return productionTypeScriptFiles(filePath);
      }
      if (!entry.isFile()) {
        return [];
      }
      return filePath.endsWith(".ts") ? [filePath] : [];
    })
    .sort();
};

/** Builds sorted production import architecture violations. */
const importViolationsForSources = (sources: readonly SourceText[]): readonly ImportViolation[] => {
  return sources
    .flatMap(({ filePath, sourceText }) => {
      const facts = importArchitectureFactsFromSource(filePath, sourceText);
      return [
        ...facts.importLikeEdges
          .filter((edge) => isForbiddenOdwImport(edge.moduleSpecifier))
          .map((edge) => ({ kind: "forbidden-import" as const, ...edge })),
        ...facts.computedDynamicImports.map((edge) => ({
          kind: "computed-dynamic-import" as const,
          ...edge,
        })),
        ...facts.computedCommonJsRequires.map((edge) => ({
          kind: "computed-commonjs-require" as const,
          ...edge,
        })),
      ];
    })
    .sort(
      (left, right) =>
        left.filePath.localeCompare(right.filePath) || left.kind.localeCompare(right.kind),
    );
};

/** Reads the package manifest with the export shape used by this test. */
const packageJson = (): PackageJson => {
  return JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
};

/** Asserts that package-entry re-exports stay explicit and named. */
const expectNamedModuleExports = (sourceFile: SourceFile): void => {
  for (const exportDeclaration of exportDeclarationFacts(sourceFile)) {
    expect(exportDeclaration.hasExportClause).toBeTrue();
    expect(exportDeclaration.hasModuleSpecifier).toBeTrue();
    expect(exportDeclaration.hasNamedExports).toBeTrue();
    expect(exportDeclaration.moduleSpecifier).toBeDefined();
  }
};

/** Asserts that the public package entry exposes only expected internals. */
const expectPackageEntryShape = (expectedModuleSpecifiers: readonly string[]): void => {
  const packageExports = packageJson().exports;
  const packageEntrySource = parseSource("src/index.ts");

  expect(Object.keys(packageExports).sort()).toEqual([".", "./package.json"]);
  expect(packageExports["."]).toEqual({
    types: "./src/index.ts",
    bun: "./src/index.ts",
    import: "./src/index.ts",
    default: "./src/index.ts",
  });

  expectNamedModuleExports(packageEntrySource);
  expect([...exportedModuleSpecifiers(packageEntrySource)].sort()).toEqual(
    [...expectedModuleSpecifiers].sort(),
  );
};

describe("diagnostic architecture", () => {
  it("keeps public diagnostic values importable from the package entry", () => {
    const ruleId = makeRuleId("odw/meta-required");
    const diagnostic: Diagnostic = {
      file: "workflow.js",
      rule: ruleId,
      severity: "error",
      message: "workflow must export const meta",
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
    };

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
    expect(formatTextDiagnostics([diagnostic])).toContain("odw/meta-required");
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
    expectTypeOf<InvalidRuleIdReason>().toMatchTypeOf<string>();
    expectTypeOf<InvalidRuleId>().toMatchTypeOf<{ readonly kind: "invalid-rule-id" }>();
    expectTypeOf<RuleId>().toMatchTypeOf<string>();
    expectTypeOf<RuleIdParseResult>().toMatchTypeOf<
      | { readonly ok: true; readonly value: RuleId }
      | { readonly ok: false; readonly error: InvalidRuleId }
    >();
    expectTypeOf<SourcePosition>().toMatchTypeOf<{
      readonly offset: number;
      readonly line: number;
      readonly column: number;
    }>();
    expectTypeOf<SourceSpan>().toMatchTypeOf<{
      readonly start: SourcePosition;
      readonly end: SourcePosition;
    }>();
    expectTypeOf<DiagnosticSummary>().toMatchTypeOf<{ readonly files: number }>();
    expectTypeOf<ToolInfo>().toMatchTypeOf<{ readonly name: typeof TOOL_NAME }>();
    expectTypeOf<DiagnosticReport>().toMatchTypeOf<{
      readonly diagnostics: readonly Diagnostic[];
    }>();
  });

  it("keeps public static-analysis types importable from the package entry", () => {
    expectTypeOf<WorkflowSource>().toMatchTypeOf<{
      readonly filePath: string;
      readonly sourceText: string;
    }>();
    expectTypeOf<OriginalSourceFile>().toMatchTypeOf<{
      readonly filePath: string;
      readonly sourceText: string;
      readonly byteLength: number;
      readonly lines: readonly SourceLine[];
    }>();
    expectTypeOf<SourceLine>().toMatchTypeOf<{
      readonly line: number;
      readonly startOffset: number;
      readonly contentEndOffset: number;
      readonly terminatorEndOffset: number;
      readonly text: string;
    }>();
    expectTypeOf<SourceSnippet>().toMatchTypeOf<{
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

  it("extracts string import-like edges from TypeScript syntax", () => {
    const facts = importArchitectureFactsFromSource(
      "virtual.ts",
      `
        import value from "static-import";
        import type { TypeOnly } from "type-import";
        export { value } from "re-export";
        export type { TypeOnly } from "type-export";
        import alias = require("import-equals");
        type Loader = import("odw/src/loader").WorkflowMeta;
        type Entry = typeof import("odw/src/index");
        await import("dynamic-import");
        require("commonjs-require");
      `,
    );

    expect(facts.importLikeEdges.map((edge) => edge.moduleSpecifier)).toEqual([
      "commonjs-require",
      "dynamic-import",
      "import-equals",
      "odw/src/index",
      "odw/src/loader",
      "re-export",
      "static-import",
      "type-export",
      "type-import",
    ]);
  });

  it("ignores non-import type nodes when extracting import-like edges", () => {
    const facts = importArchitectureFactsFromSource(
      "virtual.ts",
      `
        type Local = Readonly<string>;
        type Literal = "odw/src/loader";
        interface WorkflowMeta { readonly name: string; }
      `,
    );

    expect(facts.importLikeEdges).toEqual([]);
  });

  it("reports computed dynamic imports and CommonJS requires without string edges", () => {
    const facts = importArchitectureFactsFromSource(
      "virtual.ts",
      `
        const specifier = "odw/src/runtime/worker";
        await import(specifier);
        await import(foo());
        await import();
        require(specifier);
        require(foo());
        require();
      `,
    );

    expect(facts.importLikeEdges).toEqual([]);
    expect(facts.computedDynamicImports.map((edge) => edge.expressionText)).toEqual([
      "<missing>",
      "foo()",
      "specifier",
    ]);
    expect(facts.computedCommonJsRequires.map((edge) => edge.expressionText)).toEqual([
      "<missing>",
      "foo()",
      "specifier",
    ]);
  });

  it("classifies forbidden ODW imports without blocking lookalikes", () => {
    const cases = [
      ..."odw odw/src/index odw/dist/index.js odw/src/loader.ts odw/dist/loader odw/src/primitives odw/dist/primitives.js odw/src/runtime odw/dist/runtime odw/src/runtime/launcher.ts odw/dist/runtime/launcher.js odw/src/runtime/worker odw/dist/runtime/worker.js ../open-dynamic-workflows/src/index ../open-dynamic-workflows/dist/index.js C:\\work\\open-dynamic-workflows\\src\\runtime\\worker.ts"
        .split(" ")
        .map((moduleSpecifier) => [moduleSpecifier, true] as const),
      ..."odw-lint @scope/odw @scope/odw-tools ./odw-local ../open-dynamic-workflows-not/src/loader ../open-dynamic-workflows/docs/runtime"
        .split(" ")
        .map((moduleSpecifier) => [moduleSpecifier, false] as const),
    ];

    for (const [moduleSpecifier, expected] of cases) {
      expect(isForbiddenOdwImport(moduleSpecifier), moduleSpecifier).toBe(expected);
    }
  });

  it("reports production import architecture violations from source facts", () => {
    expect(
      importViolationsForSources([
        { filePath: "src/a.ts", sourceText: 'import "odw/src/runtime/worker";' },
        { filePath: "src/b.ts", sourceText: 'type T = import("odw/src/loader").WorkflowMeta;' },
        { filePath: "src/c.ts", sourceText: 'const specifier = "odw"; await import(specifier);' },
        { filePath: "src/d.ts", sourceText: 'const specifier = "odw"; require(specifier);' },
      ]),
    ).toEqual([
      { kind: "forbidden-import", filePath: "src/a.ts", moduleSpecifier: "odw/src/runtime/worker" },
      { kind: "forbidden-import", filePath: "src/b.ts", moduleSpecifier: "odw/src/loader" },
      { kind: "computed-dynamic-import", filePath: "src/c.ts", expressionText: "specifier" },
      { kind: "computed-commonjs-require", filePath: "src/d.ts", expressionText: "specifier" },
    ]);
  });

  it("keeps production code free of executable ODW imports", () => {
    const sources = productionTypeScriptFiles("src").map((filePath) => ({
      filePath,
      sourceText: readFileSync(filePath, "utf8"),
    }));

    expect(importViolationsForSources(sources)).toEqual([]);
  });

  it("pins the final package entry and parseable diagnostic sources", () => {
    expectPackageEntryShape(EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS);
    expect(diagnosticModuleFiles()).toEqual(EXPECTED_DIAGNOSTIC_MODULE_FILES);

    for (const sourcePath of EXPECTED_PARSEABLE_SOURCE_FILES) {
      expect(parseSource(sourcePath).fileName).toBe(sourcePath);
    }
    expect(topLevelDeclarationNames(parseSource("src/index.ts"))).toEqual([]);
  });
});
