/**
 * @file Static-analysis package boundary tests.
 */

import { describe, expect, it } from "bun:test";
import type { StaticAnalysisComponent, StaticAnalysisStage, WorkflowSource } from "odw-lint";
import {
  STATIC_ANALYSIS_BOUNDARY,
  STATIC_ANALYSIS_COMPONENTS,
  STATIC_ANALYSIS_STAGES,
} from "odw-lint";

describe("static-analysis boundary exports", () => {
  it("exposes the owned static-analysis boundary identifier", () => {
    expect(STATIC_ANALYSIS_BOUNDARY).toBe("odw-lint/static-analysis");
  });

  it("exposes the design component labels as runtime values", () => {
    expect(STATIC_ANALYSIS_COMPONENTS).toEqual([
      "source-reader",
      "envelope-scanner",
      "static-meta-parser",
      "body-normalizer",
      "swc-parser-adapter",
      "span-mapper",
      "rule-engine",
      "reporter",
    ]);

    const representativeComponent = "swc-parser-adapter" satisfies StaticAnalysisComponent;
    expect(STATIC_ANALYSIS_COMPONENTS).toContain(representativeComponent);
  });

  it("exposes the analysis stage labels as runtime values", () => {
    expect(STATIC_ANALYSIS_STAGES).toEqual([
      "source",
      "envelope",
      "metadata",
      "body",
      "ast",
      "diagnostic",
    ]);

    const representativeStage = "diagnostic" satisfies StaticAnalysisStage;
    expect(STATIC_ANALYSIS_STAGES).toContain(representativeStage);
  });

  it("supports a workflow source fixture at the boundary", () => {
    const fixture = {
      filePath: "workflows/example.js",
      sourceText: 'export const meta = { name: "example" };',
    } satisfies WorkflowSource;

    expect(fixture).toEqual({
      filePath: "workflows/example.js",
      sourceText: 'export const meta = { name: "example" };',
    });
  });
});
