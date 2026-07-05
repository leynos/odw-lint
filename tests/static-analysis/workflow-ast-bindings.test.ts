/**
 * @file Tests for workflow AST lexical binding facts.
 */

import { describe, expect, it } from "bun:test";
import type { Module, Node } from "@swc/core";
import { parseSync } from "@swc/core";
import * as fc from "fast-check";
import { createOriginalSourceFile, scanWorkflowEnvelope } from "odw-lint";
import { astChildValues, isAstNode } from "../../src/static-analysis/swc-ast";
import {
  collectLexicalBindings,
  isIdentifierBound,
} from "../../src/static-analysis/workflow-ast-bindings";
import { rootScopeOwnFacts, scopeOwnFacts } from "../../src/static-analysis/workflow-ast-scopes";
import { WORKFLOW_BODY_WRAP_FUNCTION_NAME } from "../../src/static-analysis/workflow-body-normalizer";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const GLOBAL_HELPER_NAMES = ["parallel", "Array", "Number", "Object", "Math"] as const;
const IDENTIFIER_PROPERTY_RUNNER = { numRuns: 100 } as const;
const BODY_BY_BINDING_KIND = {
  const: (name: string) => `const ${name} = 1;\n`,
  let: (name: string) => `let ${name} = 1;\n`,
  var: (name: string) => `var ${name} = 1;\n`,
  "function declaration": (name: string) => `function ${name}() {}\n`,
  "function parameter": (name: string) => `function helper(${name}) {}\n`,
  "object destructure": (name: string) => `const { value: ${name} } = source;\n`,
  "array destructure": (name: string) => `const [${name}] = source;\n`,
  "default parameter": (name: string) => `function helper(${name} = 1) {}\n`,
  "catch parameter": (name: string) => `try {} catch (${name}) {}\n`,
} as const;

/** Parses one workflow body and returns its normalized SWC module. */
const moduleForBody = (body: string): Module => {
  const sourceFile = createOriginalSourceFile({
    filePath: "workflows/bindings.js",
    sourceText: `export const meta = { name: "bindings", description: "ok" };\n${body}`,
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), sourceFile.filePath);
  const result = parseNormalizedWorkflowBody(envelope);

  if (!result.ok) {
    throw new Error("Expected binding fixture body to parse.", { cause: result.error });
  }

  return result.module;
};

/** Builds lexical binding facts for one body snippet. */
const bindingsForBody = (body: string) => {
  return collectLexicalBindings(moduleForBody(body));
};

/** Produces a small body that binds one name through a specific syntax form. */
const bodyBindingName = (name: string, bindingKind: keyof typeof BODY_BY_BINDING_KIND): string => {
  return BODY_BY_BINDING_KIND[bindingKind](name);
};

/** Returns all names owned by any scope in one parsed module. */
const scopeOwnedNamesAcrossAst = (module: Module): ReadonlySet<string> => {
  const names = new Set(rootScopeOwnFacts(module).ownNames);
  collectScopeOwnedNames(module, names);

  return names;
};

/** Collects names from every scope-opening node below `node`. */
const collectScopeOwnedNames = (node: Node, names: Set<string>): void => {
  for (const name of scopeOwnFacts(node).ownNames) {
    names.add(name);
  }

  for (const child of astChildValues(node)) {
    collectScopeOwnedNamesFromValue(child, names);
  }
};

/** Collects scope-owned names from one AST child value. */
const collectScopeOwnedNamesFromValue = (value: unknown, names: Set<string>): void => {
  if (isAstNode(value)) {
    collectScopeOwnedNames(value, names);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectScopeOwnedNamesFromValue(item, names);
    }
  }
};

describe("collectLexicalBindings", () => {
  for (const name of GLOBAL_HELPER_NAMES) {
    for (const bindingKind of [
      "const",
      "let",
      "var",
      "function declaration",
      "function parameter",
      "object destructure",
      "array destructure",
      "default parameter",
      "catch parameter",
    ] as const) {
      it(`reports ${name} when bound by ${bindingKind}`, () => {
        expect(
          isIdentifierBound(bindingsForBody(bodyBindingName(name, bindingKind)), name),
        ).toBeTrue();
      });
    }
  }

  for (const [label, body, name] of [
    ["member-expression object", "Math.random();\n", "Math"],
    ["parallel call", "parallel(items);\n", "parallel"],
    ["Array static call", "const y = Array.from(items);\n", "Array"],
    ["default-value reference", "function f(x = Math.max(1, 2)) {}\n", "Math"],
    ["computed object key", "const { [Math]: z } = source;\n", "Math"],
    ["accessor body reference", "const o = { set value(_) { Math.random(); } };\n", "Math"],
  ] as const) {
    it(`does not report reference-only ${name} from ${label}`, () => {
      expect(isIdentifierBound(bindingsForBody(body), name)).toBeFalse();
    });
  }

  it("excludes the synthetic workflow body wrapper name", () => {
    const facts = bindingsForBody("const parallel = 1;\nfunction h() {}\n");

    expect(isIdentifierBound(facts, WORKFLOW_BODY_WRAP_FUNCTION_NAME)).toBeFalse();
    expect(facts.boundNames).not.toContain(WORKFLOW_BODY_WRAP_FUNCTION_NAME);
  });

  it("reports exactly the user-declared names for a representative body", () => {
    const facts = bindingsForBody("const a = 1;\nfunction b() {}\nconst { c } = source;\n");

    expect(facts.boundNames).toEqual(["a", "b", "c"]);
    expect(Object.isFrozen(facts)).toBeTrue();
    expect(Object.isFrozen(facts.boundNames)).toBeTrue();
  });

  it("reports class constructor and method parameter bindings", () => {
    const facts = bindingsForBody(
      "class C { constructor({ ctor }) {} method([method]) {} #secret(secret = 1) {} }\n",
    );

    expect(isIdentifierBound(facts, "ctor")).toBeTrue();
    expect(isIdentifierBound(facts, "method")).toBeTrue();
    expect(isIdentifierBound(facts, "secret")).toBeTrue();
  });

  it("reports object-literal setter and method parameter bindings", () => {
    const facts = bindingsForBody(
      "const o = { get gv() { const getterLocal = 1; }, set value(setterParam) { const setterLocal = setterParam; }, method(methodParam) { return methodParam; } };\n",
    );

    expect(isIdentifierBound(facts, "setterParam")).toBeTrue();
    expect(isIdentifierBound(facts, "methodParam")).toBeTrue();
    expect(isIdentifierBound(facts, "getterLocal")).toBeTrue();
    expect(isIdentifierBound(facts, "setterLocal")).toBeTrue();
    expect(isIdentifierBound(facts, "value")).toBeFalse();
    expect(isIdentifierBound(facts, "method")).toBeFalse();
    expect(isIdentifierBound(facts, "gv")).toBeFalse();
  });

  it("keeps bindings from array-valued patterns and class bodies", () => {
    const facts = bindingsForBody(
      "const [arrayName] = source;\nconst { value: objectName } = source;\nclass C { constructor({ ctor }) {} method([method]) {} }\n",
    );

    expect(facts.boundNames).toEqual(["C", "arrayName", "ctor", "method", "objectName"]);
  });

  it("reports nested function locals in the conservative name set", () => {
    const facts = bindingsForBody("function outer() { const inner = 1; }\n");

    expect(isIdentifierBound(facts, "outer")).toBeTrue();
    expect(isIdentifierBound(facts, "inner")).toBeTrue();
  });

  it("reports declarations nested inside default initializers", () => {
    const facts = bindingsForBody(
      "function helper(value = function nestedDefault() {}) {}\nconst { item = function nestedProperty() {} } = source;\n",
    );

    expect(isIdentifierBound(facts, "nestedDefault")).toBeTrue();
    expect(isIdentifierBound(facts, "nestedProperty")).toBeTrue();
  });

  it("reports bindings under fallback control-flow nodes", () => {
    const facts = bindingsForBody("if (condition) { const fallbackName = 1; }\n");

    expect(isIdentifierBound(facts, "fallbackName")).toBeTrue();
    expect(isIdentifierBound(facts, "condition")).toBeFalse();
  });

  it("falls back to top-level module statements without the synthetic wrapper", () => {
    const module = parseSync("const rawBinding = 1;", {
      syntax: "ecmascript",
    });
    const facts = collectLexicalBindings(module);

    expect(isIdentifierBound(facts, "rawBinding")).toBeTrue();
  });

  it("reports every generated const binding name", () => {
    const identifierRestCharacter = fc.constantFrom(
      "a",
      "b",
      "c",
      "x",
      "y",
      "z",
      "A",
      "B",
      "C",
      "0",
      "1",
      "2",
      "_",
    );
    const identifier = fc
      .tuple(
        fc.constantFrom("a", "b", "c", "x", "y", "z"),
        fc.array(identifierRestCharacter, { maxLength: 8 }),
      )
      .map(([first, rest]) => `${first}${rest.join("")}`);

    fc.assert(
      fc.property(identifier, (name) => {
        const facts = bindingsForBody(`const ${name} = 1;\n`);
        expect(isIdentifierBound(facts, name)).toBeTrue();
      }),
      IDENTIFIER_PROPERTY_RUNNER,
    );
  });

  it("matches scope-owned facts for generated member parameter names", () => {
    const identifierSuffix = fc
      .array(fc.constantFrom("a", "b", "c", "x", "y", "z", "A", "B", "C", "0", "1", "2", "_"), {
        maxLength: 8,
      })
      .map((characters) => characters.join(""));

    fc.assert(
      fc.property(identifierSuffix, identifierSuffix, identifierSuffix, (setter, method, klass) => {
        const parameterNames = [`setter${setter}`, `method${method}`, `klass${klass}`];
        const module = moduleForBody(
          `const object = { set value(${parameterNames[0]}) {}, method(${parameterNames[1]}) {} };\nclass C { method(${parameterNames[2]}) {} }\n`,
        );
        const flatBindingNames = new Set(collectLexicalBindings(module).boundNames);
        const scopeOwnedNames = scopeOwnedNamesAcrossAst(module);

        expect(
          parameterNames.filter((name) => {
            return flatBindingNames.has(name);
          }),
        ).toEqual(
          parameterNames.filter((name) => {
            return scopeOwnedNames.has(name);
          }),
        );
        for (const name of parameterNames) {
          expect(flatBindingNames.has(name)).toBeTrue();
        }
      }),
      IDENTIFIER_PROPERTY_RUNNER,
    );
  });
});
