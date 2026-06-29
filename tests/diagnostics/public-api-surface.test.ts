/**
 * @file Public package export-surface tests.
 *
 * These tests protect the reviewed package entry facade so accidental public
 * API removals or facade-style changes fail in the default repository gate.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const EXPECTED_PACKAGE_ENTRY = "./src/index.ts";

const EXPECTED_PUBLIC_PACKAGE_EXPORTS = [
  "DIAGNOSTIC_REPORT_SCHEMA",
  "DIAGNOSTIC_SCHEMA_VERSION",
  "DIAGNOSTIC_SEVERITIES",
  "Diagnostic",
  "DiagnosticReport",
  "DiagnosticSeverity",
  "DiagnosticSuggestion",
  "DiagnosticSummary",
  "InvalidRuleId",
  "InvalidRuleIdError",
  "InvalidRuleIdReason",
  "OriginalSourceFile",
  "RuleId",
  "RuleIdParseResult",
  "STATIC_ANALYSIS_BOUNDARY",
  "STATIC_ANALYSIS_COMPONENTS",
  "STATIC_ANALYSIS_STAGES",
  "SourceLine",
  "SourceOffsetError",
  "SourcePosition",
  "SourceSnippet",
  "SourceSpan",
  "StaticAnalysisComponent",
  "StaticAnalysisStage",
  "TOOL_NAME",
  "ToolInfo",
  "WorkflowSource",
  "countDiagnostics",
  "createDiagnosticReport",
  "createOriginalSourceFile",
  "formatTextDiagnostics",
  "isRuleId",
  "makeRuleId",
  "parseRuleId",
  "positionAtOffset",
  "sliceSourceSpan",
  "snippetForSpan",
  "spanFromOffsets",
] as const;

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
] as const;

/** Reads one repository-relative UTF-8 file. */
const readRepositoryFile = (relativePath: string): string => {
  return readFileSync(relativePath, "utf8");
};

/** Reads JSON as unknown so runtime checks own the package boundary. */
const readJsonFile = (relativePath: string): unknown => {
  return JSON.parse(readRepositoryFile(relativePath)) as unknown;
};

/** Checks whether a value is a non-array object. */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** Asserts that the package manifest root is object-shaped. */
const packageManifestRecord = (manifest: unknown): Record<string, unknown> => {
  if (!isRecord(manifest)) {
    throw new Error("package.json must be an object");
  }

  return manifest;
};

/** Reads one required string field from the package manifest. */
const packageStringField = (manifest: unknown, fieldName: "main" | "types"): string => {
  const value = packageManifestRecord(manifest)[fieldName];

  if (typeof value !== "string") {
    throw new Error(`package.json ${fieldName} must be a string`);
  }

  return value;
};

/** Reads the root conditional export map from the package manifest. */
const packageRootExports = (manifest: unknown): Record<string, unknown> => {
  const { exports: exportsValue } = packageManifestRecord(manifest);

  if (!isRecord(exportsValue) || !isRecord(exportsValue["."])) {
    throw new Error('package.json exports["."] must be a flat object');
  }

  return exportsValue["."];
};

/** Lists every root export condition target declared by the manifest. */
const rootExportConditionTargets = (manifest: unknown): readonly string[] => {
  const rootExports = packageRootExports(manifest);

  return Object.entries(rootExports).map(([condition, target]) => {
    if (typeof target !== "string") {
      throw new Error(`package.json exports["."].${condition} must be a string target`);
    }

    return target;
  });
};

/** Normalizes package entry targets to one repository-relative spelling. */
const normalizePackageTarget = (target: string): string => {
  const withoutDotPrefix = target.startsWith("./") ? target.slice(2) : target;

  return `./${path.posix.normalize(withoutDotPrefix)}`;
};

/** Derives every declared root package entry target from package.json. */
const packageEntryTargets = (manifest: unknown): readonly string[] => {
  return [
    packageStringField(manifest, "main"),
    packageStringField(manifest, "types"),
    ...rootExportConditionTargets(manifest),
  ];
};

/** Resolves and validates the single declared root package entry file. */
const declaredPackageEntry = (manifest: unknown): string => {
  const targets = packageEntryTargets(manifest).map(normalizePackageTarget);
  const uniqueTargets = [...new Set(targets)].sort();

  if (uniqueTargets.length !== 1) {
    throw new Error(
      `declared package entry targets must resolve to one file: ${uniqueTargets.join(", ")}`,
    );
  }

  return uniqueTargets[0] ?? "";
};

/** Parses inline TypeScript source for package-facade shape checks. */
const parseInlineSource = (sourceText: string): ts.SourceFile => {
  return ts.createSourceFile(
    "inline-package-entry.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
};

/** Parses one repository-relative TypeScript source file. */
const parseRepositorySource = (relativePath: string): ts.SourceFile => {
  return ts.createSourceFile(
    relativePath,
    readRepositoryFile(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
};

/** Extracts a string-literal module specifier from an export declaration. */
const exportModuleSpecifierText = (exportDeclaration: ts.ExportDeclaration): string => {
  const moduleSpecifier = exportDeclaration.moduleSpecifier;

  if (moduleSpecifier === undefined) {
    throw new Error("named re-exports must include a module specifier");
  }

  if (!ts.isStringLiteral(moduleSpecifier)) {
    throw new Error("named re-export module specifiers must be string literals");
  }

  return moduleSpecifier.text;
};

/** Checks whether a top-level statement has an export or default modifier. */
const hasFacadeExportModifier = (statement: ts.Statement): boolean => {
  if (!ts.canHaveModifiers(statement)) {
    return false;
  }

  const modifiers = ts.getModifiers(statement) ?? [];

  return modifiers.some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword ||
      modifier.kind === ts.SyntaxKind.DefaultKeyword,
  );
};

/** Extracts names from a supported explicit named re-export declaration. */
const exportNamesFromDeclaration = (exportDeclaration: ts.ExportDeclaration): readonly string[] => {
  exportModuleSpecifierText(exportDeclaration);

  const exportClause = exportDeclaration.exportClause;

  if (exportClause === undefined) {
    throw new Error("unsupported wildcard export");
  }

  if (!ts.isNamedExports(exportClause)) {
    throw new Error("unsupported namespace export");
  }

  return exportClause.elements.map((exportSpecifier) => exportSpecifier.name.text);
};

/** Extracts named public exports from a package entry facade source file. */
const namedPackageExports = (sourceFile: ts.SourceFile): readonly string[] => {
  const exportNames: string[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      exportNames.push(...exportNamesFromDeclaration(statement));
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      throw new Error("unsupported export assignment");
    }

    if (hasFacadeExportModifier(statement)) {
      throw new Error("direct exported declarations are not allowed");
    }

    throw new Error(`unsupported top-level statement ${ts.SyntaxKind[statement.kind]}`);
  }

  return exportNames.sort();
};

describe("public package export-surface extractor", () => {
  for (const exportCase of SUPPORTED_EXPORT_CASES) {
    it(exportCase.description, () => {
      expect(namedPackageExports(parseInlineSource(exportCase.sourceText))).toEqual(
        exportCase.expectedExports,
      );
    });
  }

  for (const exportCase of UNSUPPORTED_EXPORT_CASES) {
    it(exportCase.description, () => {
      expect(() => namedPackageExports(parseInlineSource(exportCase.sourceText))).toThrow(
        exportCase.expectedMessage,
      );
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
    const packageEntry = declaredPackageEntry(readJsonFile("package.json"));
    expect(packageEntry).toBe(EXPECTED_PACKAGE_ENTRY);

    expect(namedPackageExports(parseRepositorySource(packageEntry))).toEqual([
      ...EXPECTED_PUBLIC_PACKAGE_EXPORTS,
    ]);
  });
});
