/**
 * @file Diagnostic module inventory tests.
 *
 * Package entry and import-policy contracts live in focused neighbouring
 * suites; this file keeps the diagnostic module inventory and parseability
 * checks together.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import ts from "typescript";
import {
  EXPECTED_DIAGNOSTIC_MODULE_FILES,
  EXPECTED_PARSEABLE_SOURCE_FILES,
  EXPECTED_STATIC_ANALYSIS_MODULE_FILES,
} from "./architecture-fixtures";
import {
  callCountsByName,
  objectLiteralPropertyNames,
  stringSetInitializerValues,
  topLevelDeclarationByName,
  topLevelVariableInitializer,
} from "./architecture-source-queries";
import { parseSource, topLevelDeclarationNames } from "./import-architecture";

const STATIC_ANALYSIS_SOURCE_PATH = "src/static-analysis";
const SWC_AST_SEAM_SOURCE = `${STATIC_ANALYSIS_SOURCE_PATH}/swc-ast.ts`;
const PRIVATE_SWC_HELPER_DECLARATION_NAMES = new Set([
  "childRecordValues",
  "childValues",
  "isAstNode",
  "isNode",
  "isTraversableChildKey",
]);
const PRIVATE_SWC_TRAVERSAL_DECLARATION_NAMES = new Set([
  "traverseAstChildValue",
  "traverseAstSubtree",
]);
const GENERIC_SWC_TRAVERSAL_CALLS = new Set([
  "Array.isArray",
  "astChildValues",
  "isAstNode",
  "isUnknownRecord",
]);

const PARAMETER_BINDING_SCOPE_TYPES = [
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "Constructor",
  "ClassMethod",
  "PrivateMethod",
  "MethodProperty",
  "SetterProperty",
] as const;
/** Lists current direct TypeScript source modules below one source directory. */
const sourceModuleFiles = (sourcePath: string): readonly string[] => {
  if (!existsSync(sourcePath)) {
    return [];
  }

  return readdirSync(sourcePath)
    .filter((fileName) => fileName.endsWith(".ts"))
    .sort();
};

/** Returns private SWC helper declarations that must live behind the seam. */
const privateSwcHelperDeclarations = (sourcePath: string): readonly string[] => {
  return topLevelDeclarationNames(parseSource(sourcePath)).filter((name) => {
    return PRIVATE_SWC_HELPER_DECLARATION_NAMES.has(name);
  });
};

/** Returns SWC traversal driver declarations that must live behind the seam. */
const privateSwcTraversalDeclarations = (sourcePath: string): readonly string[] => {
  return topLevelDeclarationNames(parseSource(sourcePath)).filter((name) => {
    return PRIVATE_SWC_TRAVERSAL_DECLARATION_NAMES.has(name);
  });
};

/** Finds top-level declarations that clone the generic SWC child dispatch. */
const genericSwcTraversalDeclarations = (sourcePath: string): readonly string[] => {
  const declarations: string[] = [];

  ts.forEachChild(parseSource(sourcePath), (node) => {
    const declarationName = topLevelDeclarationName(node);
    if (declarationName === undefined) {
      return;
    }

    if (hasGenericSwcTraversalShape(node)) {
      declarations.push(declarationName);
    }
  });

  return declarations.sort();
};

/** Finds top-level declarations that clone single-type SWC node narrowers. */
const clonedSwcSingleTypeNarrowerDeclarations = (sourcePath: string): readonly string[] => {
  return clonedSwcSingleTypeNarrowerDeclarationsFromSourceFile(parseSource(sourcePath));
};

/** Finds top-level cloned single-type SWC narrowers in one parsed source. */
const clonedSwcSingleTypeNarrowerDeclarationsFromSourceFile = (
  sourceFile: ts.SourceFile,
): readonly string[] => {
  const declarations: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    const declarationName = topLevelDeclarationName(node);
    if (declarationName === undefined) {
      return;
    }

    if (hasClonedSwcSingleTypeNarrowerShape(node)) {
      declarations.push(declarationName);
    }
  });

  return declarations.sort();
};

/** Parses in-memory architecture fixture source. */
const parseFixtureSource = (source: string): ts.SourceFile => {
  return ts.createSourceFile("architecture-fixture.ts", source, ts.ScriptTarget.Latest, true);
};

const flatBindingsSource = parseSource(`${STATIC_ANALYSIS_SOURCE_PATH}/workflow-ast-bindings.ts`);
const scopeOwnFactsSource = parseSource(
  `${STATIC_ANALYSIS_SOURCE_PATH}/workflow-ast-scope-own-facts.ts`,
);

const flatCollectorTypes = new Set(
  objectLiteralPropertyNames(
    topLevelVariableInitializer(flatBindingsSource, "STATEMENT_BINDING_COLLECTORS"),
  ),
);
const functionLikeScopeTypes = stringSetInitializerValues(
  topLevelVariableInitializer(scopeOwnFactsSource, "FUNCTION_LIKE_SCOPE_TYPES"),
).filter((nodeType) => nodeType !== "GetterProperty");

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

/** Checks whether one declaration owns the reviewed generic child dispatch. */
const hasGenericSwcTraversalShape = (node: ts.Node): boolean => {
  const calls = new Set<string>();

  const visit = (candidate: ts.Node): void => {
    const callName = calledExpressionName(candidate);
    if (callName !== undefined) {
      calls.add(callName);
    }

    ts.forEachChild(candidate, visit);
  };

  visit(node);

  return [...GENERIC_SWC_TRAVERSAL_CALLS].every((callName) => calls.has(callName));
};

/** Checks whether one declaration clones a single-type SWC seam narrower. */
const hasClonedSwcSingleTypeNarrowerShape = (node: ts.Node): boolean => {
  const expression = singleReturnExpression(node);

  if (expression === undefined) {
    return false;
  }

  return isAstNodeCall(expression) || isAstNodeAndTypeDiscriminantCheck(expression);
};

/** Returns a declaration's single return expression when it has one. */
const singleReturnExpression = (node: ts.Node): ts.Expression | undefined => {
  if (ts.isVariableStatement(node)) {
    return singleVariableReturnExpression(node);
  }

  if (ts.isFunctionDeclaration(node)) {
    return singleFunctionReturnExpression(node);
  }

  return undefined;
};

/** Returns a variable arrow function's single return expression. */
const singleVariableReturnExpression = (node: ts.VariableStatement): ts.Expression | undefined => {
  const [declaration] = node.declarationList.declarations;
  const initializer = declaration?.initializer;
  if (initializer === undefined || !ts.isArrowFunction(initializer)) {
    return undefined;
  }

  return expressionFromFunctionBody(initializer.body);
};

/** Returns a function declaration's single return expression. */
const singleFunctionReturnExpression = (
  node: ts.FunctionDeclaration,
): ts.Expression | undefined => {
  if (node.body === undefined) {
    return undefined;
  }

  return singleBlockReturnExpression(node.body);
};

/** Normalizes arrow-expression and block-return function bodies. */
const expressionFromFunctionBody = (body: ts.ConciseBody): ts.Expression | undefined => {
  if (!ts.isBlock(body)) {
    return body;
  }

  return singleBlockReturnExpression(body);
};

/** Returns a block body's only returned expression. */
const singleBlockReturnExpression = (body: ts.Block): ts.Expression | undefined => {
  const [statement] = body.statements;
  if (body.statements.length !== 1 || statement === undefined) {
    return undefined;
  }

  return ts.isReturnStatement(statement) ? statement.expression : undefined;
};

/** Checks for `isAstNode(value)` style expression narrower clones. */
const isAstNodeCall = (expression: ts.Expression): boolean => {
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "isAstNode" &&
    expression.arguments.length === 1
  );
};

/** Checks for `isAstNode(value) && value.type === "X"` narrower clones. */
const isAstNodeAndTypeDiscriminantCheck = (expression: ts.Expression): boolean => {
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return false;
  }

  return (
    (isAstNodeCall(expression.left) && isTypeDiscriminantCheck(expression.right)) ||
    (isTypeDiscriminantCheck(expression.left) && isAstNodeCall(expression.right))
  );
};

/** Checks for `candidate.type === "NodeType"` discriminant comparisons. */
const isTypeDiscriminantCheck = (expression: ts.Expression): boolean => {
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken
  ) {
    return false;
  }

  return (
    (isTypePropertyAccess(expression.left) && ts.isStringLiteral(expression.right)) ||
    (ts.isStringLiteral(expression.left) && isTypePropertyAccess(expression.right))
  );
};

/** Checks for access to an SWC node `type` discriminant. */
const isTypePropertyAccess = (expression: ts.Expression): boolean => {
  return ts.isPropertyAccessExpression(expression) && expression.name.text === "type";
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

describe("diagnostic architecture", () => {
  it("pins module inventories and parseable sources", () => {
    expect(sourceModuleFiles("src/diagnostics")).toEqual(EXPECTED_DIAGNOSTIC_MODULE_FILES);
    expect(sourceModuleFiles("src/static-analysis")).toEqual(EXPECTED_STATIC_ANALYSIS_MODULE_FILES);

    for (const sourcePath of EXPECTED_PARSEABLE_SOURCE_FILES) {
      expect(parseSource(sourcePath).fileName).toBe(sourcePath);
    }
    expect(topLevelDeclarationNames(parseSource("src/index.ts"))).toEqual([]);
  });

  it("keeps SWC node-shape helpers and traversal drivers behind the shared seam", () => {
    expect(topLevelDeclarationNames(parseSource(SWC_AST_SEAM_SOURCE))).toContain(
      "traverseAstSubtree",
    );

    const violations = sourceModuleFiles(STATIC_ANALYSIS_SOURCE_PATH)
      .map((fileName) => `${STATIC_ANALYSIS_SOURCE_PATH}/${fileName}`)
      .filter((sourcePath) => sourcePath !== SWC_AST_SEAM_SOURCE)
      .flatMap((sourcePath) => {
        return [
          ...privateSwcHelperDeclarations(sourcePath),
          ...privateSwcTraversalDeclarations(sourcePath),
          ...genericSwcTraversalDeclarations(sourcePath),
          ...clonedSwcSingleTypeNarrowerDeclarations(sourcePath),
        ].map((declarationName) => `${sourcePath}:${declarationName}`);
      });

    expect(violations).toEqual([]);
  });

  it("detects cloned single-type SWC narrower shapes", () => {
    const sourceFile = parseFixtureSource(`
      const isExpression = (value: unknown): value is Expression => isAstNode(value);
      const isIdentifier = (value: unknown): value is Identifier => {
        return isAstNode(value) && value.type === "Identifier";
      };
      function isMemberExpression(value: unknown): value is MemberExpression {
        return "MemberExpression" === value.type && isAstNode(value);
      }
      const unrelatedPredicate = (value: unknown): boolean => {
        return Boolean(value);
      };
    `);

    expect(clonedSwcSingleTypeNarrowerDeclarationsFromSourceFile(sourceFile)).toEqual([
      "isExpression",
      "isIdentifier",
      "isMemberExpression",
    ]);
  });

  it("computes deterministic-time scope-owned facts once per scanner node", () => {
    const declaration = topLevelDeclarationByName(
      parseSource(`${STATIC_ANALYSIS_SOURCE_PATH}/workflow-deterministic-time.ts`),
      "enterDeterministicTimeScope",
    );
    if (declaration === undefined) {
      throw new Error("Expected enterDeterministicTimeScope declaration.");
    }

    const calls = callCountsByName(declaration);

    expect(calls.get("scopeOwnFacts")).toBe(1);
    expect(functionLikeScopeTypes).toEqual([...PARAMETER_BINDING_SCOPE_TYPES]);
    for (const nodeType of functionLikeScopeTypes) {
      expect(flatCollectorTypes.has(nodeType)).toBeTrue();
    }
  });
});
