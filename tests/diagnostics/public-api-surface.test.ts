/**
 * @file Public package export-surface tests.
 *
 * These tests protect the reviewed package entry facade so accidental public
 * API removals or facade-style changes fail in the default repository gate.
 */

import { describe, expect, it } from "bun:test";
import {
  declaredPackageEntry,
  EXPECTED_PACKAGE_ENTRY,
  namedPackageExports,
  parseDeclaredPackageEntrySource,
  parseInlinePackageEntrySource,
  readJsonFile,
} from "./package-entry-support";
import { EXPECTED_PUBLIC_PACKAGE_EXPORTS } from "./public-api-fixtures";

const SUPPORTED_EXPORT_CASES = [
  {
    description: "records named value re-exports",
    sourceText: 'export { x } from "./x";',
    expectedExports: ["x"],
  },
  {
    description: "records named type re-exports",
    sourceText: 'export { type X } from "./x";',
    expectedExports: ["X"],
  },
  {
    description: "records the public alias from aliased re-exports",
    sourceText: 'export { x as y } from "./x";',
    expectedExports: ["y"],
  },
] as const;

const UNSUPPORTED_EXPORT_CASES = [
  {
    description: "rejects wildcard exports",
    sourceText: 'export * from "./x";',
    expectedMessage: "unsupported wildcard export",
  },
  {
    description: "rejects namespace exports",
    sourceText: 'export * as ns from "./x";',
    expectedMessage: "unsupported namespace export",
  },
  {
    description: "rejects default class exports",
    sourceText: "export default class {}",
    expectedMessage: "direct exported declarations are not allowed",
  },
  {
    description: "rejects default function exports",
    sourceText: "export default function f() {}",
    expectedMessage: "direct exported declarations are not allowed",
  },
  {
    description: "rejects default expression exports",
    sourceText: "export default 1;",
    expectedMessage: "unsupported export assignment",
  },
  {
    description: "rejects direct exported values",
    sourceText: "export const x = 1;",
    expectedMessage: "direct exported declarations are not allowed",
  },
] as const;

const ROOT_EXPORTS = {
  types: EXPECTED_PACKAGE_ENTRY,
  bun: EXPECTED_PACKAGE_ENTRY,
  import: EXPECTED_PACKAGE_ENTRY,
  default: EXPECTED_PACKAGE_ENTRY,
} as const;

const VALID_PACKAGE_MANIFEST = {
  main: EXPECTED_PACKAGE_ENTRY,
  types: EXPECTED_PACKAGE_ENTRY,
  exports: {
    ".": ROOT_EXPORTS,
    "./package.json": "./package.json",
  },
} as const;

/** Builds a manifest fixture with one overridden root export condition. */
const manifestWithRootCondition = (condition: string, target: unknown): unknown => {
  return {
    ...VALID_PACKAGE_MANIFEST,
    exports: { ...VALID_PACKAGE_MANIFEST.exports, ".": { ...ROOT_EXPORTS, [condition]: target } },
  };
};

const MANIFEST_FAILURE_CASES = [
  {
    description: "requires string main",
    manifest: { ...VALID_PACKAGE_MANIFEST, main: undefined },
    expectedMessage: "package.json main must be a string",
  },
  {
    description: "requires string types",
    manifest: { ...VALID_PACKAGE_MANIFEST, types: 42 },
    expectedMessage: "package.json types must be a string",
  },
  {
    description: "requires root exports",
    manifest: { ...VALID_PACKAGE_MANIFEST, exports: { "./package.json": "./package.json" } },
    expectedMessage: 'package.json exports["."] must be a flat object',
  },
  {
    description: "requires a flat root exports object",
    manifest: { ...VALID_PACKAGE_MANIFEST, exports: { ".": "./src/index.ts" } },
    expectedMessage: 'package.json exports["."] must be a flat object',
  },
  {
    description: "rejects non-string root condition targets",
    manifest: manifestWithRootCondition("bun", 7),
    expectedMessage: 'package.json exports["."].bun must be a string target',
  },
  {
    description: "rejects nested root condition targets",
    manifest: manifestWithRootCondition("import", { default: "./src/index.ts" }),
    expectedMessage: 'package.json exports["."].import must be a string target',
  },
  {
    description: "rejects divergent package entry targets",
    manifest: manifestWithRootCondition("default", "./src/other.ts"),
    expectedMessage: "declared package entry targets must resolve to one file",
  },
  {
    description: "rejects package entry targets outside the repository root",
    manifest: manifestWithRootCondition("default", "../src/index.ts"),
    expectedMessage: "package entry targets must stay inside the repository root",
  },
  {
    description: "rejects absolute package entry targets",
    manifest: manifestWithRootCondition("default", "/src/index.ts"),
    expectedMessage: "package entry targets must stay inside the repository root",
  },
] as const;

describe("public package export-surface extractor", () => {
  for (const exportCase of SUPPORTED_EXPORT_CASES) {
    it(exportCase.description, () => {
      expect(namedPackageExports(parseInlinePackageEntrySource(exportCase.sourceText))).toEqual(
        exportCase.expectedExports,
      );
    });
  }

  for (const exportCase of UNSUPPORTED_EXPORT_CASES) {
    it(exportCase.description, () => {
      expect(() =>
        namedPackageExports(parseInlinePackageEntrySource(exportCase.sourceText)),
      ).toThrow(exportCase.expectedMessage);
    });
  }
});

describe("public package export-surface manifest guard", () => {
  it("derives the current package entry from every root target", () => {
    expect(declaredPackageEntry(VALID_PACKAGE_MANIFEST)).toBe(EXPECTED_PACKAGE_ENTRY);
  });

  for (const failureCase of MANIFEST_FAILURE_CASES) {
    it(failureCase.description, () => {
      expect(() => declaredPackageEntry(failureCase.manifest)).toThrow(failureCase.expectedMessage);
    });
  }
});

describe("public package export-surface guard", () => {
  it("matches the reviewed named export list", () => {
    const packageManifest = readJsonFile("package.json");
    expect(declaredPackageEntry(packageManifest)).toBe(EXPECTED_PACKAGE_ENTRY);

    expect(namedPackageExports(parseDeclaredPackageEntrySource(packageManifest))).toEqual([
      ...EXPECTED_PUBLIC_PACKAGE_EXPORTS,
    ]);
  });
});
