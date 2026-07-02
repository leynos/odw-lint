/**
 * @file Diagnostic module inventory tests.
 *
 * Package entry and import-policy contracts live in focused neighbouring
 * suites; this file keeps the diagnostic module inventory and parseability
 * checks together.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import {
  EXPECTED_DIAGNOSTIC_MODULE_FILES,
  EXPECTED_PARSEABLE_SOURCE_FILES,
  EXPECTED_STATIC_ANALYSIS_MODULE_FILES,
} from "./architecture-fixtures";
import { parseSource, topLevelDeclarationNames } from "./import-architecture";

/** Lists current direct TypeScript source modules below one source directory. */
const sourceModuleFiles = (sourcePath: string): readonly string[] => {
  if (!existsSync(sourcePath)) {
    return [];
  }

  return readdirSync(sourcePath)
    .filter((fileName) => fileName.endsWith(".ts"))
    .sort();
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
});
