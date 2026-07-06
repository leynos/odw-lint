/**
 * @file Shared import-inspection helpers for build-gate CLI seam tests.
 */

import ts from "typescript";

/**
 * Check whether a source file imports a named symbol from one module path.
 *
 * @param sourceFile Parsed TypeScript source file to inspect.
 * @param importPath Module specifier text to match.
 * @param importedName Exported named import to find.
 * @returns Whether at least one matching import exists.
 */
export function hasNamedImport(
  sourceFile: ts.SourceFile,
  importPath: string,
  importedName: string,
): boolean {
  return namedImportBindings(sourceFile, importPath, importedName).length > 0;
}

/**
 * Return local bindings for a named symbol imported from one module path.
 *
 * @param sourceFile Parsed TypeScript source file to inspect.
 * @param importPath Module specifier text to match.
 * @param importedName Exported named import to find.
 * @returns Local binding names for direct and aliased named imports.
 */
export function namedImportBindings(
  sourceFile: ts.SourceFile,
  importPath: string,
  importedName: string,
): readonly string[] {
  return sourceFile.statements.flatMap((statement) =>
    matchingNamedImportBindings(statement, importPath, importedName),
  );
}

/**
 * Return named imports from one module path, if a statement is that import.
 *
 * @param statement Top-level statement to inspect.
 * @param importPath Module specifier text to match.
 * @returns Matching named imports, or undefined when absent.
 */
export function nodeModuleNamedImports(
  statement: ts.Statement,
  importPath: string,
): ts.NamedImports | undefined {
  const namedBindings = nodeModuleImportClause(statement, importPath)?.namedBindings;

  if (namedBindings === undefined || !ts.isNamedImports(namedBindings)) {
    return undefined;
  }

  return namedBindings;
}

/**
 * Return the import clause for one module path, if a statement is that import.
 *
 * @param statement Top-level statement to inspect.
 * @param importPath Module specifier text to match.
 * @returns Matching import clause, or undefined when absent.
 */
export function nodeModuleImportClause(
  statement: ts.Statement,
  importPath: string,
): ts.ImportClause | undefined {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return undefined;
  }

  if (statement.moduleSpecifier.text !== importPath) {
    return undefined;
  }

  return statement.importClause;
}

/**
 * Return the exported symbol name for direct and aliased named imports.
 *
 * @param element Import specifier to inspect.
 * @returns Exported symbol name before local aliasing.
 */
export function importSpecifierName(element: ts.ImportSpecifier): string {
  return element.propertyName?.text ?? element.name.text;
}

/** Return local bindings from one import declaration for a named import. */
function matchingNamedImportBindings(
  statement: ts.Statement,
  importPath: string,
  importedName: string,
): readonly string[] {
  const namedBindings = nodeModuleNamedImports(statement, importPath);
  if (namedBindings === undefined) {
    return [];
  }

  return namedBindings.elements
    .filter((element) => importSpecifierName(element) === importedName)
    .map((element) => element.name.text);
}
