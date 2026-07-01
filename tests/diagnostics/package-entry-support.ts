/**
 * @file Shared test support for package-entry architecture checks.
 *
 * These helpers keep manifest validation and facade parsing in one place so
 * public API and architecture tests fail with the same package-boundary
 * messages.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Repository-relative package entry expected by the current package shape. */
export const EXPECTED_PACKAGE_ENTRY = "./src/index.ts";

const REPOSITORY_ROOT = new URL("../../", import.meta.url);

type PackageEntryExport = {
  readonly moduleSpecifier: string;
  readonly names: readonly string[];
};

/**
 * Reads one repository-relative UTF-8 file.
 *
 * @param relativePath - Repository-relative path to read.
 * @returns File contents decoded as UTF-8.
 */
export const readRepositoryFile = (relativePath: string): string => {
  return readFileSync(new URL(relativePath, REPOSITORY_ROOT), "utf8");
};

/**
 * Reads JSON as unknown so runtime checks own the package boundary.
 *
 * @param relativePath - Repository-relative JSON file path.
 * @returns Parsed JSON value.
 */
export const readJsonFile = (relativePath: string): unknown => {
  return JSON.parse(readRepositoryFile(relativePath)) as unknown;
};

/**
 * Parses inline TypeScript source for package-facade shape checks.
 *
 * @param sourceText - Inline TypeScript source text.
 * @returns Parsed TypeScript source file.
 */
export const parseInlinePackageEntrySource = (sourceText: string): ts.SourceFile => {
  return ts.createSourceFile(
    "inline-package-entry.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
};

/**
 * Parses one repository-relative TypeScript source file.
 *
 * @param relativePath - Repository-relative TypeScript file path.
 * @returns Parsed TypeScript source file.
 */
export const parseRepositorySource = (relativePath: string): ts.SourceFile => {
  return ts.createSourceFile(
    relativePath,
    readRepositoryFile(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
};

/**
 * Derives every declared root package entry target from package.json.
 *
 * @param manifest - Parsed package manifest value.
 * @returns Root package entry targets from `main`, `types`, and conditions.
 */
export const packageEntryTargets = (manifest: unknown): readonly string[] => {
  return [
    packageStringField(manifest, "main"),
    packageStringField(manifest, "types"),
    ...Object.values(packageRootExportTargetsByCondition(manifest)),
  ];
};

/**
 * Lists the manifest's top-level package export keys.
 *
 * @param manifest - Parsed package manifest value.
 * @returns Sorted package export keys.
 */
export const packageManifestExportKeys = (manifest: unknown): readonly string[] => {
  return Object.keys(packageExportsRecord(manifest)).sort();
};

/**
 * Reads one validated package export target by subpath.
 *
 * @param manifest - Parsed package manifest value.
 * @param exportKey - Package export key to read.
 * @returns String target for the requested export key.
 * @throws Error when the requested export target is not a string.
 */
export const packageExportTarget = (manifest: unknown, exportKey: string): string => {
  const target = packageExportsRecord(manifest)[exportKey];

  if (typeof target !== "string") {
    throw new Error(`package.json exports["${exportKey}"] must be a string target`);
  }

  return target;
};

/**
 * Reads validated root export targets keyed by package condition.
 *
 * @param manifest - Parsed package manifest value.
 * @returns Root export condition targets keyed by condition name.
 */
export const packageRootExportTargetsByCondition = (
  manifest: unknown,
): Readonly<Record<string, string>> => {
  const rootExports = packageRootExports(manifest);

  return Object.fromEntries(
    Object.entries(rootExports).map(([condition, target]) => {
      if (typeof target !== "string") {
        throw new Error(`package.json exports["."].${condition} must be a string target`);
      }

      return [condition, target];
    }),
  );
};

/**
 * Resolves and validates the single declared root package entry file.
 *
 * @param manifest - Parsed package manifest value.
 * @returns Repository-relative package entry path.
 * @throws Error when root targets are missing, invalid, or divergent.
 */
export const declaredPackageEntry = (manifest: unknown): string => {
  const targets = packageEntryTargets(manifest).map(normalizePackageTarget);
  const uniqueTargets = [...new Set(targets)].sort();

  if (uniqueTargets.length !== 1) {
    throw new Error(
      `declared package entry targets must resolve to one file: ${uniqueTargets.join(", ")}`,
    );
  }

  return uniqueTargets[0] ?? "";
};

/**
 * Parses the package entry declared by a validated package manifest.
 *
 * @param manifest - Parsed package manifest value.
 * @returns Parsed package entry source file.
 */
export const parseDeclaredPackageEntrySource = (manifest: unknown): ts.SourceFile => {
  return parseRepositorySource(declaredPackageEntry(manifest));
};

/**
 * Extracts named public exports from a package entry facade source file.
 *
 * @param sourceFile - Parsed package entry source file.
 * @returns Sorted public export names.
 */
export const namedPackageExports = (sourceFile: ts.SourceFile): readonly string[] => {
  return packageEntryExports(sourceFile)
    .flatMap((exportDeclaration) => exportDeclaration.names)
    .sort();
};

/**
 * Lists module specifiers from supported package entry re-exports.
 *
 * @param sourceFile - Parsed package entry source file.
 * @returns Re-export module specifiers in source order.
 */
export const packageEntryModuleSpecifiers = (sourceFile: ts.SourceFile): readonly string[] => {
  return packageEntryExports(sourceFile).map(
    (exportDeclaration) => exportDeclaration.moduleSpecifier,
  );
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
  const exportsValue = packageExportsRecord(manifest);

  if (!isRecord(exportsValue["."])) {
    throw new Error('package.json exports["."] must be a flat object');
  }

  return exportsValue["."];
};

/** Reads the package exports object from the package manifest. */
const packageExportsRecord = (manifest: unknown): Record<string, unknown> => {
  const { exports: exportsValue } = packageManifestRecord(manifest);

  if (!isRecord(exportsValue)) {
    throw new Error("package.json exports must be an object");
  }

  return exportsValue;
};

/** Normalizes package entry targets to one repository-relative spelling. */
const normalizePackageTarget = (target: string): string => {
  const withoutDotPrefix = target.startsWith("./") ? target.slice(2) : target;
  const normalizedTarget = path.posix.normalize(withoutDotPrefix);

  if (isOutsideRepositoryRoot(normalizedTarget)) {
    throw new Error("package entry targets must stay inside the repository root");
  }

  return `./${normalizedTarget}`;
};

/** Checks whether a normalized package target escapes the repository root. */
const isOutsideRepositoryRoot = (target: string): boolean => {
  if (path.posix.isAbsolute(target)) {
    return true;
  }

  return target === ".." || target.startsWith("../");
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
  const exportClause = exportDeclaration.exportClause;

  if (exportClause === undefined) {
    throw new Error("unsupported wildcard export");
  }

  if (!ts.isNamedExports(exportClause)) {
    throw new Error("unsupported namespace export");
  }

  return exportClause.elements.map((exportSpecifier) => exportSpecifier.name.text);
};

/** Extracts supported re-export facts from a package entry facade source file. */
const packageEntryExports = (sourceFile: ts.SourceFile): readonly PackageEntryExport[] => {
  const exports: PackageEntryExport[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      exports.push({
        moduleSpecifier: exportModuleSpecifierText(statement),
        names: exportNamesFromDeclaration(statement),
      });
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

  return exports;
};
