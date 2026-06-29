/**
 * @file Test-only source parsing helpers for architecture checks.
 *
 * The helpers parse TypeScript source without emitting JavaScript, keeping
 * source-shape assertions independent from production module loading.
 */

import { readFileSync } from "node:fs";
import ts from "typescript";

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
