/**
 * @file Tests for shared SWC AST shape helpers.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import type { Node } from "@swc/core";
import fc from "fast-check";
import {
  astChildValues,
  isAstNode,
  isCallExpression,
  isExpression,
  isIdentifier,
  isMemberExpression,
  isNewExpression,
  isUnknownRecord as seamIsUnknownRecord,
  traverseAstSubtree,
} from "../../src/static-analysis/swc-ast";
import { isUnknownRecord } from "../../src/static-analysis/value-guards";

type TestNode = Node & {
  readonly label: string;
  readonly child?: TestNode;
  readonly children?: readonly TestNode[];
  readonly wrapper?: { readonly nested?: TestNode };
};
type TestNodeFields = {
  child?: TestNode;
  children?: readonly TestNode[];
  wrapper?: { readonly nested?: TestNode | null | undefined };
  span?: unknown;
  ctxt?: unknown;
};

/** Builds a labelled node-shaped fixture for traversal assertions. */
const testNode = (label: string, children: TestNodeFields = {}): TestNode => {
  return { type: "TestNode", label, ...children } as TestNode;
};

/** Walks a node tree with the existing seam primitives as an oracle. */
const referenceWalk = (node: Node): readonly Node[] => {
  const visited: Node[] = [node];

  for (const child of astChildValues(node)) {
    collectReferenceChildNodes(child, visited);
  }

  return visited;
};

/** Adds every child node reachable from one arbitrary child value. */
const collectReferenceChildNodes = (value: unknown, visited: Node[]): void => {
  if (isAstNode(value)) {
    visited.push(...referenceWalk(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferenceChildNodes(item, visited);
    }
    return;
  }

  if (isUnknownRecord(value)) {
    for (const child of astChildValues(value)) {
      collectReferenceChildNodes(child, visited);
    }
  }
};

/** Generates bounded node trees that exercise node, array, and record children. */
const generatedNodeArbitrary = (depth = 0): fc.Arbitrary<TestNode> => {
  const childArbitrary =
    depth >= 3 ? fc.constant(undefined) : fc.option(generatedNodeArbitrary(depth + 1));

  return fc
    .record({
      label: fc.string({ minLength: 1, maxLength: 8 }),
      child: childArbitrary,
      children:
        depth >= 3
          ? fc.constant([])
          : fc.array(generatedNodeArbitrary(depth + 1), { maxLength: 3 }),
      wrapper: fc.option(fc.record({ nested: childArbitrary })),
    })
    .map(({ label, child, children, wrapper }) => {
      const fields: TestNodeFields = { children };

      if (child != null) {
        fields.child = child;
      }
      if (wrapper !== null) {
        fields.wrapper = wrapper;
      }

      return testNode(label, fields);
    });
};

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

  it.each([
    ["expressions", isExpression, { type: "CallExpression" }, { span: {} }],
    [
      "call expressions",
      isCallExpression,
      { type: "CallExpression", callee: {}, arguments: [] },
      { type: "Identifier", value: "name" },
    ],
    [
      "identifiers",
      isIdentifier,
      { type: "Identifier", value: "name" },
      { type: "StringLiteral", value: "name" },
    ],
    [
      "member expressions",
      isMemberExpression,
      { type: "MemberExpression", object: {}, property: {} },
      { type: "Identifier", value: "name" },
    ],
    [
      "constructor expressions",
      isNewExpression,
      { type: "NewExpression", callee: {}, arguments: [] },
      { type: "CallExpression", callee: {}, arguments: [] },
    ],
  ])("narrows %s through the shared SWC node seam", (_name, narrower, accepted, rejected) => {
    expect(narrower(accepted)).toBe(true);
    expect(narrower(rejected)).toBe(false);
  });
});

describe("traverseAstSubtree", () => {
  it("visits semantic child nodes exactly once in pre-order", () => {
    const directChild = testNode("direct");
    const arrayChild = testNode("array");
    const nestedChild = testNode("nested");
    const root = testNode("root", {
      child: directChild,
      children: [arrayChild],
      wrapper: { nested: nestedChild },
      span: { start: 1, end: 2, ctxt: 0 },
      ctxt: 0,
    });
    const visitedLabels: string[] = [];

    traverseAstSubtree(root, undefined, (node) => {
      visitedLabels.push((node as TestNode).label);
      return undefined;
    });

    expect(visitedLabels).toEqual(["root", "direct", "array", "nested"]);
  });

  it("threads node-returned context through array and record wrappers", () => {
    const directChild = testNode("direct");
    const arrayChild = testNode("array");
    const nestedChild = testNode("nested");
    const root = testNode("root", {
      child: directChild,
      children: [arrayChild],
      wrapper: { nested: nestedChild },
    });
    const receivedContexts = new Map<string, number>();

    traverseAstSubtree(root, 0, (node, depth) => {
      receivedContexts.set((node as TestNode).label, depth);
      return depth + 1;
    });

    expect(Object.fromEntries(receivedContexts)).toEqual({
      root: 0,
      direct: 1,
      array: 1,
      nested: 1,
    });
  });

  it("matches the existing astChildValues reference traversal for generated trees", () => {
    fc.assert(
      fc.property(generatedNodeArbitrary(), (root) => {
        const visited: Node[] = [];

        traverseAstSubtree(root, undefined, (node) => {
          visited.push(node);
          return undefined;
        });

        expect(visited).toEqual([...referenceWalk(root)]);
      }),
      { numRuns: 100 },
    );
  });
});
