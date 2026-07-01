/**
 * @file Unit tests for source and test file-size guard helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  countPhysicalLines,
  findOversizedSourceAndTestFiles,
  formatFileSizeViolations,
  type GitFileListingResult,
  isSourceOrTestTypeScriptPath,
  parseNulSeparatedPaths,
  trackedSourceAndTestTypeScriptFiles,
} from "./file-size-support";

describe("file-size guard support", () => {
  it.each([
    ["empty text", "", 0],
    ["one unterminated line", "const value = 1;", 1],
    ["one newline-terminated line", "const value = 1;\n", 1],
    ["two lines", "const first = 1;\nconst second = 2;\n", 2],
    ["deliberate blank final line", "const value = 1;\n\n", 2],
  ])("counts physical lines for %s", (_caseName, sourceText, expectedLineCount) => {
    expect(countPhysicalLines(sourceText)).toBe(expectedLineCount);
  });

  it("parses NUL-separated Git path output", () => {
    expect(parseNulSeparatedPaths("src/index.ts\0tests/example.test.ts\0")).toEqual([
      "src/index.ts",
      "tests/example.test.ts",
    ]);
  });

  it("parses NUL-separated Git path output without a trailing separator", () => {
    expect(parseNulSeparatedPaths("src/index.ts\0tests/example.test.ts")).toEqual([
      "src/index.ts",
      "tests/example.test.ts",
    ]);
  });

  it.each([
    ["src/index.ts", true],
    ["tests/build-gate/file-size.test.tsx", true],
    ["tests/build-gate/file-size.test.mts", true],
    ["tests/build-gate/file-size.test.cts", true],
    ["docs/example.ts", false],
    ["tests/static-analysis/fixtures/odw-examples/example.js", false],
    ["tests/static-analysis/__snapshots__/report.test.ts.snap", false],
  ])("classifies TypeScript source and test path scope for %s", (path, shouldInclude) => {
    expect(isSourceOrTestTypeScriptPath(path)).toBe(shouldInclude);
  });

  it("reports only oversized TypeScript source and test files", () => {
    const exactlyAtLimit = `${"line\n".repeat(399)}line`;
    const overLimit = `${"line\n".repeat(400)}line`;
    const sourceByPath = new Map<string, string>([
      ["src/exactly-at-limit.ts", exactlyAtLimit],
      ["tests/oversized.test.ts", overLimit],
      ["tests/static-analysis/fixtures/odw-examples/oversized.js", overLimit],
    ]);

    const violations = findOversizedSourceAndTestFiles(
      [...sourceByPath.keys()],
      (path) => {
        const source = sourceByPath.get(path);

        if (source === undefined) {
          throw new Error(`missing test source for ${path}`);
        }

        return source;
      },
      400,
    );

    expect(violations).toEqual([
      {
        path: "tests/oversized.test.ts",
        lineCount: 401,
        limit: 400,
      },
    ]);
  });

  it("formats oversized file reports for deterministic failures", () => {
    expect(
      formatFileSizeViolations([
        {
          path: "src/oversized.ts",
          lineCount: 401,
          limit: 400,
        },
        {
          path: "tests/oversized.test.ts",
          lineCount: 412,
          limit: 400,
        },
      ]),
    ).toBe(
      [
        "src/oversized.ts: 401 physical lines exceeds 400",
        "tests/oversized.test.ts: 412 physical lines exceeds 400",
      ].join("\n"),
    );
  });

  it("converts non-zero Git listings into project-owned errors", () => {
    expect(() =>
      trackedSourceAndTestTypeScriptFiles(() => ({
        status: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
      })),
    ).toThrow(/git ls-files -z -- src tests.*status 128.*fatal: not a git repository/s);
  });

  it("converts non-zero Git listings with nullable output into project-owned errors", () => {
    expect(() =>
      trackedSourceAndTestTypeScriptFiles(() => ({
        status: null,
        stdout: null,
        stderr: null,
      })),
    ).toThrow(/git ls-files -z -- src tests.*status null/s);
  });

  it("converts failed Git spawns into project-owned errors", () => {
    expect(() =>
      trackedSourceAndTestTypeScriptFiles(() => ({
        status: null,
        stdout: "",
        stderr: "",
        error: new Error("spawn git ENOENT"),
      })),
    ).toThrow(/git ls-files -z -- src tests.*spawn git ENOENT/s);
  });

  it("filters injected tracked Git output without invoking a subprocess", () => {
    const gitResult: GitFileListingResult = {
      status: 0,
      stdout: [
        "src/index.ts",
        "src/generated.js",
        "tests/build-gate/file-size.test.ts",
        "docs/architecture.ts",
      ].join("\0"),
      stderr: "",
    };

    expect(trackedSourceAndTestTypeScriptFiles(() => gitResult)).toEqual([
      "src/index.ts",
      "tests/build-gate/file-size.test.ts",
    ]);
  });
});
