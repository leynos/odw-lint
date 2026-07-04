/** @file Tests for shared source-scanner comment primitives. */

import { describe, expect, it } from "bun:test";
import {
  blockCommentEnd,
  commentDispatchEnd,
  lineCommentContentEnd,
  lineCommentTerminatorEnd,
} from "../../src/static-analysis/source-scanner-primitives";

describe("source scanner comment primitives", () => {
  it("finds line-comment content ends without consuming terminators", () => {
    for (const [sourceText, expectedEnd] of [
      ["// value\nnext", 8],
      ["// value\r\nnext", 8],
      ["// value\rnext", 8],
      ["// value\u2028next", 8],
      ["// value\u2029next", 8],
      ["// value", 8],
    ] as const) {
      expect(lineCommentContentEnd(sourceText, 2, sourceText.length)).toBe(expectedEnd);
    }
  });

  it("finds line-comment ends while consuming terminators", () => {
    expect(lineCommentTerminatorEnd("// value\nnext", 2)).toBe(9);
    expect(lineCommentTerminatorEnd("// value\r\nnext", 2)).toBe(10);
    expect(lineCommentTerminatorEnd("// value\u2028next", 2)).toBe(9);
    expect(lineCommentTerminatorEnd("// value\u2029next", 2)).toBe(9);
    expect(lineCommentTerminatorEnd("// value", 2)).toBe(8);
  });

  it("finds block-comment ends inside bounded scan ranges", () => {
    for (const [sourceText, scanEnd, expectedEnd] of [
      ["/* value */next", 14, 11],
      ["/* value", 8, 8],
      ["/* value */next", 8, 8],
      ["/* * / */next", 13, 9],
      ["/* value **/next", 15, 12],
    ] as const) {
      expect(blockCommentEnd(sourceText, 2, scanEnd)).toBe(expectedEnd);
    }
  });

  it("dispatches comment starts to their bounded comment ends", () => {
    expect(commentDispatchEnd("// value\nnext", 0, 13)).toBe(8);
    expect(commentDispatchEnd("/* value */next", 0, 14)).toBe(11);
    expect(commentDispatchEnd("/ value", 0, 7)).toBeUndefined();
  });
});
