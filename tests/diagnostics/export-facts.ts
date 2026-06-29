/**
 * @file Test-only export declaration facts for architecture checks.
 *
 * Package-entry tests use these facts to enforce explicit named re-exports
 * without importing the modules being described.
 */

import ts from "typescript";

export type ExportDeclarationFact = {
  readonly hasExportClause: boolean;
  readonly hasModuleSpecifier: boolean;
  readonly hasNamedExports: boolean;
  readonly moduleSpecifier: string | undefined;
};

/** Extracts module specifier text from string-literal export targets. */
const moduleSpecifierText = (moduleSpecifier: ts.Expression | undefined): string | undefined => {
  if (moduleSpecifier === undefined) {
    return undefined;
  }

  if (!ts.isStringLiteral(moduleSpecifier)) {
    return undefined;
  }

  return moduleSpecifier.text;
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
