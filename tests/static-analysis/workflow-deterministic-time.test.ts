/**
 * @file Focused tests for deterministic-time and randomness body warnings.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import type { Diagnostic, RuleId, WorkflowEnvelope } from "odw-lint";
import {
  createOriginalSourceFile,
  firstReviewedRuleMessage,
  makeRuleId,
  ruleDefinitionFor,
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
const SAFE_CONTEXT_FRAGMENT = fc.constantFrom(
  "",
  "\n",
  "  ",
  "\n// inert Date.now()\n",
  "\n/* inert Math.random() */\n",
);
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
const VALID_IDENTIFIER = fc.oneof(
  fc.constant("Date"),
  fc
    .tuple(
      fc.constantFrom("a", "b", "c", "x", "y", "z", "_", "$"),
      fc.array(IDENTIFIER_REST_CHARACTER, { maxLength: 8 }),
    )
    .map(([first, rest]) => `${first}${rest.join("")}`),
);
const DATE_BINDING_STATEMENT = fc.constantFrom(
  "const Date = createClock();",
  "let Date = createClock();",
  "var Date = createClock();",
  "function Date() { return createClock(); }",
  "const { Date } = createClock();",
  "const [Date] = createClocks();",
);

type WarningCase = {
  readonly name: string;
  readonly body: string;
  readonly rule: RuleId;
  readonly spanText: string;
};

const POSITIVE_CASES = Object.freeze([
  {
    name: "date-now-call",
    body: "const timestamp = Date.now();",
    rule: DATE_NOW_RULE,
    spanText: "Date.now",
  },
  {
    name: "computed-date-now-call",
    body: 'const timestamp = Date["now"]();',
    rule: DATE_NOW_RULE,
    spanText: 'Date["now"]',
  },
  {
    name: "global-date-now-call",
    body: "const timestamp = globalThis.Date.now();",
    rule: DATE_NOW_RULE,
    spanText: "globalThis.Date.now",
  },
  {
    name: "optional-date-now-call",
    body: "const timestamp = Date?.now();",
    rule: DATE_NOW_RULE,
    spanText: "Date?.now",
  },
  {
    name: "global-optional-date-now-call",
    body: "const timestamp = globalThis.Date?.now();",
    rule: DATE_NOW_RULE,
    spanText: "globalThis.Date?.now",
  },
  {
    name: "date-now-alias-call",
    body: "const now = Date.now;\nconst timestamp = now();",
    rule: DATE_NOW_RULE,
    spanText: "now",
  },
  {
    name: "date-object-alias-call",
    body: "const Clock = Date;\nconst timestamp = Clock.now();",
    rule: DATE_NOW_RULE,
    spanText: "Clock.now",
  },
  {
    name: "computed-global-date-now-call",
    body: 'const timestamp = globalThis["Date"]["now"]();',
    rule: DATE_NOW_RULE,
    spanText: 'globalThis["Date"]["now"]',
  },
  {
    name: "math-random-call",
    body: "const sample = Math.random();",
    rule: MATH_RANDOM_RULE,
    spanText: "Math.random",
  },
  {
    name: "computed-math-random-call",
    body: 'const sample = Math["random"]();',
    rule: MATH_RANDOM_RULE,
    spanText: 'Math["random"]',
  },
  {
    name: "global-math-random-call",
    body: "const sample = globalThis.Math.random();",
    rule: MATH_RANDOM_RULE,
    spanText: "globalThis.Math.random",
  },
  {
    name: "optional-math-random-call",
    body: "const sample = Math?.random();",
    rule: MATH_RANDOM_RULE,
    spanText: "Math?.random",
  },
  {
    name: "math-random-alias-call",
    body: "const random = Math.random;\nconst sample = random();",
    rule: MATH_RANDOM_RULE,
    spanText: "random",
  },
  {
    name: "math-object-alias-call",
    body: "const Random = Math;\nconst sample = Random.random();",
    rule: MATH_RANDOM_RULE,
    spanText: "Random.random",
  },
  {
    name: "argless-new-date-call",
    body: "const started = new Date();",
    rule: ARGLESS_NEW_DATE_RULE,
    spanText: "new Date()",
  },
  {
    name: "argless-new-date-without-parens",
    body: "const started = new Date;",
    rule: ARGLESS_NEW_DATE_RULE,
    spanText: "new Date",
  },
  {
    name: "argless-new-global-date-call",
    body: "const started = new globalThis.Date();",
    rule: ARGLESS_NEW_DATE_RULE,
    spanText: "new globalThis.Date()",
  },
  {
    name: "argless-new-date-alias-call",
    body: "const Clock = Date;\nconst started = new Clock();",
    rule: ARGLESS_NEW_DATE_RULE,
    spanText: "new Clock()",
  },
] as const satisfies readonly WarningCase[]);

const NEGATIVE_BODIES = Object.freeze([
  "const started = new Date(0);",
  "const started = new Date(args.timestamp);",
  "const readClock = Date.now;",
  "const readRandom = Math.random;",
  "const value = window.Date.now();",
  "const value = self.Date.now();",
  'const k = "now";\nDate[k]();',
  'const now = "now";\nDate[now]();',
  'const random = "random";\nMath[random]();',
  'const text = "Date.now() Math.random() new Date()";',
  "// Date.now() Math.random() new Date()\nconst ok = true;",
  "/* Date.now() Math.random() new Date() */\nconst ok = true;",
  "const re = /Date\\.now\\(\\)|Math\\.random\\(\\)|new Date\\(\\)/;",
  "const text = `Date.now() Math.random() new Date()`;",
] as const);

const SHADOW_NEGATIVE_BODIES = Object.freeze([
  "const Date = createClock();\nconst timestamp = Date.now();",
  "let Date = createClock();\nconst started = new Date();",
  "var Date = createClock();\nconst timestamp = Date.now();",
  "function Date() { return createClock(); }\nconst started = new Date();",
  "function readClock(Date) { return Date.now(); }",
  "const { Date } = createClock();\nconst timestamp = Date.now();",
  "const [Date] = createClocks();\nconst started = new Date();",
  "try { throw createClock(); } catch (Date) { Date.now(); }",
  "const Math = createRandom();\nconst sample = Math.random();",
  "let Math = createRandom();\nconst sample = Math.random();",
  "var Math = createRandom();\nconst sample = Math.random();",
  "function Math() { return createRandom(); }\nconst sample = Math.random();",
  "function sample(Math) { return Math.random(); }",
  "const { Math } = createRandom();\nconst sample = Math.random();",
  "const [Math] = createRandoms();\nconst sample = Math.random();",
  "try { throw createRandom(); } catch (Math) { Math.random(); }",
] as const);

/** Builds a complete workflow source from a body fragment. */
const sourceTextForBody = (body: string): string => {
  return `${DEFAULT_META}\n${body}\n`;
};

/** Scans a body fragment and returns detector diagnostics plus source context. */
const scanBody = (body: string, label = "deterministic-time") => {
  const sourceText = sourceTextForBody(body);
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

/** Returns the first deterministic-time diagnostic or fails with context. */
const expectSingleDiagnostic = (diagnostics: readonly Diagnostic[]): Diagnostic => {
  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0];
  if (diagnostic === undefined) {
    throw new Error("Expected one deterministic-time diagnostic.");
  }

  return diagnostic;
};

/** Asserts the fixed catalogue message for one rule. */
const expectCataloguedMessage = (diagnostic: Diagnostic): void => {
  expect(diagnostic.message).toBe(firstReviewedRuleMessage(ruleDefinitionFor(diagnostic.rule)));
};

/** Returns only rule identifiers from diagnostics for compact assertions. */
const diagnosticRules = (diagnostics: readonly Diagnostic[]): readonly RuleId[] => {
  return diagnostics.map((diagnostic) => diagnostic.rule);
};

describe("scanDeterministicTimeWarnings", () => {
  it.each(
    POSITIVE_CASES.map((testCase) => [testCase.name, testCase]),
  )("reports %s with an original-source span", (_, testCase) => {
    const { sourceText, sourceFile, diagnostics } = scanBody(testCase.body, testCase.name);
    const diagnostic = expectSingleDiagnostic(diagnostics);

    expect(diagnostic.rule).toBe(testCase.rule);
    expect(diagnostic.severity).toBe("warning");
    expectCataloguedMessage(diagnostic);
    expect(decodeSpanText(sourceText, diagnostic.span)).toBe(testCase.spanText);
    expectSpanToMatchSource(sourceText, diagnostic.span, testCase.spanText);
    expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe(testCase.spanText);
  });

  it("ignores non-matching syntax and inert decoys", () => {
    for (const body of NEGATIVE_BODIES) {
      expect(scanBody(body, "negative").diagnostics).toEqual([]);
    }
  });

  it("collects deterministic-time aliases from nested blocks", () => {
    const { sourceText, sourceFile, diagnostics } = scanBody(
      "if (args.ready) {\n  const now = Date.now;\n  const timestamp = now();\n}",
      "nested-alias",
    );
    const diagnostic = expectSingleDiagnostic(diagnostics);

    expect(diagnostic.rule).toBe(DATE_NOW_RULE);
    expect(decodeSpanText(sourceText, diagnostic.span)).toBe("now");
    expectSpanToMatchSource(sourceText, diagnostic.span, "now");
    expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe("now");
  });

  it("visits hazards nested inside argument wrapper records and arrays", () => {
    const { sourceText, sourceFile, diagnostics } = scanBody(
      "const timestamp = consume(Date.now());",
      "argument-wrapper",
    );
    const diagnostic = expectSingleDiagnostic(diagnostics);

    expect(diagnostic.rule).toBe(DATE_NOW_RULE);
    expect(decodeSpanText(sourceText, diagnostic.span)).toBe("Date.now");
    expectSpanToMatchSource(sourceText, diagnostic.span, "Date.now");
    expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe("Date.now");
  });

  it("ignores bare deterministic-time globals when lexical bindings shadow them", () => {
    for (const body of SHADOW_NEGATIVE_BODIES) {
      expect(scanBody(body, "shadow-negative").diagnostics).toEqual([]);
    }
  });

  it("ignores globalThis chains when globalThis is lexically bound", () => {
    const { diagnostics } = scanBody(
      "const globalThis = fakeGlobal;\nconst timestamp = globalThis.Date.now();",
      "global-this-shadow",
    );

    expect(diagnostics).toEqual([]);
  });

  it("reports globalThis chains when the named global is lexically bound", () => {
    const { sourceText, sourceFile, diagnostics } = scanBody(
      "const Date = createClock();\nconst timestamp = globalThis.Date.now();",
      "global-this-cross-shadow",
    );
    const diagnostic = expectSingleDiagnostic(diagnostics);

    expect(diagnostic.rule).toBe(DATE_NOW_RULE);
    expect(decodeSpanText(sourceText, diagnostic.span)).toBe("globalThis.Date.now");
    expectSpanToMatchSource(sourceText, diagnostic.span, "globalThis.Date.now");
    expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe("globalThis.Date.now");
  });

  it("emits diagnostics in source order", () => {
    const { diagnostics } = scanBody(
      [
        "const timestamp = Date.now();",
        "const sample = Math.random();",
        "const started = new Date();",
      ].join("\n"),
      "source-order",
    );

    expect(diagnostics.map((diagnostic) => diagnostic.rule)).toEqual([
      DATE_NOW_RULE,
      MATH_RANDOM_RULE,
      ARGLESS_NEW_DATE_RULE,
    ]);
  });

  it("does not report when parsing fails", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflows/syntax-error.js",
      sourceText: `${DEFAULT_META}\nif (args.ready) {\n`,
    });
    const envelope: WorkflowEnvelope = expectScannedEnvelope(
      scanWorkflowEnvelope(sourceFile),
      "syntax-error",
    );

    expect(scanDeterministicTimeWarnings(envelope)).toEqual([]);
  });

  it("keeps Date.now() spans stable around benign context", () => {
    fc.assert(
      fc.property(SAFE_CONTEXT_FRAGMENT, SAFE_CONTEXT_FRAGMENT, (prefix, suffix) => {
        const body = `${prefix}const timestamp = Date.now();${suffix}`;
        const { sourceFile, diagnostics } = scanBody(body, "property-context");
        const diagnostic = expectSingleDiagnostic(diagnostics);

        expect(diagnostic.rule).toBe(DATE_NOW_RULE);
        expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe("Date.now");
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("keeps shadow and globalThis decisions stable for generated bindings", () => {
    fc.assert(
      fc.property(VALID_IDENTIFIER, DATE_BINDING_STATEMENT, (name, dateBinding) => {
        const bareMemberDiagnostics = scanBody(
          `const ${name} = 1;\nconst value = ${name}.now();`,
          "generated-binding",
        ).diagnostics;
        const dateDiagnostics = scanBody(
          `${dateBinding}\nconst local = Date.now();\nconst global = globalThis.Date.now();`,
          "generated-date-binding",
        ).diagnostics;

        if (name === "Date") {
          expect(bareMemberDiagnostics).toEqual([]);
        }
        expect(diagnosticRules(dateDiagnostics)).toEqual([DATE_NOW_RULE]);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});
