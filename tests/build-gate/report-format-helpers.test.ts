/**
 * @file Unit tests for shared build-gate report formatting helpers.
 */

import { describe, expect, it } from "bun:test";
import { assertNever, singleLine } from "./report-format-helpers";

describe("singleLine", () => {
  it("collapses whitespace into one trimmed report line", () => {
    expect(singleLine(" first\nsecond\t\tthird  ")).toBe("first second third");
  });
});

describe("assertNever", () => {
  it("throws with the label and unexpected payload", () => {
    const unexpected = { outcome: "new-variant" } as never;

    expect(() => assertNever(unexpected, "test variant")).toThrow("unhandled test variant");
    expect(() => assertNever(unexpected, "test variant")).toThrow('"outcome":"new-variant"');
  });
});
