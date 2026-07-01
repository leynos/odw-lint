/**
 * @file Diagnostic import policy tests.
 *
 * These tests keep executable ODW imports out of production code while
 * preserving the TypeScript syntax cases the architecture scanner must read.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importArchitectureFactsFromSource, isForbiddenOdwImport } from "./import-architecture";

type SourceText = { readonly filePath: string; readonly sourceText: string };

type ForbiddenImportViolation = {
  readonly kind: "forbidden-import";
  readonly filePath: string;
  readonly moduleSpecifier: string;
};

type ComputedDynamicImportViolation = {
  readonly kind: "computed-dynamic-import";
  readonly filePath: string;
  readonly expressionText: string;
};

type ComputedCommonJsRequireViolation = {
  readonly kind: "computed-commonjs-require";
  readonly filePath: string;
  readonly expressionText: string;
};

type ImportViolation =
  | ForbiddenImportViolation
  | ComputedDynamicImportViolation
  | ComputedCommonJsRequireViolation;

const productionTypeScriptExtensions = [".ts", ".tsx", ".mts", ".cts"] as const;
const declarationTypeScriptExtensions = [".d.ts", ".d.mts", ".d.cts"] as const;
const repositoryRootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Lists sorted production TypeScript source paths. */
const productionTypeScriptFiles = (directory: string): readonly string[] => {
  if (!existsSync(directory)) {
    throw new Error(`Expected production source directory to exist: ${directory}`);
  }

  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        return productionTypeScriptFiles(filePath);
      }
      if (!entry.isFile()) {
        return [];
      }
      if (declarationTypeScriptExtensions.some((extension) => filePath.endsWith(extension))) {
        return [];
      }
      return productionTypeScriptExtensions.some((extension) => filePath.endsWith(extension))
        ? [relative(repositoryRootPath, filePath)]
        : [];
    })
    .sort();
};

/** Builds sorted production import architecture violations. */
const importViolationsForSources = (sources: readonly SourceText[]): readonly ImportViolation[] => {
  return sources
    .flatMap(({ filePath, sourceText }) => {
      const facts = importArchitectureFactsFromSource(filePath, sourceText);
      return [
        ...facts.importLikeEdges
          .filter((edge) => !edge.isTypeOnly)
          .filter((edge) => isForbiddenOdwImport(edge.moduleSpecifier))
          .map((edge) => ({
            kind: "forbidden-import" as const,
            filePath: edge.filePath,
            moduleSpecifier: edge.moduleSpecifier,
          })),
        ...facts.computedDynamicImports.map((edge) => ({
          kind: "computed-dynamic-import" as const,
          ...edge,
        })),
        ...facts.computedCommonJsRequires.map((edge) => ({
          kind: "computed-commonjs-require" as const,
          ...edge,
        })),
      ];
    })
    .sort(
      (left, right) =>
        left.filePath.localeCompare(right.filePath) || left.kind.localeCompare(right.kind),
    );
};

describe("diagnostic import policy", () => {
  it("extracts string import-like edges from TypeScript syntax", () => {
    const facts = importArchitectureFactsFromSource(
      "virtual.ts",
      `
        import value from "static-import";
        import type { TypeOnly } from "type-import";
        export { value } from "re-export";
        export type { TypeOnly } from "type-export";
        import alias = require("import-equals");
        type Loader = import("odw/src/loader").WorkflowMeta;
        type Entry = typeof import("odw/src/index");
        await import("dynamic-import");
        require("commonjs-require");
      `,
    );

    expect(facts.importLikeEdges).toEqual([
      { filePath: "virtual.ts", isTypeOnly: false, moduleSpecifier: "commonjs-require" },
      { filePath: "virtual.ts", isTypeOnly: false, moduleSpecifier: "dynamic-import" },
      { filePath: "virtual.ts", isTypeOnly: false, moduleSpecifier: "import-equals" },
      { filePath: "virtual.ts", isTypeOnly: true, moduleSpecifier: "odw/src/index" },
      { filePath: "virtual.ts", isTypeOnly: true, moduleSpecifier: "odw/src/loader" },
      { filePath: "virtual.ts", isTypeOnly: false, moduleSpecifier: "re-export" },
      { filePath: "virtual.ts", isTypeOnly: false, moduleSpecifier: "static-import" },
      { filePath: "virtual.ts", isTypeOnly: true, moduleSpecifier: "type-export" },
      { filePath: "virtual.ts", isTypeOnly: true, moduleSpecifier: "type-import" },
    ]);
    expect(facts.computedDynamicImports).toEqual([]);
    expect(facts.computedCommonJsRequires).toEqual([]);
  });

  it("ignores non-import type nodes when extracting import-like edges", () => {
    const facts = importArchitectureFactsFromSource(
      "virtual.ts",
      `
        type Local = Readonly<string>;
        type Literal = "odw/src/loader";
        interface WorkflowMeta { readonly name: string; }
      `,
    );

    expect(facts.importLikeEdges).toEqual([]);
  });

  it("does not treat type-only ODW references as executable policy violations", () => {
    expect(
      importViolationsForSources([
        { filePath: "src/type-import.ts", sourceText: 'import type { WorkflowMeta } from "odw";' },
        {
          filePath: "src/type-query.ts",
          sourceText: 'type Loader = import("odw/src/loader").WorkflowMeta;',
        },
      ]),
    ).toEqual([]);
  });

  it("parses TSX sources with the same import-edge contract", () => {
    const facts = importArchitectureFactsFromSource(
      "virtual.tsx",
      `
        import { Widget } from "./widget";
        const view = <Widget />;
      `,
    );

    expect(facts.importLikeEdges).toEqual([
      {
        filePath: "virtual.tsx",
        isTypeOnly: false,
        moduleSpecifier: "./widget",
      },
    ]);
  });

  it("reports computed dynamic imports and CommonJS requires without string edges", () => {
    const facts = importArchitectureFactsFromSource(
      "virtual.ts",
      `
        const specifier = "odw/src/runtime/worker";
        await import(specifier);
        await import(foo());
        await import();
        require(specifier);
        require(foo());
        require();
      `,
    );

    expect(facts.importLikeEdges).toEqual([]);
    expect(facts.computedDynamicImports.map((edge) => edge.expressionText)).toEqual([
      "<missing>",
      "foo()",
      "specifier",
    ]);
    expect(facts.computedCommonJsRequires.map((edge) => edge.expressionText)).toEqual([
      "<missing>",
      "foo()",
      "specifier",
    ]);
  });

  it("classifies forbidden ODW imports without blocking lookalikes", () => {
    const cases = [
      ..."odw odw/src/index odw/dist/index.js odw/src/loader.ts odw/src/loader.mts odw/src/loader.cts odw/dist/loader odw/src/primitives odw/dist/primitives.js odw/src/runtime odw/dist/runtime odw/src/runtime/launcher.ts odw/dist/runtime/launcher.js odw/src/runtime/worker odw/src/runtime/worker.mts odw/src/runtime/worker.cts odw/dist/runtime/worker.js ../open-dynamic-workflows/src/index ../open-dynamic-workflows/dist/index.js C:\\work\\open-dynamic-workflows\\src\\runtime\\worker.ts"
        .split(" ")
        .map((moduleSpecifier) => [moduleSpecifier, true] as const),
      ..."odw-lint @scope/odw @scope/odw-tools ./odw-local ../open-dynamic-workflows-not/src/loader ../open-dynamic-workflows/docs/runtime"
        .split(" ")
        .map((moduleSpecifier) => [moduleSpecifier, false] as const),
    ];

    for (const [moduleSpecifier, expected] of cases) {
      expect(isForbiddenOdwImport(moduleSpecifier), moduleSpecifier).toBe(expected);
    }
  });

  it("reports production import architecture violations from source facts", () => {
    expect(
      importViolationsForSources([
        { filePath: "src/a.ts", sourceText: 'import "odw/src/runtime/worker";' },
        { filePath: "src/b.ts", sourceText: 'import { start } from "odw/src/loader";' },
        { filePath: "src/c.ts", sourceText: 'const specifier = "odw"; await import(specifier);' },
        { filePath: "src/d.ts", sourceText: 'const specifier = "odw"; require(specifier);' },
      ]),
    ).toEqual([
      { kind: "forbidden-import", filePath: "src/a.ts", moduleSpecifier: "odw/src/runtime/worker" },
      { kind: "forbidden-import", filePath: "src/b.ts", moduleSpecifier: "odw/src/loader" },
      { kind: "computed-dynamic-import", filePath: "src/c.ts", expressionText: "specifier" },
      { kind: "computed-commonjs-require", filePath: "src/d.ts", expressionText: "specifier" },
    ]);
  });

  it("keeps production code free of executable ODW imports", () => {
    const sources = productionTypeScriptFiles(resolve(repositoryRootPath, "src")).map(
      (filePath) => ({
        filePath,
        sourceText: readFileSync(resolve(repositoryRootPath, filePath), "utf8"),
      }),
    );

    expect(sources.length).toBeGreaterThan(0);
    expect(importViolationsForSources(sources)).toEqual([]);
  });
});
