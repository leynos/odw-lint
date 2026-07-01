/**
 * @file Boundary tests for metadata comment and delimiter scanners.
 */

import { describe, expect, it } from "bun:test";
import {
  scanBlockCommentEnd,
  scanDelimitedEnd,
  scanLineCommentEnd,
} from "../../src/static-analysis/workflow-metadata-comment-scan";

describe("workflow metadata comment scanners", () => {
  it("skips escaped delimiters and handles escape-at-end safely", () => {
    expect(scanDelimitedEnd('"not \\" done" + tail', 0, '"', 20)).toBe(13);
    expect(scanDelimitedEnd('"escape at end\\', 0, '"', 15)).toBe(15);
  });

  it("skips nested strings inside template interpolation", () => {
    const sourceText = "`outer $" + "{call(`inner $" + "{value}`)} end` tail";

    expect(scanDelimitedEnd(sourceText, 0, "`", sourceText.length)).toBe(
      sourceText.indexOf(" tail"),
    );
  });

  it("falls back to the scan end for unterminated or out-of-range block comments", () => {
    expect(scanBlockCommentEnd("/* unterminated", 2, 15)).toBe(15);
    expect(scanBlockCommentEnd("/* closed */", 2, 8)).toBe(8);
    expect(scanBlockCommentEnd("/* closed */", 2, 12)).toBe(12);
  });

  for (const [description, text, expectedIndex] of [
    ["line feed", "// line\nnext", 7],
    ["carriage return", "// line\rnext", 7],
    ["line separator", "// line\u2028next", 7],
    ["paragraph separator", "// line\u2029next", 7],
  ] as const) {
    it(`stops line comments at ${description}`, () => {
      expect(scanLineCommentEnd(text, 2, text.length)).toBe(expectedIndex);
    });
  }
});
