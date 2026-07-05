/**
 * @file Tests for workflow AST scope binding views.
 */

import { describe, expect, it } from "bun:test";
import type { Module, Node } from "@swc/core";
import { astChildValues, isAstNode } from "../../src/static-analysis/swc-ast";
import { asNode, identifierName } from "../../src/static-analysis/workflow-ast-binding-patterns";
import {
  enterScope,
  enterScopeWithOwnFacts,
  rootScopeOwnFacts,
  rootScopeView,
  scopeOwnFacts,
} from "../../src/static-analysis/workflow-ast-scopes";
import { WORKFLOW_BODY_WRAP_FUNCTION_NAME } from "../../src/static-analysis/workflow-body-normalizer";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import { envelopeForBody } from "./workflow-envelope-support";

/** Parses one workflow body and returns its normalized SWC module. */
const moduleForBody = (body: string): Module => {
  const result = parseNormalizedWorkflowBody(envelopeForBody(body));

  if (!result.ok) {
    throw new Error("Expected workflow scope fixture to parse.", { cause: result.error });
  }

  return result.module;
};

/** Returns all AST nodes with the requested SWC type. */
const nodesOfType = (node: Node, type: string): readonly Node[] => {
  const matches: Node[] = [];
  collectNodesOfType(node, type, matches);

  return matches;
};

/** Collects AST nodes with the requested SWC type. */
const collectNodesOfType = (node: Node, type: string, matches: Node[]): void => {
  if (node.type === type) {
    matches.push(node);
  }

  for (const child of astChildValues(node)) {
    collectNodesInValue(child, type, matches);
  }
};

/** Collects AST nodes from one child value. */
const collectNodesInValue = (value: unknown, type: string, matches: Node[]): void => {
  if (isAstNode(value)) {
    collectNodesOfType(value, type, matches);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectNodesInValue(item, type, matches);
    }
  }
};

/** Returns one AST node by type and occurrence index. */
const nodeOfType = (node: Node, type: string, index = 0): Node => {
  const match = nodesOfType(node, type)[index];
  if (match === undefined) {
    throw new Error(`Expected fixture to include ${type} node ${index}.`);
  }

  return match;
};

/** Returns the first user-written statement with the requested SWC type. */
const userStatementOfType = (module: Module, type: string): Node => {
  const match = userBodyStatements(module).find((statement) => {
    return isAstNode(statement) && statement.type === type;
  });

  if (!isAstNode(match)) {
    throw new Error(`Expected fixture to include user statement ${type}.`);
  }

  return match;
};

/** Returns the normalized user body statements from the synthetic wrapper. */
const userBodyStatements = (module: Module): readonly unknown[] => {
  const [wrapper] = module.body;
  const wrapperNode = asNode(wrapper);
  const wrapperBody = asNode(wrapperNode?.body);

  if (!isWorkflowBodyWrapper(wrapperNode)) {
    throw new Error("Expected normalized workflow body wrapper.");
  }

  if (!Array.isArray(wrapperBody?.stmts)) {
    throw new Error("Expected normalized workflow body wrapper.");
  }

  return wrapperBody.stmts;
};

/** Checks whether a node is the normalized synthetic workflow body wrapper. */
const isWorkflowBodyWrapper = (node: ReturnType<typeof asNode>): boolean => {
  if (node?.type !== "FunctionDeclaration") {
    return false;
  }

  return identifierName(asNode(node.identifier)) === WORKFLOW_BODY_WRAP_FUNCTION_NAME;
};

describe("workflow AST scope views", () => {
  it("returns root-owned names and simple initializers", () => {
    const module = moduleForBody("const D = Date;\nfunction helper(Date) {}\n");
    const facts = rootScopeOwnFacts(module);

    expect(facts.ownNames).toEqual(["D", "helper"]);
    expect(facts.ownInitializers.map((initializer) => initializer.name)).toEqual(["D"]);
  });

  it("returns scope-owned names that shadow ancestor names", () => {
    const module = moduleForBody(
      "const now = Date.now;\nfunction helper(now) { const D = Date; return now(); }\n",
    );
    const facts = scopeOwnFacts(userStatementOfType(module, "FunctionDeclaration"));

    expect(facts.ownNames).toEqual(["helper", "now"]);
    expect(facts.ownInitializers).toEqual([]);
  });

  it("excludes names and initializers owned by nested scopes", () => {
    const module = moduleForBody(
      "{ const D = Date; { const blockAlias = Date.now; } function inner() { const innerAlias = Date.now; } }\n",
    );
    const facts = scopeOwnFacts(userStatementOfType(module, "BlockStatement"));

    expect(facts.ownNames).toEqual(["D", "inner"]);
    expect(facts.ownInitializers.map((initializer) => initializer.name)).toEqual(["D"]);
  });

  it("returns empty own facts for non-scope-opening nodes", () => {
    const module = moduleForBody("const D = Date;\nD;\n");
    const facts = scopeOwnFacts(userStatementOfType(module, "ExpressionStatement"));

    expect(facts).toEqual({ ownNames: [], ownInitializers: [] });
  });

  it("returns the same view for non-scope-opening nodes", () => {
    const module = moduleForBody("const timestamp = Date.now();\ntimestamp;\n");
    const rootView = rootScopeView(module);
    const expressionView = enterScope(rootView, userStatementOfType(module, "ExpressionStatement"));

    expect(expressionView).toBe(rootView);
  });

  it("enters scopes from precomputed own facts", () => {
    const module = moduleForBody("function helper(Date) { return Date.now(); }\nhelper();\n");
    const rootView = rootScopeView(module);
    const functionNode = userStatementOfType(module, "FunctionDeclaration");
    const expressionNode = userStatementOfType(module, "ExpressionStatement");

    expect(enterScopeWithOwnFacts(rootView, scopeOwnFacts(functionNode))).toEqual(
      enterScope(rootView, functionNode),
    );
    expect(enterScopeWithOwnFacts(rootView, scopeOwnFacts(expressionNode))).toBe(rootView);
  });

  it("keeps nested parameter bindings out of the root view", () => {
    const module = moduleForBody("function helper({ value: [Date] }, Math = fallback) {}\n");
    const rootView = rootScopeView(module);
    const functionView = enterScope(rootView, userStatementOfType(module, "FunctionDeclaration"));

    expect(rootView.boundNames).toEqual(["helper"]);
    expect(functionView.boundNames).toEqual(["Date", "Math", "helper"]);
  });

  it("adds setter parameter bindings only in the setter scope", () => {
    const module = moduleForBody("const object = { set value({ Date }) { Date.now(); } };\n");
    const rootView = rootScopeView(module);
    const setterView = enterScope(rootView, nodeOfType(module, "SetterProperty"));

    expect(rootView.boundNames).toEqual(["object"]);
    expect(setterView.boundNames).toEqual(["Date", "object"]);
  });

  it("threads named class-expression bindings into member scopes", () => {
    const module = moduleForBody("const Clock = class Date { method() { return Date.now(); } };\n");
    const rootView = rootScopeView(module);
    const classView = enterScope(rootView, nodeOfType(module, "ClassExpression"));
    const methodView = enterScope(classView, nodeOfType(module, "ClassMethod"));

    expect(rootView.boundNames).toEqual(["Clock"]);
    expect(classView.boundNames).toEqual(["Clock", "Date"]);
    expect(methodView.boundNames).toEqual(["Clock", "Date"]);
  });

  it("attributes block bindings only after entering the block", () => {
    const module = moduleForBody(
      "{ const Date = createClock(); }\nconst timestamp = Date.now();\n",
    );
    const rootView = rootScopeView(module);
    const blockView = enterScope(rootView, userStatementOfType(module, "BlockStatement"));

    expect(rootView.boundNames).toEqual(["timestamp"]);
    expect(blockView.boundNames).toEqual(["Date", "timestamp"]);
  });

  it("attributes nested function declarations to the enclosing block only", () => {
    const module = moduleForBody(
      "{ function helper() { const Date = localClock; } }\nconst timestamp = Date.now();\n",
    );
    const rootView = rootScopeView(module);
    const blockView = enterScope(rootView, userStatementOfType(module, "BlockStatement"));

    expect(rootView.boundNames).toEqual(["timestamp"]);
    expect(blockView.boundNames).toEqual(["helper", "timestamp"]);
  });
});
