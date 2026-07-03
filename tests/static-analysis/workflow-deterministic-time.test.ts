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
    name: "math-random-call",
    body: "const sample = Math.random();",
    rule: MATH_RANDOM_RULE,
    spanText: "Math.random",
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
] as const satisfies readonly WarningCase[]);

const NEGATIVE_BODIES = Object.freeze([
  "const started = new Date(0);",
  "const started = new Date(args.timestamp);",
  "const readClock = Date.now;",
  "const readRandom = Math.random;",
  'const value = Date["now"]();',
  'const text = "Date.now() Math.random() new Date()";',
  "// Date.now() Math.random() new Date()\nconst ok = true;",
  "/* Date.now() Math.random() new Date() */\nconst ok = true;",
  "const re = /Date\\.now\\(\\)|Math\\.random\\(\\)|new Date\\(\\)/;",
  "const text = `Date.now() Math.random() new Date()`;",
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
});
