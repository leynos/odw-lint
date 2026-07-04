/**
 * @file Focused tests for shared workflow AST binding-pattern collectors.
 */

import { describe, expect, it } from "bun:test";
import {
  type AstNode,
  arrayValue,
  asNode,
  collectFunctionParamBindings,
  collectPatternBindings,
  identifierName,
} from "../../src/static-analysis/workflow-ast-binding-patterns";

const EXCLUDED_NAMES = new Set(["excluded"]);

/** Builds a SWC-like identifier node. */
const identifier = (value: string): AstNode => {
  return { type: "Identifier", value };
};

/** Collects names and recursed expression types from one pattern. */
const collectPattern = (pattern: unknown) => {
  const names = new Set<string>();
  const recursedTypes: string[] = [];

  collectPatternBindings(
    pattern,
    names,
    (node) => {
      if (node?.type !== undefined) {
        recursedTypes.push(node.type);
      }
    },
    EXCLUDED_NAMES,
  );

  return {
    names: [...names].sort(),
    recursedTypes,
  };
};

describe("workflow AST binding-pattern collectors", () => {
  it("narrows AST node helpers", () => {
    const node = identifier("name");

    expect(asNode(node)).toBe(node);
    expect(asNode(null)).toBeUndefined();
    expect(arrayValue([node])).toEqual([node]);
    expect(arrayValue(node)).toEqual([]);
    expect(identifierName(node)).toBe("name");
    expect(identifierName({ type: "StringLiteral", value: "name" })).toBeUndefined();
  });

  it("collects identifier, array, rest, and assignment patterns", () => {
    const pattern = {
      type: "ArrayPattern",
      elements: [
        identifier("first"),
        {
          type: "RestElement",
          argument: identifier("rest"),
        },
        {
          type: "AssignmentPattern",
          left: identifier("withDefault"),
          right: { type: "CallExpression" },
        },
      ],
    };

    expect(collectPattern(pattern)).toEqual({
      names: ["first", "rest", "withDefault"],
      recursedTypes: ["CallExpression"],
    });
  });

  it("collects object shorthand, renamed, nested, and rest patterns", () => {
    const pattern = {
      type: "ObjectPattern",
      properties: [
        {
          type: "AssignmentPatternProperty",
          key: identifier("shorthand"),
          value: { type: "CallExpression" },
        },
        {
          type: "KeyValuePatternProperty",
          key: identifier("source"),
          value: identifier("renamed"),
        },
        {
          type: "KeyValuePatternProperty",
          key: identifier("nestedSource"),
          value: {
            type: "ObjectPattern",
            properties: [
              {
                type: "KeyValuePatternProperty",
                key: identifier("x"),
                value: identifier("nested"),
              },
            ],
          },
        },
        {
          type: "RestElement",
          argument: identifier("others"),
        },
      ],
    };

    expect(collectPattern(pattern)).toEqual({
      names: ["nested", "others", "renamed", "shorthand"],
      recursedTypes: ["CallExpression"],
    });
  });

  it("recurses into computed object-pattern keys", () => {
    const pattern = {
      type: "ObjectPattern",
      properties: [
        {
          type: "KeyValuePatternProperty",
          key: { type: "Computed", expr: { type: "CallExpression" } },
          value: identifier("value"),
        },
      ],
    };

    expect(collectPattern(pattern)).toEqual({
      names: ["value"],
      recursedTypes: ["CallExpression"],
    });
  });

  it("honours excluded names", () => {
    expect(collectPattern(identifier("excluded"))).toEqual({
      names: [],
      recursedTypes: [],
    });
  });

  it("collects wrapped and bare function parameters", () => {
    const names = new Set<string>();
    const recursedTypes: string[] = [];

    collectFunctionParamBindings(
      {
        type: "FunctionDeclaration",
        params: [
          { type: "Parameter", pat: identifier("wrapped") },
          identifier("bare"),
          {
            type: "Parameter",
            pat: {
              type: "AssignmentPattern",
              left: identifier("withDefault"),
              right: { type: "CallExpression" },
            },
          },
        ],
      },
      names,
      (node) => {
        if (node?.type !== undefined) {
          recursedTypes.push(node.type);
        }
      },
      EXCLUDED_NAMES,
    );

    expect([...names].sort()).toEqual(["bare", "withDefault", "wrapped"]);
    expect(recursedTypes).toEqual(["CallExpression"]);
  });
});
