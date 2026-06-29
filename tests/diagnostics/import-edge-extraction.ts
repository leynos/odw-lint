/**
 * @file Test-only extraction of import-like TypeScript source edges.
 *
 * These helpers use TypeScript's parser without loading target modules, so
 * architecture tests can inspect dependency shape without executing code.
 */

import ts from "typescript";

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
