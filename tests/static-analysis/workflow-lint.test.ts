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
const GENERATED_WORKFLOW_SOURCE = fc.oneof(
  fc.constant("export const meta = { name: 'generated', description: 'ok' };\nreturn 'done';\n"),
  fc.constant("export const meta = { name: '', description: 'missing name' };\nreturn 'done';\n"),
  fc.constant("export const meta = { description: 'missing name' };\nreturn 'done';\n"),
  fc.constant("export const meta = computedMeta;\nreturn 'done';\n"),
  fc.constant("const value = 1;\nreturn value;\n"),
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

        expect(lintWorkflowSource(source).diagnostics).toEqual([
          ...scan.diagnostics,
          ...classification.diagnostics,
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
