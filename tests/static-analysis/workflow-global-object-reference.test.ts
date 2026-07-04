/**
 * @file Unit tests for deterministic-time global object reference resolution.
 */

import { describe, expect, it } from "bun:test";
import type { Expression, MemberExpression, Module, Node } from "@swc/core";
import { parseSync } from "@swc/core";
import type { LexicalBindingFacts } from "../../src/static-analysis/workflow-ast-bindings";
import {
  type GlobalObjectIdentity,
  resolveGlobalObjectIdentity,
  resolveStaticMemberName,
} from "../../src/static-analysis/workflow-global-object-reference";

const EMPTY_BINDINGS = Object.freeze({
  boundNames: Object.freeze([]),
}) satisfies LexicalBindingFacts;

/** Builds lexical binding facts with selected names marked as local. */
const bindingsWith = (...boundNames: readonly string[]): LexicalBindingFacts => {
  return Object.freeze({
    boundNames: Object.freeze([...boundNames].sort()),
  });
};

/** Parses one ECMAScript expression through the same dialect as workflow bodies. */
const parseExpression = (expression: string): Expression => {
  const module = parseSync(`const value = ${expression};`, {
    syntax: "ecmascript",
    target: "es2022",
  }) as Module;
  const [statement] = module.body;

  if (statement?.type !== "VariableDeclaration") {
    throw new Error("Expected expression fixture to parse as a variable declaration.");
  }

  const [declarator] = statement.declarations;
  if (!isExpression(declarator?.init)) {
    throw new Error("Expected expression fixture to produce an initializer expression.");
  }

  return declarator.init;
};

/** Parses one member expression fixture. */
const parseMemberExpression = (expression: string): MemberExpression => {
  const parsedExpression = parseExpression(expression);

  if (parsedExpression.type !== "MemberExpression") {
    throw new Error("Expected expression fixture to parse as a member expression.");
  }

  return parsedExpression;
};

/** Narrows unknown values to SWC expression-shaped objects. */
const isExpression = (value: unknown): value is Expression => {
  return typeof value === "object" && value !== null && "type" in value;
};

/** Extracts the object expression from a parsed member fixture. */
const memberObject = (expression: string): Expression => {
  return parseMemberExpression(expression).object;
};

/** Extracts the property node from a parsed member fixture. */
const memberProperty = (expression: string): MemberExpression["property"] => {
  return parseMemberExpression(expression).property;
};

/** Keeps a broad node available for the resolver's `Node` input contract. */
const asNode = (expression: Expression): Node => {
  return expression as Node;
};

type GlobalIdentityCase = {
  readonly name: string;
  readonly expression: () => Expression | Node;
  readonly bindings: LexicalBindingFacts;
  readonly expected: GlobalObjectIdentity | undefined;
};

const GLOBAL_IDENTITY_CASES = Object.freeze([
  {
    name: "bare Date",
    expression: () => parseExpression("Date"),
    bindings: EMPTY_BINDINGS,
    expected: "Date",
  },
  {
    name: "parenthesized Date",
    expression: () => parseExpression("(Date)"),
    bindings: EMPTY_BINDINGS,
    expected: "Date",
  },
  {
    name: "broad Node parenthesized Math",
    expression: () => asNode(parseExpression("(Math)")),
    bindings: EMPTY_BINDINGS,
    expected: "Math",
  },
  {
    name: "direct globalThis Date",
    expression: () => parseExpression("globalThis.Date"),
    bindings: EMPTY_BINDINGS,
    expected: "Date",
  },
  {
    name: "string-member globalThis Math",
    expression: () => parseExpression('(globalThis)["Math"]'),
    bindings: EMPTY_BINDINGS,
    expected: "Math",
  },
  {
    name: "nested globalThis Date member object",
    expression: () => memberObject("globalThis.Date.now"),
    bindings: EMPTY_BINDINGS,
    expected: "Date",
  },
  {
    name: "globalThis Date with local Date shadow",
    expression: () => parseExpression("globalThis.Date"),
    bindings: bindingsWith("Date"),
    expected: "Date",
  },
  {
    name: "globalThis Math with local Math shadow",
    expression: () => parseExpression("globalThis.Math"),
    bindings: bindingsWith("Math"),
    expected: "Math",
  },
  {
    name: "optional globalThis Date",
    expression: () => parseExpression("globalThis?.Date"),
    bindings: EMPTY_BINDINGS,
    expected: "Date",
  },
  {
    name: "optional globalThis Math",
    expression: () => parseExpression("globalThis?.Math"),
    bindings: EMPTY_BINDINGS,
    expected: "Math",
  },
  {
    name: "parenthesized optional globalThis Date",
    expression: () => parseExpression("(globalThis)?.Date"),
    bindings: EMPTY_BINDINGS,
    expected: "Date",
  },
  {
    name: "parenthesized optional globalThis Math",
    expression: () => parseExpression("(globalThis)?.Math"),
    bindings: EMPTY_BINDINGS,
    expected: "Math",
  },
  {
    name: "shadowed parenthesized Date",
    expression: () => parseExpression("(Date)"),
    bindings: bindingsWith("Date"),
    expected: undefined,
  },
  {
    name: "shadowed parenthesized globalThis chain",
    expression: () => parseExpression("(globalThis).Date"),
    bindings: bindingsWith("globalThis"),
    expected: undefined,
  },
  {
    name: "unsupported window root",
    expression: () => parseExpression("window.Date"),
    bindings: EMPTY_BINDINGS,
    expected: undefined,
  },
  {
    name: "unsupported globalThis Array",
    expression: () => parseExpression("globalThis.Array"),
    bindings: EMPTY_BINDINGS,
    expected: undefined,
  },
  {
    name: "dynamic globalThis property",
    expression: () => parseExpression("globalThis[key]"),
    bindings: EMPTY_BINDINGS,
    expected: undefined,
  },
] as const satisfies readonly GlobalIdentityCase[]);

describe("resolveStaticMemberName", () => {
  it("resolves identifier and string-literal member names", () => {
    expect(resolveStaticMemberName(memberProperty("Date.now"))).toBe("now");
    expect(resolveStaticMemberName(memberProperty('Date["now"]'))).toBe("now");
  });

  it("ignores dynamic computed member names", () => {
    expect(resolveStaticMemberName(memberProperty("Date[key]"))).toBeUndefined();
    expect(resolveStaticMemberName(memberProperty("Date[0]"))).toBeUndefined();
  });
});

describe("resolveGlobalObjectIdentity", () => {
  it.each(
    GLOBAL_IDENTITY_CASES.map((testCase) => [testCase.name, testCase]),
  )("resolves %s", (_, testCase) => {
    expect(resolveGlobalObjectIdentity(testCase.expression(), testCase.bindings)).toBe(
      testCase.expected,
    );
  });
});
