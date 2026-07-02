/**
 * @file Focused tests for source-mask template scanning.
 *
 * These tests pin template delimiter routing without depending only on the
 * facade-level source-mask contract tests.
 */

import { describe, expect, it } from "bun:test";
import { scanTemplateRange } from "../../src/static-analysis/source-mask-templates";

describe("source-mask template scanner", () => {
  it("uses the shared backtick delimiter classification", () => {
    expect(scanTemplateRange("`template`", 0, "`")).toEqual({
      kind: "template",
      startIndex: 0,
      endIndex: 10,
    });
  });

  it("ignores quoted-string and regex delimiters", () => {
    expect(scanTemplateRange("'string'", 0, "'")).toBeUndefined();
    expect(scanTemplateRange("/pattern/", 0, "/")).toBeUndefined();
  });
});
