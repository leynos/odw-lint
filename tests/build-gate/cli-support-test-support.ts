/**
 * @file Focused test helpers for build-gate command-line support.
 */

import ts from "typescript";
import {
  hasNamedImport,
  importSpecifierName,
  nodeModuleNamedImports,
} from "./cli-import-test-support";

type CliSeamExpectation = {
  readonly source: string;
  readonly importPath: string;
};

type ProcessStreamBindings = Readonly<{
  readonly stdout: ReadonlySet<string>;
  readonly stderr: ReadonlySet<string>;
}>;

/**
 * Assert that a build-gate CLI imports the shared writer type without
 * reintroducing a local writer contract or default process-stream seam.
 *
 * @param expectation Source text and expected shared helper import path.
 * @throws Error when the source does not use the shared writer seam.
 */
export function expectSharedCliWriterSeam(expectation: CliSeamExpectation): void {
  const sourceFile = ts.createSourceFile(
    "build-gate-cli.ts",
    expectation.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  if (!hasNamedImport(sourceFile, expectation.importPath, "CliWriters")) {
    throw new Error(`build-gate CLI must import CliWriters from ${expectation.importPath}`);
  }

  const localWriterContracts = findLocalWriterContracts(sourceFile);

  if (localWriterContracts.length > 0) {
    throw new Error(
      `build-gate CLI must not declare local writer contracts: ${localWriterContracts.join(", ")}`,
    );
  }

  const defaultStreamWriters = findDefaultStreamWriterObjects(
    sourceFile,
    processStreamBindings(sourceFile),
  );

  if (defaultStreamWriters.length > 0) {
    throw new Error(
      `build-gate CLI must not inline default process-stream writer objects: ${defaultStreamWriters.join(", ")}`,
    );
  }
}

/** Find top-level type declarations that clone the two-field writer contract. */
function findLocalWriterContracts(sourceFile: ts.SourceFile): readonly string[] {
  const declarations: string[] = [];

  const visit = (node: ts.Node): void => {
    if (hasStandaloneWriterContract(node)) {
      declarations.push(writerContractName(node));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return declarations;
}

/** Check whether a declaration node owns a standalone writer contract. */
function hasStandaloneWriterContract(node: ts.Node): boolean {
  if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) {
    return isStandaloneWriterContract(node.members);
  }

  return ts.isTypeAliasDeclaration(node) && containsStandaloneWriterTypeLiteral(node.type);
}

/** Check a type node for a standalone writer type literal. */
function containsStandaloneWriterTypeLiteral(node: ts.TypeNode): boolean {
  if (ts.isTypeLiteralNode(node)) {
    return isStandaloneWriterContract(node.members);
  }

  if (ts.isParenthesizedTypeNode(node)) {
    return containsStandaloneWriterTypeLiteral(node.type);
  }

  if (ts.isIntersectionTypeNode(node)) {
    return node.types.some(containsStandaloneWriterTypeLiteral);
  }

  if (ts.isTypeReferenceNode(node)) {
    return node.typeArguments?.some(containsStandaloneWriterTypeLiteral) ?? false;
  }

  return false;
}

/** Return the declaration name or location for a local writer contract. */
function writerContractName(node: ts.Node): string {
  if (ts.isInterfaceDeclaration(node)) {
    return node.name.text;
  }

  if (ts.isClassDeclaration(node)) {
    return node.name?.text ?? "<anonymous>";
  }

  if (ts.isTypeAliasDeclaration(node)) {
    return node.name.text;
  }

  return "<unknown>";
}

/** Check whether members describe exactly the duplicated writer seam shape. */
function isStandaloneWriterContract(
  members: ts.NodeArray<ts.TypeElement> | ts.NodeArray<ts.ClassElement>,
): boolean {
  const propertyNames = members
    .map(memberPropertyName)
    .map(propertyNameText)
    .filter((name): name is string => name !== undefined);

  return (
    propertyNames.length === 2 &&
    propertyNames.includes("writeOut") &&
    propertyNames.includes("writeErr")
  );
}

/** Return the property name for member nodes that can declare properties. */
function memberPropertyName(member: ts.TypeElement | ts.ClassElement): ts.PropertyName | undefined {
  if (ts.isPropertySignature(member)) {
    return member.name;
  }

  if (ts.isPropertyDeclaration(member)) {
    return member.name;
  }

  if (ts.isMethodSignature(member)) {
    return member.name;
  }

  if (ts.isMethodDeclaration(member)) {
    return member.name;
  }

  return undefined;
}

/** Find object literals that clone default process-stream writer resolution. */
function findDefaultStreamWriterObjects(
  sourceFile: ts.SourceFile,
  processBindings: ProcessStreamBindings,
): readonly string[] {
  const findings: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node) && isDefaultStreamWriterObject(node, processBindings)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      findings.push(`${line + 1}:${character + 1}`);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

/** Check whether an object literal maps both writers to process streams. */
function isDefaultStreamWriterObject(
  node: ts.ObjectLiteralExpression,
  processBindings: ProcessStreamBindings,
): boolean {
  const properties = new Map(
    node.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [propertyNameText(property.name), property.initializer] as const),
  );
  const writeOut = properties.get("writeOut");
  const writeErr = properties.get("writeErr");

  return (
    writeOut !== undefined &&
    writeErr !== undefined &&
    referencesProcessStream(writeOut, "stdout", processBindings) &&
    referencesProcessStream(writeErr, "stderr", processBindings)
  );
}

/** Check whether a node subtree references one process stream identifier. */
function referencesProcessStream(
  node: ts.Node,
  streamName: "stdout" | "stderr",
  processBindings: ProcessStreamBindings,
): boolean {
  if (isProcessStreamAccess(node, streamName, processBindings)) {
    return true;
  }

  let found = false;

  ts.forEachChild(node, (child) => {
    if (!found && referencesProcessStream(child, streamName, processBindings)) {
      found = true;
    }
  });

  return found;
}

/** Check whether a node directly accesses one process stream. */
function isProcessStreamAccess(
  node: ts.Node,
  streamName: "stdout" | "stderr",
  processBindings: ProcessStreamBindings,
): boolean {
  if (!ts.isPropertyAccessExpression(node)) {
    return false;
  }

  if (ts.isIdentifier(node.expression) && processBindings[streamName].has(node.expression.text)) {
    return true;
  }

  return (
    node.name.text === streamName &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process"
  );
}

/** Collect imported process stream binding names used by one source file. */
function processStreamBindings(sourceFile: ts.SourceFile): ProcessStreamBindings {
  const stdoutBindings = new Set<string>();
  const stderrBindings = new Set<string>();

  for (const statement of sourceFile.statements) {
    const namedImports = nodeProcessNamedImports(statement);
    if (namedImports === undefined) {
      continue;
    }

    for (const element of namedImports.elements) {
      addProcessStreamBinding(element, "stdout", stdoutBindings);
      addProcessStreamBinding(element, "stderr", stderrBindings);
    }
  }

  return { stdout: stdoutBindings, stderr: stderrBindings };
}

/** Return named imports from `node:process`, if a statement is that import. */
function nodeProcessNamedImports(statement: ts.Statement): ts.NamedImports | undefined {
  return nodeModuleNamedImports(statement, "node:process");
}

/** Add a local binding for a named process stream import when present. */
function addProcessStreamBinding(
  element: ts.ImportSpecifier,
  streamName: "stdout" | "stderr",
  bindings: Set<string>,
): void {
  if (importSpecifierName(element) === streamName) {
    bindings.add(element.name.text);
  }
}

/** Return stable text for simple property names used in writer contracts. */
function propertyNameText(name: ts.PropertyName | undefined): string | undefined {
  if (name === undefined) {
    return undefined;
  }

  if (isSimplePropertyName(name)) {
    return name.text;
  }

  return undefined;
}

/** Check whether a property name has direct literal text. */
function isSimplePropertyName(
  name: ts.PropertyName,
): name is ts.Identifier | ts.StringLiteral | ts.NumericLiteral {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name);
}
