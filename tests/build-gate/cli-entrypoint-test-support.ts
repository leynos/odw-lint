/**
 * @file Focused test helper for build-gate direct-entrypoint support.
 */

import ts from "typescript";
import {
  importSpecifierName,
  namedImportBindings,
  nodeModuleImportClause,
} from "./cli-import-test-support";

type CliEntrypointSeamExpectation = {
  readonly source: string;
  readonly importPath: string;
};

type ProcessEntrypointBindings = Readonly<{
  readonly process: ReadonlySet<string>;
  readonly argv: ReadonlySet<string>;
  readonly exit: ReadonlySet<string>;
  readonly exitCode: ReadonlySet<string>;
}>;

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
  if (
    hasInlineRunAndExitGuard(sourceFile, entrypointBindings, processEntrypointBindings(sourceFile))
  ) {
    throw new Error("build-gate CLI must not inline the run-and-exit guard");
  }

  if (!hasSharedEntrypointCall) {
    throw new Error("build-gate CLI must call runCliEntrypoint");
  }
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
      if (found) {
        return;
      }
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
  processBindings: ProcessEntrypointBindings,
): boolean {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (isSharedEntrypointCall(node, sharedEntrypointBindings)) {
      return;
    }

    if (isInlineProcessEntrypointAccess(node, processBindings)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

/** Check for local process access that belongs inside the shared helper seam. */
function isInlineProcessEntrypointAccess(
  node: ts.Node,
  processBindings: ProcessEntrypointBindings,
): boolean {
  if (isProcessArgvAccess(node, processBindings)) {
    return true;
  }

  if (isProcessExitCodeAssignment(node, processBindings)) {
    return true;
  }

  return isProcessExitCall(node, processBindings);
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
function isProcessArgvAccess(node: ts.Node, processBindings: ProcessEntrypointBindings): boolean {
  if (ts.isIdentifier(node) && processBindings.argv.has(node.text)) {
    return true;
  }

  return (
    ts.isPropertyAccessExpression(node) && isProcessPropertyAccess(node, "argv", processBindings)
  );
}

/** Check for direct `process.exitCode = ...` assignment. */
function isProcessExitCodeAssignment(
  node: ts.Node,
  processBindings: ProcessEntrypointBindings,
): boolean {
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ((ts.isPropertyAccessExpression(node.left) &&
      isProcessPropertyAccess(node.left, "exitCode", processBindings)) ||
      (ts.isIdentifier(node.left) && processBindings.exitCode.has(node.left.text)))
  );
}

/** Check for direct `process.exit(...)` calls. */
function isProcessExitCall(node: ts.Node, processBindings: ProcessEntrypointBindings): boolean {
  return (
    ts.isCallExpression(node) &&
    ((ts.isPropertyAccessExpression(node.expression) &&
      isProcessPropertyAccess(node.expression, "exit", processBindings)) ||
      (ts.isIdentifier(node.expression) && processBindings.exit.has(node.expression.text)))
  );
}

/** Check for a property access on the global or imported process object. */
function isProcessPropertyAccess(
  node: ts.PropertyAccessExpression,
  propertyName: string,
  processBindings: ProcessEntrypointBindings,
): boolean {
  return (
    node.name.text === propertyName &&
    ts.isIdentifier(node.expression) &&
    processBindings.process.has(node.expression.text)
  );
}

/** Collect process bindings that can clone direct-entrypoint orchestration. */
function processEntrypointBindings(sourceFile: ts.SourceFile): ProcessEntrypointBindings {
  const processBindings = new Set(["process"]);
  const argvBindings = new Set<string>();
  const exitBindings = new Set<string>();
  const exitCodeBindings = new Set<string>();

  for (const statement of sourceFile.statements) {
    addNodeProcessBindings(statement, {
      argv: argvBindings,
      exit: exitBindings,
      exitCode: exitCodeBindings,
      process: processBindings,
    });
  }

  return {
    argv: argvBindings,
    exit: exitBindings,
    exitCode: exitCodeBindings,
    process: processBindings,
  };
}

/** Add local bindings from one `node:process` import declaration. */
function addNodeProcessBindings(
  statement: ts.Statement,
  bindings: {
    readonly process: Set<string>;
    readonly argv: Set<string>;
    readonly exit: Set<string>;
    readonly exitCode: Set<string>;
  },
): void {
  const importClause = nodeProcessImportClause(statement);
  if (importClause === undefined) {
    return;
  }

  if (importClause?.name !== undefined) {
    bindings.process.add(importClause.name.text);
  }

  if (importClause?.namedBindings === undefined || !ts.isNamedImports(importClause.namedBindings)) {
    return;
  }

  for (const element of importClause.namedBindings.elements) {
    addNamedProcessBinding(element, "argv", bindings.argv);
    addNamedProcessBinding(element, "exit", bindings.exit);
    addNamedProcessBinding(element, "exitCode", bindings.exitCode);
  }
}

/** Return the import clause for a `node:process` import declaration. */
function nodeProcessImportClause(statement: ts.Statement): ts.ImportClause | undefined {
  return nodeModuleImportClause(statement, "node:process");
}

/** Add a local binding for one named process import when present. */
function addNamedProcessBinding(
  element: ts.ImportSpecifier,
  importedName: "argv" | "exit" | "exitCode",
  bindings: Set<string>,
): void {
  if (importSpecifierName(element) === importedName) {
    bindings.add(element.name.text);
  }
}
