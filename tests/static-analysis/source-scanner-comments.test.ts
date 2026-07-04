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
    expect(lineCommentContentEnd("// value\nnext", 2, 13)).toBe(8);
    expect(lineCommentContentEnd("// value\r\nnext", 2, 14)).toBe(8);
    expect(lineCommentContentEnd("// value", 2, 8)).toBe(8);
  });

  it("finds line-comment ends while consuming terminators", () => {
    expect(lineCommentTerminatorEnd("// value\nnext", 2)).toBe(9);
    expect(lineCommentTerminatorEnd("// value\r\nnext", 2)).toBe(10);
    expect(lineCommentTerminatorEnd("// value\u2028next", 2)).toBe(9);
    expect(lineCommentTerminatorEnd("// value\u2029next", 2)).toBe(9);
    expect(lineCommentTerminatorEnd("// value", 2)).toBe(8);
  });

  it("finds block-comment ends inside bounded scan ranges", () => {
    expect(blockCommentEnd("/* value */next", 2, 14)).toBe(11);
    expect(blockCommentEnd("/* value", 2, 8)).toBe(8);
    expect(blockCommentEnd("/* value */next", 2, 8)).toBe(8);
  });

  it("dispatches comment starts to their bounded comment ends", () => {
    expect(commentDispatchEnd("// value\nnext", 0, 13)).toBe(8);
    expect(commentDispatchEnd("/* value */next", 0, 14)).toBe(11);
    expect(commentDispatchEnd("/ value", 0, 7)).toBeUndefined();
  });
});
