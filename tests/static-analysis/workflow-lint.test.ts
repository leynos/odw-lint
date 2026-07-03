/**
 * @file Tests for the merged static workflow lint entry point.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import type { Diagnostic } from "../../src/diagnostics/types";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import { sliceSourceSpan } from "../../src/static-analysis/source-snippet";
import { scanWorkflowEnvelope } from "../../src/static-analysis/workflow-envelope";
import { lintWorkflowSource } from "../../src/static-analysis/workflow-lint";
import { classifyWorkflowMetadata } from "../../src/static-analysis/workflow-metadata";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";

declare global {
  // The hostile source writes this marker only if metadata is evaluated.
  var __odwLintWorkflowLintHostileMetaWasEvaluated: string | undefined;
}

const HOSTILE_MARKER_PROPERTY = "__odwLintWorkflowLintHostileMetaWasEvaluated";
const METADATA_PREFIX_SOURCE = fc.constantFrom(
  "",
  "// leading comment with inert export const meta = {}\n",
  "const setup = 1;\n",
  "/* inert import helper from './helper.js'; */\n",
);
const IMPORT_EXPORT_EDGE_SOURCE = fc.constantFrom(
  "",
  "import helper from './helper.js';\n",
  "export const extra = 1;\n",
  "const dynamicHelper = import('./helper.js');\n",
);
const METADATA_NAME_PROPERTY_SOURCE = fc.constantFrom(
  "name: 'generated'",
  "name: ''",
  "name: 42",
  "description: 'missing name'",
);
const GENERATED_WORKFLOW_SOURCE = fc
  .record({
    prefix: METADATA_PREFIX_SOURCE,
    importExportEdge: IMPORT_EXPORT_EDGE_SOURCE,
    nameProperty: METADATA_NAME_PROPERTY_SOURCE,
  })
  .map(({ prefix, importExportEdge, nameProperty }) =>
    [
      prefix,
      importExportEdge,
      `export const meta = { ${nameProperty}, description: 'ok' };`,
      "return 'done';",
      "",
    ].join("\n"),
  );

/** Returns only stable rule identifiers for compact diagnostic assertions. */
const diagnosticRules = (diagnostics: readonly Diagnostic[]): readonly string[] => {
  return diagnostics.map((diagnostic) => diagnostic.rule);
};

/** Lints source text under the shared test fixture path. */
const lintSource = (sourceText: string) => {
  return lintWorkflowSource({
    filePath: "workflows/example.js",
    sourceText,
  });
};

/** Clears the hostile marker before tests check for evaluation side effects. */
const clearHostileMarker = (): void => {
  Reflect.deleteProperty(globalThis, HOSTILE_MARKER_PROPERTY);
};

describe("lintWorkflowSource", () => {
  it("returns envelope diagnostics before metadata diagnostics", () => {
    const result = lintSource(
      "import helper from './helper.js';\nexport const meta = { name: '', description: 'ok' };\nreturn helper();\n",
    );

    expect(result.diagnostics).toEqual([
      ...result.scan.diagnostics,
      ...result.classification.diagnostics,
      ...result.bodySyntax,
      ...result.claudeCompatibility,
    ]);
    expect(diagnosticRules(result.diagnostics)).toEqual(["odw/no-import-export", "odw/meta-name"]);
  });

  it("reports missing metadata without running metadata classification rules", () => {
    const result = lintSource("const value = 1;\nreturn value;\n");

    expect(result.classification.status).toBe("not-applicable");
    expect(diagnosticRules(result.diagnostics)).toEqual(["odw/meta-required"]);
  });

  it("reports runtime-invalid metadata after envelope diagnostics", () => {
    const result = lintSource(
      "export const meta = { name: '', description: 'ok' };\nreturn 'done';\n",
    );

    expect(result.classification.status).toBe("runtime-invalid");
    expect(diagnosticRules(result.diagnostics)).toEqual(["odw/meta-name"]);
  });

  it("appends deterministic-time warnings after metadata diagnostics", () => {
    const result = lintSource(
      [
        "export const meta = { name: 'example', description: 'ok' };",
        "const timestamp = Date.now();",
        "const sample = Math.random();",
        "const started = new Date();",
      ].join("\n"),
    );

    expect(result.classification.diagnostics).toEqual([]);
    expect(result.bodySyntax).toEqual([]);
    expect(diagnosticRules(result.claudeCompatibility)).toEqual([
      "odw/no-date-now",
      "odw/no-math-random",
      "odw/no-argless-new-date",
    ]);
    expect(diagnosticRules(result.diagnostics)).toEqual(
      diagnosticRules(result.claudeCompatibility),
    );
  });

  it("reports body syntax once and silences deterministic-time warnings", () => {
    const result = lintSource(
      [
        "export const meta = { name: 'example', description: 'ok' };",
        "if (args.ready) {",
        "  Date.now();",
      ].join("\n"),
    );

    expect(diagnosticRules(result.bodySyntax)).toEqual(["odw/body-syntax"]);
    expect(result.claudeCompatibility).toEqual([]);
    expect(diagnosticRules(result.diagnostics)).toEqual(["odw/body-syntax"]);
  });

  it("includes unsupported import or export diagnostics from the envelope scan", () => {
    const result = lintSource(
      "import helper from './helper.js';\nexport const meta = { name: 'example' };\nreturn helper();\n",
    );

    expect(diagnosticRules(result.diagnostics)).toContain("odw/no-import-export");
  });

  it("exposes the built source file for diagnostic span slicing", () => {
    const result = lintSource(
      "export const meta = { name: '', description: 'ok' };\nreturn 'done';\n",
    );
    const firstDiagnostic = result.diagnostics[0];

    expect(firstDiagnostic).toBeDefined();
    if (firstDiagnostic === undefined) {
      throw new Error("expected at least one diagnostic for invalid metadata");
    }
    expect(sliceSourceSpan(result.sourceFile, firstDiagnostic.span)).toBe("''");
  });

  it("freezes the result object and merged diagnostics", () => {
    const result = lintSource("export const meta = { name: 'example' };\nreturn 'done';\n");

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sourceFile)).toBe(true);
    expect(Object.isFrozen(result.scan)).toBe(true);
    expect(Object.isFrozen(result.scan.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.classification)).toBe(true);
    expect(Object.isFrozen(result.classification.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.bodySyntax)).toBe(true);
    expect(Object.isFrozen(result.claudeCompatibility)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
  });

  it("preserves the canonical merge order for generated workflow sources", () => {
    fc.assert(
      fc.property(GENERATED_WORKFLOW_SOURCE, (sourceText) => {
        const source = {
          filePath: "workflows/generated.js",
          sourceText,
        };
        const sourceFile = createOriginalSourceFile(source);
        const scan = scanWorkflowEnvelope(sourceFile);
        const classification = classifyWorkflowMetadata(scan);
        const result = lintWorkflowSource(source);

        expect(result.diagnostics).toEqual([
          ...scan.diagnostics,
          ...classification.diagnostics,
          ...result.bodySyntax,
          ...result.claudeCompatibility,
        ]);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("does not evaluate hostile metadata while linting", () => {
    clearHostileMarker();

    const result = lintSource(
      [
        "export const meta = (() => {",
        `  globalThis.${HOSTILE_MARKER_PROPERTY} = "evaluated";`,
        "  return { name: 'hostile' };",
        "})();",
      ].join("\n"),
    );

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(globalThis[HOSTILE_MARKER_PROPERTY]).toBeUndefined();
  });
});
