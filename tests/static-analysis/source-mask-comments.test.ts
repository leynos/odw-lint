/**
 * @file Focused tests for source-mask comment scanning.
 *
 * These tests keep comment scanner branch coverage next to the split comment
 * module without relying on the broader source-mask facade suite.
 */

import { describe, expect, it } from "bun:test";
import { isCommentStart, scanCommentRange } from "../../src/static-analysis/source-mask-comments";

describe("source-mask comment scanner", () => {
  it("scans line and terminated block comments", () => {
    expect(scanCommentRange("// x\nnext", 0, "/", "/")).toEqual({
      kind: "comment",
      startIndex: 0,
      endIndex: 5,
    });
    expect(scanCommentRange("/* x */ next", 0, "/", "*")).toEqual({
      kind: "comment",
      startIndex: 0,
      endIndex: 7,
    });
  });

  it("masks unterminated block comments through the end of source", () => {
    expect(scanCommentRange("/* open", 0, "/", "*")).toEqual({
      kind: "comment",
      startIndex: 0,
      endIndex: 7,
    });
  });

  it("masks line comments through JavaScript line terminators", () => {
    for (const [sourceText, expectedEnd] of [
      ["// x\nnext", 5],
      ["// x\r\nnext", 6],
      ["// x\u2028next", 5],
      ["// x\u2029next", 5],
      ["// x", 4],
    ] as const) {
      expect(scanCommentRange(sourceText, 0, "/", "/")).toEqual({
        kind: "comment",
        startIndex: 0,
        endIndex: expectedEnd,
      });
    }
  });

  it("ignores non-comment slashes", () => {
    expect(isCommentStart("/", "=")).toBeFalse();
    expect(isCommentStart("x", "/")).toBeFalse();
    expect(scanCommentRange("/ value", 0, "/", " ")).toBeUndefined();
  });
});
