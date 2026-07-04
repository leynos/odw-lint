/**
 * @file Tests for shared SWC AST shape helpers.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import type { Node } from "@swc/core";
import fc from "fast-check";
import {
  astChildValues,
  isAstNode,
  isUnknownRecord as seamIsUnknownRecord,
} from "../../src/static-analysis/swc-ast";
import { isUnknownRecord } from "../../src/static-analysis/value-guards";

describe("SWC AST shape helpers", () => {
  it.each([
    [{ type: "X" }],
    [{ type: "CallExpression", span: { start: 1, end: 2, ctxt: 0 } }],
  ])("accepts node-shaped objects %#", (value) => {
    expect(isAstNode(value)).toBe(true);
  });

  it.each([
    [null],
    [undefined],
    [42],
    ["s"],
    [[]],
    [[{ type: "X" }]],
    [{ span: {} }],
    [() => undefined],
  ])("rejects non-node values %#", (value) => {
    expect(isAstNode(value)).toBe(false);
  });

  it("narrows accepted values to SWC nodes", () => {
    const value = { type: "Identifier", value: "name" } as unknown;

    if (isAstNode(value)) {
      expectTypeOf(value).toEqualTypeOf<Node>();
    }
  });

  it("returns only semantic child fields", () => {
    const callee = { type: "Identifier", value: "Date" };
    const args = [{ expression: { type: "StringLiteral", value: "x" } }];

    expect(
      astChildValues({
        type: "CallExpression",
        span: { start: 1, end: 2, ctxt: 0 },
        ctxt: 0,
        callee,
        arguments: args,
      }),
    ).toEqual([callee, args]);
    expect(astChildValues({})).toEqual([]);
  });

  it("excludes SWC bookkeeping values and preserves semantic values", () => {
    const semanticKeys = ["callee", "arguments", "body", "expression"];
    const allKeys = ["span", "type", "ctxt", ...semanticKeys];
    const recordArbitrary = fc
      .uniqueArray(fc.constantFrom(...allKeys), {
        minLength: 1,
      })
      .map((keys) => Object.fromEntries(keys.map((key) => [key, `${key}-value`])));

    fc.assert(
      fc.property(recordArbitrary, (record) => {
        const children = astChildValues(record);
        const excludedValues = ["span", "type", "ctxt"]
          .filter((key) => Object.hasOwn(record, key))
          .map((key) => record[key]);
        const expectedValues = Object.entries(record)
          .filter(([key]) => !["span", "type", "ctxt"].includes(key))
          .map(([, value]) => value);

        expect(children).not.toContainAnyValues(excludedValues);
        expect(children).toEqual(expectedValues);
      }),
    );
  });

  it("re-exports the canonical record guard", () => {
    expect(seamIsUnknownRecord).toBe(isUnknownRecord);
  });
});
