/**
 * @file Test-only helpers for source import architecture checks.
 *
 * These helpers inspect TypeScript source shape without loading production
 * modules, so architecture tests can verify boundaries without executing
 * implementation code.
 */

import { readFileSync } from "node:fs";
import ts from "typescript";

export type ExportDeclarationFact = {
  readonly hasExportClause: boolean;
  readonly hasModuleSpecifier: boolean;
  readonly hasNamedExports: boolean;
  readonly moduleSpecifier: string | undefined;
};

export type ImportLikeEdge = {
  readonly filePath: string;
  readonly moduleSpecifier: string;
};

export type ComputedDynamicImport = {
  readonly filePath: string;
  readonly expressionText: string;
};

export type ComputedCommonJsRequire = {
  readonly filePath: string;
  readonly expressionText: string;
};

export type ImportArchitectureFacts = {
  readonly importLikeEdges: readonly ImportLikeEdge[];
  readonly computedDynamicImports: readonly ComputedDynamicImport[];
  readonly computedCommonJsRequires: readonly ComputedCommonJsRequire[];
};

/**
 * Parses a repository-relative TypeScript file.
 *
 * @param relativePath - Repository-relative path to the TypeScript source.
 * @returns A TypeScript source file parsed without emitting code.
 */
export const parseSource = (relativePath: string): ts.SourceFile => {
  const source = readFileSync(relativePath, "utf8");

  return ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
};

type ImportArchitectureTextFact = {
  readonly filePath: string;
  readonly expressionText?: string;
  readonly moduleSpecifier?: string;
};

/** Sorts import architecture facts for stable, reviewer-readable failures. */
const sortedFacts = <Fact extends ImportArchitectureTextFact>(
  facts: readonly Fact[],
): readonly Fact[] => {
  return [...facts].sort((left, right) => {
    const leftText = left.moduleSpecifier ?? left.expressionText ?? "";
    const rightText = right.moduleSpecifier ?? right.expressionText ?? "";
    return left.filePath.localeCompare(right.filePath) || leftText.localeCompare(rightText);
  });
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

/** Extracts module specifier text from string-literal import targets. */
const moduleSpecifierText = (moduleSpecifier: ts.Expression | undefined): string | undefined => {
  if (moduleSpecifier === undefined) {
    return undefined;
  }

  if (!ts.isStringLiteral(moduleSpecifier)) {
    return undefined;
  }

  return moduleSpecifier.text;
};

/** Extracts string-literal specifiers from TypeScript import-type queries. */
const importTypeSpecifierText = (node: ts.ImportTypeNode): string | undefined => {
  const argument = node.argument;

  if (!ts.isLiteralTypeNode(argument)) {
    return undefined;
  }

  if (!ts.isStringLiteral(argument.literal)) {
    return undefined;
  }

  return argument.literal.text;
};

/** Detects dynamic import calls through the TypeScript AST call shape. */
const isDynamicImportCall = (node: ts.CallExpression): boolean => {
  return node.expression.kind === ts.SyntaxKind.ImportKeyword;
};

/** Detects ordinary CommonJS require calls that Bun permits in TypeScript. */
const isCommonJsRequireCall = (node: ts.CallExpression): boolean => {
  return ts.isIdentifier(node.expression) && node.expression.text === "require";
};

/** Preserves computed call text so failures show the unresolved expression. */
const argumentExpressionText = (
  sourceFile: ts.SourceFile,
  firstArgument: ts.Expression | undefined,
): string => {
  return firstArgument?.getText(sourceFile) ?? "<missing>";
};

/** Distinguishes literal module targets from computed call arguments. */
const stringLiteralArgumentText = (
  firstArgument: ts.Expression | undefined,
): string | undefined => {
  if (firstArgument === undefined) {
    return undefined;
  }

  if (!ts.isStringLiteral(firstArgument)) {
    return undefined;
  }

  return firstArgument.text;
};

/** Appends only resolved literal specifiers to the import-like edge list. */
const pushImportLikeEdge = (
  edges: ImportLikeEdge[],
  filePath: string,
  moduleSpecifier: string | undefined,
): void => {
  if (moduleSpecifier === undefined) {
    return;
  }

  edges.push({ filePath, moduleSpecifier });
};

/** Classifies import and require calls into literal and computed facts. */
const collectCallExpressionFacts = (
  facts: {
    readonly importLikeEdges: ImportLikeEdge[];
    readonly computedDynamicImports: ComputedDynamicImport[];
    readonly computedCommonJsRequires: ComputedCommonJsRequire[];
  },
  sourceFile: ts.SourceFile,
  node: ts.CallExpression,
): void => {
  const firstArgument = node.arguments[0];
  const moduleSpecifier = stringLiteralArgumentText(firstArgument);

  if (isDynamicImportCall(node)) {
    if (moduleSpecifier === undefined) {
      facts.computedDynamicImports.push({
        filePath: sourceFile.fileName,
        expressionText: argumentExpressionText(sourceFile, firstArgument),
      });
      return;
    }
    facts.importLikeEdges.push({ filePath: sourceFile.fileName, moduleSpecifier });
    return;
  }

  if (isCommonJsRequireCall(node)) {
    if (moduleSpecifier === undefined) {
      facts.computedCommonJsRequires.push({
        filePath: sourceFile.fileName,
        expressionText: argumentExpressionText(sourceFile, firstArgument),
      });
      return;
    }
    facts.importLikeEdges.push({ filePath: sourceFile.fileName, moduleSpecifier });
  }
};

/**
 * Extracts import-like facts from TypeScript source text.
 *
 * @param filePath - Stable file path to attach to extracted facts.
 * @param sourceText - TypeScript source text to parse structurally.
 * @returns Sorted import-like and computed import facts.
 */
export const importArchitectureFactsFromSource = (
  filePath: string,
  sourceText: string,
): ImportArchitectureFacts => {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const importLikeEdges: ImportLikeEdge[] = [];
  const computedDynamicImports: ComputedDynamicImport[] = [];
  const computedCommonJsRequires: ComputedCommonJsRequire[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      pushImportLikeEdge(importLikeEdges, filePath, moduleSpecifierText(node.moduleSpecifier));
    }

    if (ts.isExportDeclaration(node)) {
      pushImportLikeEdge(importLikeEdges, filePath, moduleSpecifierText(node.moduleSpecifier));
    }

    if (ts.isImportEqualsDeclaration(node)) {
      const moduleReference = node.moduleReference;
      const moduleSpecifier = ts.isExternalModuleReference(moduleReference)
        ? moduleSpecifierText(moduleReference.expression)
        : undefined;
      pushImportLikeEdge(importLikeEdges, filePath, moduleSpecifier);
    }

    if (ts.isImportTypeNode(node)) {
      pushImportLikeEdge(importLikeEdges, filePath, importTypeSpecifierText(node));
    }

    if (ts.isCallExpression(node)) {
      collectCallExpressionFacts(
        { importLikeEdges, computedDynamicImports, computedCommonJsRequires },
        sourceFile,
        node,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    importLikeEdges: sortedFacts(importLikeEdges),
    computedDynamicImports: sortedFacts(computedDynamicImports),
    computedCommonJsRequires: sortedFacts(computedCommonJsRequires),
  };
};

const FORBIDDEN_PRIVATE_ODW_MODULES = new Set([
  "src/index",
  "dist/index",
  "src/loader",
  "dist/loader",
  "src/primitives",
  "dist/primitives",
]);

/** Matches private executable ODW paths below package or sibling roots. */
const isPrivateExecutableOdwPath = (modulePath: string): boolean => {
  return (
    FORBIDDEN_PRIVATE_ODW_MODULES.has(modulePath) ||
    modulePath === "src/runtime" ||
    modulePath === "dist/runtime" ||
    modulePath.startsWith("src/runtime/") ||
    modulePath.startsWith("dist/runtime/")
  );
};

/** Matches path-style references into a sibling ODW checkout. */
const isSiblingOdwExecutablePath = (moduleSpecifier: string): boolean => {
  const marker = "/open-dynamic-workflows/";
  const markerIndex = moduleSpecifier.lastIndexOf(marker);

  return (
    markerIndex !== -1 &&
    isPrivateExecutableOdwPath(moduleSpecifier.slice(markerIndex + marker.length))
  );
};

/**
 * Checks whether an import specifier targets executable ODW runtime code.
 *
 * @param moduleSpecifier - Raw module specifier from an import-like edge.
 * @returns `true` when production code must not import the specifier.
 */
export const isForbiddenOdwImport = (moduleSpecifier: string): boolean => {
  const normalized = moduleSpecifier.replaceAll("\\", "/").replace(/\.(?:ts|js)$/u, "");

  if (normalized === "odw") {
    return true;
  }

  if (normalized.startsWith("odw/")) {
    return isPrivateExecutableOdwPath(normalized.slice("odw/".length));
  }

  return isSiblingOdwExecutablePath(normalized);
};

/**
 * Lists top-level declaration names in a source file.
 *
 * @param sourceFile - Parsed TypeScript source file to inspect.
 * @returns Sorted top-level declaration names.
 */
export const topLevelDeclarationNames = (sourceFile: ts.SourceFile): readonly string[] => {
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

/**
 * Lists declaration-level export facts in a source file.
 *
 * @param sourceFile - Parsed TypeScript source file to inspect.
 * @returns Export declaration facts in source order.
 */
export const exportDeclarationFacts = (
  sourceFile: ts.SourceFile,
): readonly ExportDeclarationFact[] => {
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

/**
 * Lists the declaration-level module specifiers exported by a source file.
 *
 * @param sourceFile - Parsed TypeScript source file to inspect.
 * @returns Exported module specifiers in declaration order.
 */
export const exportedModuleSpecifiers = (sourceFile: ts.SourceFile): readonly string[] => {
  return exportDeclarationFacts(sourceFile).flatMap((exportDeclaration) =>
    exportDeclaration.moduleSpecifier === undefined ? [] : [exportDeclaration.moduleSpecifier],
  );
};
