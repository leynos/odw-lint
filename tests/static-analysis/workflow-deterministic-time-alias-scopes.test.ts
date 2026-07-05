/**
 * @file Scope-precision tests for deterministic-time aliases.
 */

import { describe, expect, it } from "bun:test";
import type { Module, Node } from "@swc/core";
import * as fc from "fast-check";
import type { Diagnostic } from "odw-lint";
import {
  createOriginalSourceFile,
  makeRuleId,
  scanWorkflowEnvelope,
  sliceSourceSpan,
} from "odw-lint";
import { astChildValues, isAstNode } from "../../src/static-analysis/swc-ast";
import {
  enterScope,
  rootScopeView,
  scopeOwnFacts,
} from "../../src/static-analysis/workflow-ast-scopes";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import { scanDeterministicTimeWarnings } from "../../src/static-analysis/workflow-deterministic-time";
import {
  enterAliasScope,
  enterAliasScopeWithOwnFacts,
  rootAliasView,
} from "../../src/static-analysis/workflow-deterministic-time-aliases";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";
import { decodeSpanText, expectSpanToMatchSource } from "./source-span-oracle";
import { envelopeForBody, expectScannedEnvelope } from "./workflow-envelope-support";

const DEFAULT_META = 'export const meta = { name: "time-check", description: "ok" };';
const DATE_NOW_RULE = makeRuleId("odw/no-date-now");
// Keep generated names simple so the property only probes lexical alias scope,
// not parser edge cases or reserved-word filtering.
const IDENTIFIER_REST_CHARACTER = fc.constantFrom(
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
const NON_DATE_IDENTIFIER = fc
  .tuple(
    fc.constantFrom("a", "b", "c", "x", "y", "z", "_", "$"),
    fc.array(IDENTIFIER_REST_CHARACTER, { maxLength: 8 }),
  )
  .map(([first, rest]) => `${first}${rest.join("")}`);

type AliasScopeCase = {
  readonly body: string;
  readonly spanText: string;
};
type SingleSpanExpectation = ReturnType<typeof scanBody> & {
  readonly diagnostic: Diagnostic;
};
const ALIAS_TEST_RULES = {
  dateNowRule: DATE_NOW_RULE,
  mathRandomRule: makeRuleId("odw/no-math-random"),
} as const;

/** Scans a body fragment and returns detector diagnostics plus source context. */
const scanBody = (body: string, label = "deterministic-time-alias-scope") => {
  const sourceText = `${DEFAULT_META}\n${body}\n`;
  const sourceFile = createOriginalSourceFile({
    filePath: `workflows/${label}.js`,
    sourceText,
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), label);

  return {
    sourceText,
    sourceFile,
    diagnostics: scanDeterministicTimeWarnings(envelope),
  };
};

/** Parses one workflow body and returns its normalized SWC module. */
const moduleForBody = (body: string): Module => {
  const result = parseNormalizedWorkflowBody(envelopeForBody(body));

  if (!result.ok) {
    throw new Error("Expected deterministic-time alias fixture to parse.", { cause: result.error });
  }

  return result.module;
};

/** Returns one AST node by SWC type. */
const nodeOfType = (node: Node, type: string): Node => {
  const match = findNodeOfType(node, type);
  if (match === undefined) {
    throw new Error(`Expected fixture to include ${type} node.`);
  }

  return match;
};

/** Finds one AST node by SWC type. */
const findNodeOfType = (node: Node, type: string): Node | undefined => {
  if (node.type === type) {
    return node;
  }

  for (const child of astChildValues(node)) {
    const match = nodeOfTypeInValue(child, type);
    if (match !== undefined) {
      return match;
    }
  }

  return undefined;
};

/** Returns one AST node from a child value. */
const nodeOfTypeInValue = (value: unknown, type: string): Node | undefined => {
  if (isAstNode(value)) {
    return findNodeOfType(value, type);
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  for (const item of value) {
    const match = nodeOfTypeInValue(item, type);
    if (match !== undefined) {
      return match;
    }
  }

  return undefined;
};

/** Returns the single deterministic-time diagnostic or fails with context. */
const expectSingleDiagnostic = (diagnostics: readonly Diagnostic[]): Diagnostic => {
  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0];
  if (diagnostic === undefined) {
    throw new Error("Expected one deterministic-time alias diagnostic.");
  }

  return diagnostic;
};

/** Asserts a single diagnostic with a source-stable span. */
const expectSingleSpan = (testCase: AliasScopeCase): SingleSpanExpectation => {
  const { sourceText, sourceFile, diagnostics } = scanBody(testCase.body);
  const diagnostic = expectSingleDiagnostic(diagnostics);

  expect(diagnosticShape(diagnostic)).toMatchInlineSnapshot(`
    {
      "docs": "docs/rules/no-date-now.md",
      "file": "workflows/deterministic-time-alias-scope.js",
      "message": "Workflow calls Date.now(), which Claude Code rejects because it breaks deterministic run resumption.",
      "rule": "odw/no-date-now",
      "severity": "warning",
      "suggestions": undefined,
    }
  `);
  expect(diagnostic.rule).toBe(DATE_NOW_RULE);
  expectSpanToMatchSource(sourceText, diagnostic.span, testCase.spanText);
  expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe(testCase.spanText);

  return { sourceText, sourceFile, diagnostics, diagnostic };
};

/** Returns stable diagnostic fields while separate assertions own the span. */
const diagnosticShape = (diagnostic: Diagnostic) => {
  return {
    file: diagnostic.file,
    rule: diagnostic.rule,
    severity: diagnostic.severity,
    message: diagnostic.message,
    docs: diagnostic.docs,
    suggestions: diagnostic.suggestions,
  };
};

describe("deterministic-time alias scope precision", () => {
  it("keeps same-named member aliases isolated to sibling scopes", () => {
    const body =
      "function a() { const now = () => 0; return now(); }\nfunction b() { const now = Date.now; return now(); }";
    const { sourceText, diagnostic } = expectSingleSpan({
      body,
      spanText: "now",
    });
    const bStart = sourceText.indexOf("function b()");

    expect(diagnostic.span.start.offset).toBeGreaterThan(bStart);
  });

  it("suppresses a member alias shadowed at the use site", () => {
    const { diagnostics } = scanBody(
      "const now = Date.now;\nfunction f() { const now = () => 0; return now(); }",
    );

    expect(diagnostics).toEqual([]);
  });

  it("enters alias scopes from precomputed own facts", () => {
    const module = moduleForBody(
      "const now = Date.now;\nfunction helper(now) { const localNow = Date.now; return localNow(); }\nnow();",
    );
    const rootBindings = rootScopeView(module);
    const rootAliases = rootAliasView(module, rootBindings, ALIAS_TEST_RULES);
    const functionNode = nodeOfType(module, "FunctionDeclaration");
    const expressionNode = nodeOfType(module, "ExpressionStatement");
    const functionBindings = enterScope(rootBindings, functionNode);

    expect(
      enterAliasScopeWithOwnFacts(
        rootAliases,
        functionBindings,
        scopeOwnFacts(functionNode),
        ALIAS_TEST_RULES,
      ),
    ).toEqual(enterAliasScope(rootAliases, functionBindings, functionNode, ALIAS_TEST_RULES));
    expect(
      enterAliasScopeWithOwnFacts(
        rootAliases,
        rootBindings,
        scopeOwnFacts(expressionNode),
        ALIAS_TEST_RULES,
      ),
    ).toBe(rootAliases);
  });

  it("suppresses a global-object alias rebound as a sibling parameter", () => {
    const { diagnostics } = scanBody("const D = Date;\nfunction f(D) { return D.now(); }");

    expect(diagnostics).toEqual([]);
  });

  it("keeps aliases visible in descendant scopes", () => {
    expectSingleSpan({
      body: "const now = Date.now;\nfunction f() { return now(); }",
      spanText: "now",
    });
  });

  it("keeps same-scope alias calls reported", () => {
    expectSingleSpan({
      body: "const now = Date.now;\nconst timestamp = now();",
      spanText: "now",
    });
  });

  it("reports member aliases declared in block scopes", () => {
    expectSingleSpan({
      body: "{ const now = Date.now; now(); }",
      spanText: "now",
    });
  });

  it("suppresses parent member aliases shadowed in block scopes", () => {
    const { diagnostics } = scanBody("const now = Date.now;\n{ const now = () => 0; now(); }");

    expect(diagnostics).toEqual([]);
  });

  it("reports member aliases declared in for scopes", () => {
    expectSingleSpan({
      body: "for (const now = Date.now; false;) { now(); }",
      spanText: "now",
    });
  });

  it("suppresses parent member aliases shadowed in for scopes", () => {
    const { diagnostics } = scanBody(
      "const now = Date.now;\nfor (const now = () => 0; false;) { now(); }",
    );

    expect(diagnostics).toEqual([]);
  });

  it("reports member aliases declared in catch scopes", () => {
    expectSingleSpan({
      body: "try { throw 0; } catch (error) { const now = Date.now; now(); }",
      spanText: "now",
    });
  });

  it("suppresses global-object aliases shadowed in catch scopes", () => {
    const { diagnostics } = scanBody(
      "const Clock = Date;\ntry { throw Date; } catch (Clock) { Clock.now(); }",
    );

    expect(diagnostics).toEqual([]);
  });

  it("keeps generated sibling member aliases isolated by scope", () => {
    fc.assert(
      fc.property(NON_DATE_IDENTIFIER, (name) => {
        const body = `function local() { const ${name} = Date.now; return ${name}(); }\nfunction sibling(${name}) { return ${name}(); }`;
        const { sourceText, diagnostics } = scanBody(body, "generated-sibling-alias-scope");
        const diagnostic = expectSingleDiagnostic(diagnostics);
        const siblingStart = sourceText.indexOf("function sibling");

        expect(diagnostic.rule).toBe(DATE_NOW_RULE);
        expect(decodeSpanText(sourceText, diagnostic.span)).toBe(name);
        expect(diagnostic.span.start.offset).toBeLessThan(siblingStart);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});
