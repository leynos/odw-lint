/**
 * @file Focused test helper for build-gate direct-entrypoint support.
 */

import ts from "typescript";

type CliEntrypointSeamExpectation = {
  readonly source: string;
  readonly importPath: string;
};

/**
 * Assert that a build-gate CLI uses the shared direct-entrypoint helper.
 *
 * @param expectation Source text and expected shared helper import path.
 * @throws Error when the source clones run-and-exit orchestration locally.
 */
export function expectSharedCliEntrypointSeam(expectation: CliEntrypointSeamExpectation): void {
  const sourceFile = ts.createSourceFile(
    "build-gate-cli.ts",
    expectation.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const entrypointBindings = namedImportBindings(
    sourceFile,
    expectation.importPath,
    "runCliEntrypoint",
  );
  if (entrypointBindings.length === 0) {
    throw new Error(`build-gate CLI must import runCliEntrypoint from ${expectation.importPath}`);
  }

  const hasSharedEntrypointCall = hasCallExpression(sourceFile, entrypointBindings);
  if (hasInlineRunAndExitGuard(sourceFile, entrypointBindings)) {
    throw new Error("build-gate CLI must not inline the run-and-exit guard");
  }

  if (!hasSharedEntrypointCall) {
    throw new Error("build-gate CLI must call runCliEntrypoint");
  }
}

/** Return local bindings for a named symbol imported from one module path. */
function namedImportBindings(
  sourceFile: ts.SourceFile,
  importPath: string,
  importedName: string,
): readonly string[] {
  return sourceFile.statements.flatMap((statement) =>
    matchingNamedImportBindings(statement, importPath, importedName),
  );
}

/** Return local bindings from one import declaration for a named import. */
function matchingNamedImportBindings(
  statement: ts.Statement,
  importPath: string,
  importedName: string,
): readonly string[] {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return [];
  }

  const namedBindings = statement.importClause?.namedBindings;

  if (statement.moduleSpecifier.text !== importPath) {
    return [];
  }

  if (namedBindings === undefined || !ts.isNamedImports(namedBindings)) {
    return [];
  }

  return namedBindings.elements
    .filter((element) => importSpecifierName(element) === importedName)
    .map((element) => element.name.text);
}

/** Return the exported symbol name for direct and aliased named imports. */
function importSpecifierName(element: ts.ImportSpecifier): string {
  return element.propertyName?.text ?? element.name.text;
}

/** Check whether the source contains a direct call to one of the named helpers. */
function hasCallExpression(sourceFile: ts.SourceFile, functionNames: readonly string[]): boolean {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      found = functionNames.includes(node.expression.text);
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

/** Check whether source still clones process argv or exit-code orchestration. */
function hasInlineRunAndExitGuard(
  sourceFile: ts.SourceFile,
  sharedEntrypointBindings: readonly string[],
): boolean {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (isSharedEntrypointCall(node, sharedEntrypointBindings)) {
      return;
    }

    if (isInlineProcessEntrypointAccess(node)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

/** Check for local process access that belongs inside the shared helper seam. */
function isInlineProcessEntrypointAccess(node: ts.Node): boolean {
  if (isProcessArgvAccess(node)) {
    return true;
  }

  if (isProcessExitCodeAssignment(node)) {
    return true;
  }

  return isProcessExitCall(node);
}

/** Check for a call through the shared direct-entrypoint helper. */
function isSharedEntrypointCall(
  node: ts.Node,
  sharedEntrypointBindings: readonly string[],
): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    sharedEntrypointBindings.includes(node.expression.text)
  );
}

/** Check for direct `process.argv` access outside the shared helper call. */
function isProcessArgvAccess(node: ts.Node): boolean {
  return ts.isPropertyAccessExpression(node) && isProcessPropertyAccess(node, "argv");
}

/** Check for direct `process.exitCode = ...` assignment. */
function isProcessExitCodeAssignment(node: ts.Node): boolean {
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(node.left) &&
    isProcessPropertyAccess(node.left, "exitCode")
  );
}

/** Check for direct `process.exit(...)` calls. */
function isProcessExitCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    isProcessPropertyAccess(node.expression, "exit")
  );
}

/** Check for a direct property access on the global process object. */
function isProcessPropertyAccess(node: ts.PropertyAccessExpression, propertyName: string): boolean {
  return (
    node.name.text === propertyName &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process"
  );
}
