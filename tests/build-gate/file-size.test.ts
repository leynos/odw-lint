/**
 * @file Build-gate test for tracked TypeScript source and test file sizes.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  type FileSizeViolation,
  findOversizedSourceAndTestFiles,
  formatFileSizeViolations,
  SOURCE_AND_TEST_LINE_LIMIT,
  trackedSourceAndTestTypeScriptFiles,
} from "./file-size-support";

test("source and test file-size guard keeps tracked TypeScript files under 400 lines", () => {
  const trackedTypeScriptFiles = trackedSourceAndTestTypeScriptFiles();

  expect(trackedTypeScriptFiles.length).toBeGreaterThan(0);

  const violations = findOversizedSourceAndTestFiles(
    trackedTypeScriptFiles,
    (path) => readFileSync(path, "utf8"),
    SOURCE_AND_TEST_LINE_LIMIT,
  );
  const sortedViolations = [...violations].sort(
    (left: FileSizeViolation, right: FileSizeViolation) => left.path.localeCompare(right.path),
  );

  if (sortedViolations.length > 0) {
    throw new Error(formatFileSizeViolations(sortedViolations));
  }
});
