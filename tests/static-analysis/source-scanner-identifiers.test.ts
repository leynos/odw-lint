/** @file Tests for shared source-scanner identifier-run primitives. */

import { describe, expect, it } from "bun:test";
import {
  asciiIdentifierRunEnd,
  asciiIdentifierRunStart,
  identifierRunEnd,
} from "../../src/static-analysis/source-scanner-primitives";

describe("source scanner identifier primitives", () => {
  it("finds forward Unicode identifier runs", () => {
    expect(identifierRunEnd("alpha.next", 0, 10)).toBe(5);
    expect(identifierRunEnd("éclair tail", 0, 11)).toBe(6);
    expect(identifierRunEnd("😀name", 0, 6)).toBeUndefined();
    expect(identifierRunEnd("name\u200c\u200dTail;", 0, 11)).toBe(10);
  });

  it("finds forward ASCII identifier-like runs", () => {
    expect(asciiIdentifierRunEnd("gim;tail", 0)).toBe(3);
    expect(asciiIdentifierRunEnd("abcé", 0)).toBe(3);
    expect(asciiIdentifierRunEnd("éabc", 0)).toBe(0);
  });

  it("finds backward ASCII identifier-like run starts", () => {
    expect(asciiIdentifierRunStart("value", 5)).toBe(0);
    expect(asciiIdentifierRunStart("left + right", 12)).toBe(7);
    expect(asciiIdentifierRunStart("value.", 6)).toBe(6);
  });
});
