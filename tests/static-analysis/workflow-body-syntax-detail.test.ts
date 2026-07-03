/**
 * @file Workflow-body syntax detail extractor tests.
 *
 * These tests pin parser-error text reduction without importing SWC or turning
 * the extractor into a public package export.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import {
  BODY_SYNTAX_DETAIL_MAX_LENGTH,
  bodySyntaxDetail,
} from "../../src/static-analysis/workflow-body-syntax-detail";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";

const OVERLONG_DETAIL = "x".repeat(BODY_SYNTAX_DETAIL_MAX_LENGTH + 20);
const EXPECTED_TRUNCATED_DETAIL = "x".repeat(BODY_SYNTAX_DETAIL_MAX_LENGTH);

describe("workflow body syntax detail extraction", () => {
  it("reduces miette-shaped parser output to the marker summary", () => {
    const detail = bodySyntaxDetail(`  × Expected ';', '}' or <eof>
   ,- [workflow.js:1:19]
 1 | export default {
   :                   ^
   \`----
`);

    expect(detail).toBe("Expected ';', '}' or <eof>");
  });

  it("strips parser markers and syntax-error prefixes", () => {
    const cases = [
      { thrown: "× Expected ';'", expected: "Expected ';'" },
      { thrown: "x Expected ')'", expected: "Expected ')'" },
      { thrown: "X Expected expression", expected: "Expected expression" },
      { thrown: "Syntax Error: Expected expression", expected: "Expected expression" },
      { thrown: "Syntax Error Expected statement", expected: "Expected statement" },
      { thrown: "  ! Expected declaration", expected: "Expected declaration" },
    ] as const;

    for (const { thrown, expected } of cases) {
      expect(bodySyntaxDetail(thrown)).toBe(expected);
    }
  });

  it("preserves ordinary words that start with x or X", () => {
    const cases = [
      { thrown: "xylophone is not valid syntax", expected: "xylophone is not valid syntax" },
      { thrown: "Xylophone is not valid syntax", expected: "Xylophone is not valid syntax" },
    ] as const;

    for (const { thrown, expected } of cases) {
      expect(bodySyntaxDetail(thrown)).toBe(expected);
    }
  });

  it("collapses whitespace and truncates long detail lines", () => {
    expect(bodySyntaxDetail("× Expected    a\t\tvalid\nsource excerpt")).toBe("Expected a valid");
    expect(bodySyntaxDetail(`× ${OVERLONG_DETAIL}`)).toBe(EXPECTED_TRUNCATED_DETAIL);
  });

  it("returns an empty detail for missing or unowned textual payloads", () => {
    const cases = [
      "",
      "   ",
      undefined,
      null,
      {},
      { message: 12 },
      Object.create({ message: "inherited detail" }),
    ] as const;

    for (const thrown of cases) {
      expect(bodySyntaxDetail(thrown)).toBe("");
    }
  });

  it("coerces primitive thrown values without throwing", () => {
    const cases = [
      { thrown: 404, expected: "404" },
      { thrown: false, expected: "false" },
      { thrown: 12n, expected: "12" },
      { thrown: Symbol("syntax"), expected: "Symbol(syntax)" },
    ] as const;

    for (const { thrown, expected } of cases) {
      expect(bodySyntaxDetail(thrown)).toBe(expected);
    }
  });

  it("uses own string message properties from Error-like objects", () => {
    expect(bodySyntaxDetail(new Error("× Expected identifier"))).toBe("Expected identifier");
    expect(bodySyntaxDetail({ message: "Syntax Error: Expected body" })).toBe("Expected body");
  });

  it("never throws for representative parser-boundary values", () => {
    const throwingStringValue = {
      [Symbol.toPrimitive]: () => {
        throw new Error("coercion failed");
      },
    };

    const cases = [
      "× Expected ';'",
      undefined,
      null,
      1,
      false,
      1n,
      Symbol("syntax"),
      {},
      throwingStringValue,
    ] as const;

    for (const thrown of cases) {
      expect(() => bodySyntaxDetail(thrown)).not.toThrow();
    }
  });

  it("returns bounded single-line strings for arbitrary text", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const detail = bodySyntaxDetail(text);

        expect(detail).not.toContain("\n");
        expect(detail).not.toContain("\r");
        expect(detail.length).toBeLessThanOrEqual(BODY_SYNTAX_DETAIL_MAX_LENGTH);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});
