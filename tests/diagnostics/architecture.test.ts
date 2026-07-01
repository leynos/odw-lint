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
} from "./architecture-fixtures";
import { parseSource, topLevelDeclarationNames } from "./import-architecture";

/** Lists current internal diagnostic source modules. */
const diagnosticModuleFiles = (): readonly string[] => {
  const diagnosticsPath = "src/diagnostics";

  if (!existsSync(diagnosticsPath)) {
    return [];
  }

  return readdirSync(diagnosticsPath)
    .filter((fileName) => fileName.endsWith(".ts"))
    .sort();
};

describe("diagnostic architecture", () => {
  it("pins diagnostic module inventory and parseable sources", () => {
    expect(diagnosticModuleFiles()).toEqual(EXPECTED_DIAGNOSTIC_MODULE_FILES);

    for (const sourcePath of EXPECTED_PARSEABLE_SOURCE_FILES) {
      expect(parseSource(sourcePath).fileName).toBe(sourcePath);
    }
    expect(topLevelDeclarationNames(parseSource("src/index.ts"))).toEqual([]);
  });
});
