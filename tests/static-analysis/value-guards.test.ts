/**
 * @file Tests for shared static-analysis value guards.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import {
  isFiniteNumber,
  isUnknownRecord,
  type UnknownRecord,
} from "../../src/static-analysis/value-guards";

describe("static-analysis value guards", () => {
  it("accepts only non-null object records", () => {
    const record = { start: 1 } as unknown;

    expect(isUnknownRecord(record)).toBe(true);
    if (isUnknownRecord(record)) {
      expectTypeOf(record).toEqualTypeOf<UnknownRecord>();
    }
    expect(isUnknownRecord(null)).toBe(false);
    expect(isUnknownRecord(["start", 1])).toBe(false);
    expect(isUnknownRecord(() => undefined)).toBe(false);
    expect(isUnknownRecord("record")).toBe(false);
  });

  it("accepts only finite numbers", () => {
    const offset = 0 as unknown;

    expect(isFiniteNumber(offset)).toBe(true);
    if (isFiniteNumber(offset)) {
      expectTypeOf(offset).toEqualTypeOf<number>();
    }
    expect(isFiniteNumber(1.5)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber("1")).toBe(false);
  });
});
