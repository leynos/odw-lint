/**
 * @file Diagnostic module inventory tests.
 *
 * Package entry and import-policy contracts live in focused neighbouring
 * suites; this file keeps the diagnostic module inventory and parseability
 * checks together.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/** Checks whether one source file consumes the SWC parser type surface. */
const hasSwcCoreImport = (sourcePath: string): boolean => {
  return readFileSync(sourcePath, "utf8").includes('"@swc/core"');
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
    const violations = sourceModuleFiles(STATIC_ANALYSIS_SOURCE_PATH)
      .map((fileName) => `${STATIC_ANALYSIS_SOURCE_PATH}/${fileName}`)
      .filter((sourcePath) => sourcePath !== SWC_AST_SEAM_SOURCE)
      .filter((sourcePath) => hasSwcCoreImport(sourcePath))
      .flatMap((sourcePath) => {
        return [
          ...privateSwcHelperDeclarations(sourcePath),
          ...privateSwcTraversalDeclarations(sourcePath),
        ].map((declarationName) => `${sourcePath}:${declarationName}`);
      });

    expect(violations).toEqual([]);
  });
});
