/**
 * @file Static-analysis package boundary tests.
 */

import { describe, expect, it } from "bun:test";
import type {
  OriginalSourceFile,
  SourceLine,
  SourceSnippet,
  StaticAnalysisComponent,
  StaticAnalysisStage,
  WorkflowSource,
} from "odw-lint";
import {
  createOriginalSourceFile,
  positionAtOffset,
  SourceOffsetError,
  STATIC_ANALYSIS_BOUNDARY,
  STATIC_ANALYSIS_COMPONENTS,
  STATIC_ANALYSIS_STAGES,
  sliceSourceSpan,
  snippetForSpan,
  spanFromOffsets,
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

  it("exposes original source-file records at the package boundary", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/example.js",
      sourceText: "meta\nbody",
    });
    const firstLine = sourceFile.lines[0] satisfies SourceLine | undefined;

    expect(sourceFile).toMatchObject({
      filePath: "workflows/example.js",
      sourceText: "meta\nbody",
      byteLength: 9,
      lines: [
        {
          line: 1,
          startOffset: 0,
          contentEndOffset: 4,
          terminatorEndOffset: 5,
          text: "meta",
        },
        {
          line: 2,
          startOffset: 5,
          contentEndOffset: 9,
          terminatorEndOffset: 9,
          text: "body",
        },
      ],
    } satisfies Pick<OriginalSourceFile, "filePath" | "sourceText" | "byteLength" | "lines">);
    expect(firstLine?.text).toBe("meta");
    expect(positionAtOffset(sourceFile, 5)).toEqual({ offset: 5, line: 2, column: 1 });
    const span = spanFromOffsets(sourceFile, 0, 4);
    expect(sliceSourceSpan(sourceFile, span)).toBe("meta");
    expect(snippetForSpan(sourceFile, span).lineText).toBe("meta");

    const snippet = {
      text: "",
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 0, line: 1, column: 1 },
      lineText: "",
    } satisfies SourceSnippet;
    expect(snippet.text).toBe("");
    expect(SourceOffsetError).toBeFunction();
  });
});
