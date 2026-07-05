/**
 * @file Focused TypeScript source queries for architecture tests.
 *
 * These helpers keep syntax-tree query mechanics out of the architecture
 * assertions, where the reviewed contracts are easier to scan.
 */

import ts from "typescript";

/**
 * Finds one top-level declaration by name.
 *
 * @param sourceFile - Parsed TypeScript source file to inspect.
 * @param declarationName - Top-level declaration name to find.
 * @returns The matching declaration node, or `undefined` when absent.
 */
export const topLevelDeclarationByName = (
  sourceFile: ts.SourceFile,
  declarationName: string,
): ts.Node | undefined => {
  let match: ts.Node | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (topLevelDeclarationName(node) === declarationName) {
      match = node;
    }
  });

  return match;
};

/**
 * Counts direct call-expression names inside one declaration body.
 *
 * @param node - Declaration node whose descendant call expressions are counted.
 * @returns A read-only map keyed by supported call-expression name.
 */
export const callCountsByName = (node: ts.Node): ReadonlyMap<string, number> => {
  const calls = new Map<string, number>();

  const visit = (candidate: ts.Node): void => {
    const callName = calledExpressionName(candidate);
    if (callName !== undefined) {
      calls.set(callName, (calls.get(callName) ?? 0) + 1);
    }

    ts.forEachChild(candidate, visit);
  };

  visit(node);

  return calls;
};

/**
 * Returns one top-level variable initializer by declaration name.
 *
 * @param sourceFile - Parsed TypeScript source file to inspect.
 * @param declarationName - Variable declaration name to find.
 * @returns The variable initializer expression, or `undefined` when absent.
 */
export const topLevelVariableInitializer = (
  sourceFile: ts.SourceFile,
  declarationName: string,
): ts.Expression | undefined => {
  let initializer: ts.Expression | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }

    for (const declaration of node.declarationList.declarations) {
      if (identifierText(declaration.name) === declarationName) {
        initializer = declaration.initializer;
      }
    }
  });

  return initializer;
};

/**
 * Extracts property names from an object-literal dispatch table.
 *
 * @param initializer - Candidate object-literal initializer.
 * @returns Property names that are represented as identifiers or strings.
 */
export const objectLiteralPropertyNames = (
  initializer: ts.Expression | undefined,
): readonly string[] => {
  if (initializer === undefined || !ts.isObjectLiteralExpression(initializer)) {
    return [];
  }

  return initializer.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) {
      return [];
    }

    const name = property.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
      return [name.text];
    }

    return [];
  });
};

/**
 * Extracts string values from a `new Set([...])` initializer.
 *
 * @param initializer - Candidate `new Set` initializer.
 * @returns String-literal values from the first array argument.
 */
export const stringSetInitializerValues = (
  initializer: ts.Expression | undefined,
): readonly string[] => {
  if (initializer === undefined || !ts.isNewExpression(initializer)) {
    return [];
  }

  const [firstArgument] = initializer.arguments ?? [];
  if (firstArgument === undefined || !ts.isArrayLiteralExpression(firstArgument)) {
    return [];
  }

  return firstArgument.elements.flatMap((element) => {
    return ts.isStringLiteral(element) ? [element.text] : [];
  });
};

/** Extracts a top-level declaration name that can own helper logic. */
const topLevelDeclarationName = (node: ts.Node): string | undefined => {
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    return identifierText(node.name);
  }

  if (ts.isVariableStatement(node)) {
    const [declaration] = node.declarationList.declarations;
    return identifierText(declaration?.name);
  }

  return undefined;
};

/** Returns the called expression name for supported direct call shapes. */
const calledExpressionName = (node: ts.Node): string | undefined => {
  if (!ts.isCallExpression(node)) {
    return undefined;
  }

  const expression = node.expression;
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    return `${expression.expression.text}.${expression.name.text}`;
  }

  return undefined;
};

/** Extracts identifier text from a declaration name. */
const identifierText = (node: ts.Node | undefined): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  return ts.isIdentifier(node) ? node.text : undefined;
};
