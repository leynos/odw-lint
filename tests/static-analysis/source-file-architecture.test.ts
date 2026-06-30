/**
 * @file Source-file helper architecture tests.
 *
 * These tests pin the internal ownership split while public consumers continue
 * importing the helper facade through `odw-lint`.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const SOURCE_HELPER_MODULES = [
  "index.ts",
  "source-file.ts",
  "source-indexes.ts",
  "source-mask.ts",
  "source-position.ts",
  "source-scan.ts",
  "source-snippet.ts",
  "types.ts",
] as const;

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

/** Counts physical source lines in one repository-relative file. */
const sourceLineCount = (relativePath: string): number => {
  return readFileSync(relativePath, "utf8").split("\n").length;
};

/** Extracts an identifier from a declaration when one is present. */
const namedDeclarationName = (declaration: ts.Declaration): string | undefined => {
  if (!("name" in declaration)) {
    return undefined;
  }

  const name = (declaration as { readonly name?: ts.Node }).name;

  if (name === undefined || !ts.isIdentifier(name)) {
    return undefined;
  }

  return name.text;
};

/** Checks whether a top-level node is a named declaration kind. */
const isNamedTopLevelDeclaration = (
  node: ts.Node,
): node is
  | ts.FunctionDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.ClassDeclaration
  | ts.EnumDeclaration
  | ts.ModuleDeclaration => {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  );
};

/** Lists top-level declaration names in a source file. */
const topLevelDeclarationNames = (relativePath: string): readonly string[] => {
  const names: string[] = [];
  const sourceFile = parseSource(relativePath);

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

/** Lists declaration-level export facts for one source file. */
const exportDeclarationFacts = (relativePath: string): readonly ExportDeclarationFact[] => {
  const facts: ExportDeclarationFact[] = [];
  const sourceFile = parseSource(relativePath);

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isExportDeclaration(node)) {
      return;
    }

    facts.push({
      hasExportClause: node.exportClause !== undefined,
      hasModuleSpecifier: node.moduleSpecifier !== undefined,
      hasNamedExports: node.exportClause !== undefined && ts.isNamedExports(node.exportClause),
      moduleSpecifier: moduleSpecifierText(node.moduleSpecifier),
    });
  });

  return facts;
};

/** Asserts that one module owns the named top-level declarations. */
const expectModuleDeclarations = (
  relativePath: string,
  expectedDeclarations: readonly string[],
): void => {
  expect(topLevelDeclarationNames(relativePath)).toEqual([...expectedDeclarations].sort());
};

describe("source-file helper architecture", () => {
  it("keeps scan and index ownership in focused modules", () => {
    expect(existsSync("src/static-analysis/source-scan.ts")).toBeTrue();
    expect(existsSync("src/static-analysis/source-indexes.ts")).toBeTrue();
    expect(existsSync("src/static-analysis/source-mask.ts")).toBeTrue();
    expect(existsSync("src/static-analysis/source-position.ts")).toBeTrue();
    expect(existsSync("src/static-analysis/source-snippet.ts")).toBeTrue();
    expect(existsSync("src/static-analysis/source-file.ts")).toBeTrue();

    expectModuleDeclarations("src/static-analysis/source-scan.ts", [
      "LINE_TERMINATORS",
      "SourceIndexes",
      "SourceScan",
      "isCrLfTerminator",
      "isLineTerminator",
      "lineTerminatorByteLength",
      "lineTerminatorIndexLength",
      "scanOriginalSource",
      "sourceLine",
      "sourcePosition",
      "utf8ByteLengthForCodePoint",
    ]);
    expectModuleDeclarations("src/static-analysis/source-indexes.ts", [
      "SOURCE_INDEXES",
      "recordSourceIndexes",
      "sourceIndexes",
      "textIndexAtOffset",
    ]);

    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).toContain(
      "createOriginalSourceFile",
    );
  });

  it("keeps inert-region masking in source-mask", () => {
    expectModuleDeclarations("src/static-analysis/source-mask.ts", [
      "MaskedSource",
      "REGEX_ALLOWED_PREVIOUS_CHARACTERS",
      "SourceMaskKind",
      "SourceMaskRange",
      "TemplateScanState",
      "TemplateScanStep",
      "blankMaskedRange",
      "createMaskedRange",
      "isCommentStart",
      "isLineTerminatorCharacter",
      "isRegexClassBoundary",
      "isRegexAllowedAfter",
      "isRegexDelimiter",
      "isStringLikeDelimiter",
      "isTemplateClose",
      "isTemplateExpressionOpen",
      "lastSignificantCharacterInRange",
      "maskNonCodeSource",
      "nextOrdinaryTemplateStep",
      "nextSignificantCharacterAfterRange",
      "nextTemplateIndex",
      "nextTemplateStep",
      "scanCommentRange",
      "scanEscapedDelimitedEnd",
      "scanLineCommentEnd",
      "scanMaskRange",
      "scanQuotedStringRange",
      "scanRegexEnd",
      "scanRegexFlagsEnd",
      "scanRegexRange",
      "scanTemplateEnd",
      "scanTemplateRange",
    ]);

    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).not.toContain(
      "maskNonCodeSource",
    );
  });

  it("keeps offset lookup and span validation in source-position", () => {
    expectModuleDeclarations("src/static-analysis/source-position.ts", [
      "isSamePosition",
      "isObjectRecord",
      "isSourcePositionLike",
      "isSourceSpanLike",
      "positionAtOffset",
      "sourceSpan",
      "spanFromOffsets",
      "validateOffsetBounds",
      "validateSourceSpan",
    ]);

    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).not.toContain(
      "positionAtOffset",
    );
    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).not.toContain(
      "spanFromOffsets",
    );
    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).not.toContain(
      "validateSourceSpan",
    );
  });

  it("keeps slicing and snippets in source-snippet", () => {
    expectModuleDeclarations("src/static-analysis/source-snippet.ts", [
      "lineTextAtPosition",
      "sliceSourceSpan",
      "sliceValidatedSourceSpan",
      "snippetForSpan",
    ]);

    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).not.toContain(
      "sliceSourceSpan",
    );
    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).not.toContain(
      "snippetForSpan",
    );
    expect(topLevelDeclarationNames("src/static-analysis/source-file.ts")).not.toContain(
      "sliceValidatedSourceSpan",
    );
  });

  it("pins the source-helper module set and facade shape", () => {
    for (const fileName of SOURCE_HELPER_MODULES) {
      expect(existsSync(`src/static-analysis/${fileName}`)).toBeTrue();
    }

    expectModuleDeclarations("src/static-analysis/source-file.ts", ["createOriginalSourceFile"]);
    expect(exportDeclarationFacts("src/static-analysis/source-file.ts")).toEqual([
      {
        hasExportClause: true,
        hasModuleSpecifier: true,
        hasNamedExports: true,
        moduleSpecifier: "./source-position",
      },
      {
        hasExportClause: true,
        hasModuleSpecifier: true,
        hasNamedExports: true,
        moduleSpecifier: "./source-snippet",
      },
    ]);
  });

  it("keeps source helper modules under the project line limit", () => {
    for (const fileName of SOURCE_HELPER_MODULES) {
      expect(sourceLineCount(`src/static-analysis/${fileName}`)).toBeLessThanOrEqual(400);
    }
  });
});
