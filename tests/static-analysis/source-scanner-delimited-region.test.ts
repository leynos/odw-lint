/** @file Tests for consolidated delimited-region scanner primitives. */

import { describe, expect, it } from "bun:test";
import { scanDelimitedRegionEnd } from "../../src/static-analysis/source-scanner-primitives";

describe("scanDelimitedRegionEnd", () => {
  it("returns the index after a plain closing delimiter", () => {
    expect(scanDelimitedRegionEnd("'value' tail", 0, "'")).toBe(7);
  });

  it("skips backslash-escaped delimiters", () => {
    expect(scanDelimitedRegionEnd("'it\\'s done' tail", 0, "'")).toBe(12);
  });

  it("returns the scan bound for unterminated regions", () => {
    expect(scanDelimitedRegionEnd("'unterminated", 0, "'")).toBe(13);
  });

  it("uses an explicit end index as the scan bound", () => {
    expect(scanDelimitedRegionEnd("'value' tail", 0, "'", { endIndex: 4 })).toBe(4);
  });

  it("treats template interpolation as ordinary text when interpolation is disabled", () => {
    const sourceText = "`prefix $" + "{'}'} suffix` tail";

    expect(scanDelimitedRegionEnd(sourceText, 0, "`", { allowTemplateInterpolation: false })).toBe(
      sourceText.indexOf(" tail"),
    );
  });

  it("skips template interpolation when interpolation is enabled", () => {
    const sourceText = "`prefix $" + "{`nested $" + "{/* ` */ '}'} done`} suffix` tail";

    expect(scanDelimitedRegionEnd(sourceText, 0, "`", { allowTemplateInterpolation: true })).toBe(
      sourceText.indexOf(" tail"),
    );
  });

  it("stops at unescaped line terminators when enabled", () => {
    for (const terminator of ["\n", "\r", "\u2028", "\u2029"]) {
      expect(
        scanDelimitedRegionEnd(`'open${terminator}next`, 0, "'", {
          terminateAtLineTerminator: true,
        }),
      ).toBe(5);
    }
  });

  it("continues across escaped line terminators when termination is enabled", () => {
    expect(
      scanDelimitedRegionEnd("'a\\\r\nb' tail", 0, "'", { terminateAtLineTerminator: true }),
    ).toBe(7);
    expect(
      scanDelimitedRegionEnd("'a\\\nb' tail", 0, "'", { terminateAtLineTerminator: true }),
    ).toBe(6);
  });
});
