/**
 * @file Scope-precision tests for deterministic-time body warnings.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import type { Diagnostic, RuleId } from "odw-lint";
import {
  createOriginalSourceFile,
  makeRuleId,
  scanWorkflowEnvelope,
  sliceSourceSpan,
} from "odw-lint";
import { scanDeterministicTimeWarnings } from "../../src/static-analysis/workflow-deterministic-time";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";
import { decodeSpanText, expectSpanToMatchSource } from "./source-span-oracle";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const DEFAULT_META = 'export const meta = { name: "time-check", description: "ok" };';
const DATE_NOW_RULE = makeRuleId("odw/no-date-now");
const MATH_RANDOM_RULE = makeRuleId("odw/no-math-random");
const ARGLESS_NEW_DATE_RULE = makeRuleId("odw/no-argless-new-date");
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

type ScopeCase = {
  readonly body: string;
  readonly rule: RuleId;
  readonly spanText: string;
};

/** Scans a body fragment and returns detector diagnostics plus source context. */
const scanBody = (body: string, label = "deterministic-time-scope") => {
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

/** Returns the single deterministic-time diagnostic or fails with context. */
const expectSingleDiagnostic = (diagnostics: readonly Diagnostic[]): Diagnostic => {
  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0];
  if (diagnostic === undefined) {
    throw new Error("Expected one deterministic-time diagnostic.");
  }

  return diagnostic;
};

/** Asserts a single diagnostic with a source-stable span. */
const expectSingleSpan = (testCase: ScopeCase): void => {
  const { sourceText, sourceFile, diagnostics } = scanBody(testCase.body);
  const diagnostic = expectSingleDiagnostic(diagnostics);

  expect(diagnostic.rule).toBe(testCase.rule);
  expect(decodeSpanText(sourceText, diagnostic.span)).toBe(testCase.spanText);
  expectSpanToMatchSource(sourceText, diagnostic.span, testCase.spanText);
  expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe(testCase.spanText);
};

describe("deterministic-time scope precision", () => {
  it("reports bare globals shadowed only in unrelated scopes", () => {
    for (const testCase of [
      {
        body: "function f(Date) { return Date.now(); }\nconst timestamp = Date.now();",
        rule: DATE_NOW_RULE,
        spanText: "Date.now",
      },
      {
        body: "function g(Math) { return Math.random(); }\nconst sample = Math.random();",
        rule: MATH_RANDOM_RULE,
        spanText: "Math.random",
      },
      {
        body: "function h(Date) { return new Date(); }\nconst started = new Date();",
        rule: ARGLESS_NEW_DATE_RULE,
        spanText: "new Date()",
      },
      {
        body: "function local(Date) { return Date.now(); }\nfunction global() { return Date.now(); }",
        rule: DATE_NOW_RULE,
        spanText: "Date.now",
      },
      {
        body: "const clock = function Date() { return 0; };\nconst timestamp = Date.now();",
        rule: DATE_NOW_RULE,
        spanText: "Date.now",
      },
      {
        body: "const Clock = class Date {};\nconst timestamp = Date.now();",
        rule: DATE_NOW_RULE,
        spanText: "Date.now",
      },
    ] as const) {
      expectSingleSpan(testCase);
    }
  });

  it("keeps nested shadows suppressed when they enclose the use", () => {
    for (const body of [
      "function f(Date) { const timestamp = Date.now(); return timestamp; }",
      "const f = (Math) => Math.random();",
      "const object = { m(Date) { return Date.now(); } };",
      "const C = class Date { m() { return Date.now(); } };",
      "const C = class Math { m() { return Math.random(); } };",
      "const C = class globalThis { m() { return globalThis.Date.now(); } };",
    ]) {
      expect(scanBody(body, "enclosed-scope-shadow").diagnostics).toEqual([]);
    }
  });

  it("keeps object method and accessor shadows out of the enclosing scope", () => {
    for (const body of [
      "const object = { m(Date) { return Date.now(); } };\nconst timestamp = Date.now();",
      "const object = { get x() { const Date = clock(); return Date.now(); } };\nconst timestamp = Date.now();",
      "const object = { set x(Date) { Date.now(); } };\nconst timestamp = Date.now();",
    ]) {
      expectSingleSpan({ body, rule: DATE_NOW_RULE, spanText: "Date.now" });
    }
  });

  it("uses the nearest globalThis scope for chained globals", () => {
    expectSingleSpan({
      body: "function local(globalThis) { return globalThis.Date.now(); }\nconst timestamp = globalThis.Date.now();",
      rule: DATE_NOW_RULE,
      spanText: "globalThis.Date.now",
    });
  });

  it("keeps unrelated-scope Date diagnostics stable for generated identifiers", () => {
    fc.assert(
      fc.property(NON_DATE_IDENTIFIER, (name) => {
        const unrelatedDiagnostics = scanBody(
          `function helper(Date) { return Date.now(); }\nconst ${name} = Date.now();`,
          "generated-unrelated-scope-shadow",
        ).diagnostics;
        const enclosedDiagnostics = scanBody(
          "function helper(Date) { const inner = Date.now(); return inner; }",
          "generated-enclosed-scope-shadow",
        ).diagnostics;

        expect(unrelatedDiagnostics.map((diagnostic) => diagnostic.rule)).toEqual([DATE_NOW_RULE]);
        expect(enclosedDiagnostics).toEqual([]);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("documents block shadows as an enclosing-function conservative limit", () => {
    expect(
      scanBody("{ const Date = createClock(); }\nconst timestamp = Date.now();", "block-shadow")
        .diagnostics,
    ).toEqual([]);
  });
});
