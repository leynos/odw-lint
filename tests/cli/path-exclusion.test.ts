/**
 * @file Path exclusion helper tests for the `check` command.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { isPathExcluded } from "../../src/cli/path-exclusion";

const pathSegment = fc
  .stringMatching(/[a-z][a-z0-9-]{0,8}/)
  .filter((segment) => segment !== "generated");

describe("path exclusion", () => {
  it.each([
    ["generated root", "generated/workflow.js", ["**/generated/**"], true],
    ["generated nested", "src/generated/workflow.js", ["**/generated/**"], true],
    ["non-matching sibling", "src/manual/workflow.js", ["**/generated/**"], false],
    ["basename glob does not cross directories", "src/workflow.js", ["*.js"], false],
  ] as const)("matches %s", (_caseName, path, excludeGlobs, expected) => {
    expect(isPathExcluded(path, excludeGlobs)).toBe(expected);
  });

  it("excludes generated paths and keeps other generated-free paths", () => {
    fc.assert(
      fc.property(pathSegment, pathSegment, (firstSegment, secondSegment) => {
        const excludedPath = `${firstSegment}/generated/${secondSegment}.js`;
        const includedPath = `${firstSegment}/${secondSegment}/workflow.js`;

        expect(isPathExcluded(excludedPath, ["**/generated/**"])).toBe(true);
        expect(isPathExcluded(includedPath, ["**/generated/**"])).toBe(false);
      }),
    );
  });
});
