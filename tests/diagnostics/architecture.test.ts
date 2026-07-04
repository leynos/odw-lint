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
// Scope views consume astChildValues while owning scope-bounded recursion.

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
        ].map((declarationName) => `${sourcePath}:${declarationName}`);
      });

    expect(violations).toEqual([]);
  });
});
