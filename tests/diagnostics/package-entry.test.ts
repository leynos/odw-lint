/**
 * @file Package entry shape tests.
 *
 * Public consumer type and value checks live in `public-consumer.test.ts`;
 * this suite only checks the package facade wiring.
 */

import { describe, expect, it } from "bun:test";
import { EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS } from "./architecture-fixtures";
import {
  declaredPackageEntry,
  EXPECTED_PACKAGE_ENTRY,
  packageEntryModuleSpecifiers,
  packageExportTarget,
  packageManifestExportKeys,
  packageRootExportTargetsByCondition,
  parseDeclaredPackageEntrySource,
  readJsonFile,
} from "./package-entry-support";

/** Asserts that the package entry exposes only expected internals. */
const expectPackageEntryShape = (expectedModuleSpecifiers: readonly string[]): void => {
  const packageManifest = readJsonFile("package.json");
  const packageEntrySource = parseDeclaredPackageEntrySource(packageManifest);

  expect(packageManifestExportKeys(packageManifest)).toEqual([".", "./package.json"]);
  const conditionTargets = packageRootExportTargetsByCondition(packageManifest);

  expect(Object.keys(conditionTargets)).toEqual(["types", "bun", "import", "default"]);
  expect(conditionTargets).toEqual({
    types: EXPECTED_PACKAGE_ENTRY,
    bun: EXPECTED_PACKAGE_ENTRY,
    import: EXPECTED_PACKAGE_ENTRY,
    default: EXPECTED_PACKAGE_ENTRY,
  });
  expect(declaredPackageEntry(packageManifest)).toBe(EXPECTED_PACKAGE_ENTRY);
  expect(packageExportTarget(packageManifest, "./package.json")).toBe("./package.json");
  expect(packageEntryModuleSpecifiers(packageEntrySource)).toEqual(expectedModuleSpecifiers);
};

describe("package entry shape", () => {
  it("pins the final package entry shape", () => {
    expectPackageEntryShape(EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS);
  });
});
