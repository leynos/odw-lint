/**
 * @file Tests for shared source coordinate copy helpers.
 */

import { describe, expect, it } from "bun:test";
import type { SourcePosition } from "odw-lint";
import { copySourcePosition, freezeSourceSpan } from "../../src/diagnostics/source-coordinates";

describe("source coordinate helpers", () => {
  it("copies source positions into frozen value objects", () => {
    const position: SourcePosition = { offset: 7, line: 2, column: 4 };

    const copy = copySourcePosition(position);

    expect(copy).toEqual(position);
    expect(copy).not.toBe(position);
    expect(Object.isFrozen(copy)).toBeTrue();
  });

  it("freezes source spans while preserving nested position references", () => {
    const start: SourcePosition = { offset: 7, line: 2, column: 4 };
    const end: SourcePosition = { offset: 11, line: 2, column: 8 };

    const span = freezeSourceSpan(start, end);

    expect(span).toEqual({ start, end });
    expect(Object.isFrozen(span)).toBeTrue();
    expect(span.start).toBe(start);
    expect(span.end).toBe(end);
  });
});
