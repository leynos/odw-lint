/**
 * @file Diagnostic module architecture tests.
 *
 * These tests inspect source shape so diagnostic responsibilities stay behind
 * focused internal modules while consumers keep using the package entry point.
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
  RuleId,
  RuleIdParseResult,
  SourcePosition,
  SourceSpan,
  ToolInfo,
} from "odw-lint";
import {
  countDiagnostics,
  createDiagnosticReport,
  DIAGNOSTIC_REPORT_SCHEMA,
  DIAGNOSTIC_SCHEMA_VERSION,
  DIAGNOSTIC_SEVERITIES,
  formatTextDiagnostics,
  InvalidRuleIdError,
  isRuleId,
  makeRuleId,
  parseRuleId,
  TOOL_NAME,
} from "odw-lint";
import ts from "typescript";

type PackageJson = {
  readonly exports: {
    readonly ".": Record<string, string>;
    readonly "./package.json": string;
  };
};

type ExportDeclarationFact = {
  readonly hasExportClause: boolean;
  readonly hasModuleSpecifier: boolean;
  readonly hasNamedExports: boolean;
  readonly moduleSpecifier: string | undefined;
};

/** Parses a repository-relative TypeScript file. */
const parseSource = (relativePath: string): ts.SourceFile => {
  const source = readFileSync(relativePath, "utf8");

  return ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
};

/** Extracts an identifier name from declaration nodes that have one. */
const namedDeclarationName = (declaration: ts.Declaration): string | undefined => {
  if (!("name" in declaration)) {
    return undefined;
  }

  const name = (declaration as { readonly name?: ts.Node }).name;

  if (name === undefined) {
    return undefined;
  }

  if (!ts.isIdentifier(name)) {
    return undefined;
  }

  return name.text;
};

/** Checks whether a top-level AST node owns one declaration name. */
const isNamedTopLevelDeclaration = (
  node: ts.Node,
): node is
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration => {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node)
  );
};

/** Extracts the module specifier text from string-literal export targets. */
const moduleSpecifierText = (moduleSpecifier: ts.Expression | undefined): string | undefined => {
  if (moduleSpecifier === undefined) {
    return undefined;
  }

  if (!ts.isStringLiteral(moduleSpecifier)) {
    return undefined;
  }

  return moduleSpecifier.text;
};

/** Lists top-level declaration names in a source file. */
const topLevelDeclarationNames = (sourceFile: ts.SourceFile): readonly string[] => {
  const names: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        const name = namedDeclarationName(declaration);
        if (name !== undefined) {
          names.push(name);
        }
      }
      return;
    }

    if (isNamedTopLevelDeclaration(node)) {
      const name = namedDeclarationName(node);
      if (name !== undefined) {
        names.push(name);
      }
    }
  });

  return names.sort();
};

/** Lists the declaration-level module specifiers exported by a source file. */
const exportDeclarationFacts = (sourceFile: ts.SourceFile): readonly ExportDeclarationFact[] => {
  const facts: ExportDeclarationFact[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isExportDeclaration(node)) {
      return;
    }

    const exportClause = node.exportClause;
    const moduleSpecifier = node.moduleSpecifier;

    facts.push({
      hasExportClause: exportClause !== undefined,
      hasModuleSpecifier: moduleSpecifier !== undefined,
      hasNamedExports: exportClause !== undefined && ts.isNamedExports(exportClause),
      moduleSpecifier: moduleSpecifierText(moduleSpecifier),
    });
  });

  return facts;
};

/** Lists the declaration-level module specifiers exported by a source file. */
const exportedModuleSpecifiers = (sourceFile: ts.SourceFile): readonly string[] => {
  return exportDeclarationFacts(sourceFile).flatMap((exportDeclaration) =>
    exportDeclaration.moduleSpecifier === undefined ? [] : [exportDeclaration.moduleSpecifier],
  );
};

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

/** Reads the package manifest with the export shape used by this test. */
const packageJson = (): PackageJson => {
  return JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
};

/** Asserts that package-entry re-exports stay explicit and named. */
const expectNamedModuleExports = (sourceFile: ts.SourceFile): void => {
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

  it("pins the final package entry and parseable diagnostic sources", () => {
    expectPackageEntryShape([
      "./diagnostics/report",
      "./diagnostics/rule-id",
      "./diagnostics/schema",
      "./diagnostics/severity",
      "./diagnostics/text",
      "./diagnostics/types",
      "./static-analysis",
    ]);
    expect(diagnosticModuleFiles()).toEqual([
      "report.ts",
      "rule-id.ts",
      "schema.ts",
      "severity.ts",
      "text.ts",
      "types.ts",
    ]);

    for (const sourcePath of [
      "src/index.ts",
      "src/diagnostics/report.ts",
      "src/diagnostics/rule-id.ts",
      "src/diagnostics/schema.ts",
      "src/diagnostics/severity.ts",
      "src/diagnostics/text.ts",
      "src/diagnostics/types.ts",
    ]) {
      expect(parseSource(sourcePath).fileName).toBe(sourcePath);
    }
    expect(topLevelDeclarationNames(parseSource("src/index.ts"))).toEqual([]);
  });
});
