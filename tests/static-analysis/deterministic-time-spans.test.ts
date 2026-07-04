/**
 * @file Span snapshots for deterministic-time and randomness diagnostics.
 *
 * The full dual-compatibility parity fixture harness belongs to roadmap 2.3.2.
 * This suite covers detector spans and proves zero false positives on the
 * trusted example corpus for the 3.1.2 warning slice.
 */

import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import type { Diagnostic, RuleId } from "odw-lint";
import {
  createOriginalSourceFile,
  lintWorkflowSource,
  makeRuleId,
  scanDeterministicTimeWarnings,
  scanWorkflowEnvelope,
  sliceSourceSpan,
  snippetForSpan,
} from "odw-lint";
import { readFixtureSource } from "./fixtures/corpus-support";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./fixtures/odw-examples";
import { decodeSpanText, expectSpanToMatchSource } from "./source-span-oracle";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const DEFAULT_META = 'export const meta = { name: "span-check", description: "ok" };';
const DATE_NOW_RULE = makeRuleId("odw/no-date-now");
const MATH_RANDOM_RULE = makeRuleId("odw/no-math-random");
const ARGLESS_NEW_DATE_RULE = makeRuleId("odw/no-argless-new-date");
const FIXTURE_DIRECTORY = new URL("./fixtures/odw-examples/", import.meta.url);
const FIXTURE_CORPUS = { fixtureDirectory: FIXTURE_DIRECTORY } as const;

type RuleSpanCase = {
  readonly rule: RuleId;
  readonly statement: string;
  readonly spanText: string;
};

type SurroundingCase = {
  readonly name: string;
  readonly terminator: string;
  readonly prefix: string;
  readonly suffix: string;
};

type IntraExpressionOrderCase = {
  readonly name: string;
  readonly statement: string;
};

const RULE_SPAN_CASES = Object.freeze([
  {
    rule: DATE_NOW_RULE,
    statement: "const timestamp = Date.now();",
    spanText: "Date.now",
  },
  {
    rule: DATE_NOW_RULE,
    statement: 'const timestamp = Date["now"]();',
    spanText: 'Date["now"]',
  },
  {
    rule: DATE_NOW_RULE,
    statement: "const timestamp = globalThis.Date.now();",
    spanText: "globalThis.Date.now",
  },
  {
    rule: DATE_NOW_RULE,
    statement: "const timestamp = Date?.now();",
    spanText: "Date?.now",
  },
  {
    rule: DATE_NOW_RULE,
    statement: "const now = Date.now;\nconst timestamp = now();",
    spanText: "now",
  },
  {
    rule: MATH_RANDOM_RULE,
    statement: "const sample = Math.random();",
    spanText: "Math.random",
  },
  {
    rule: MATH_RANDOM_RULE,
    statement: "const sample = Math?.random();",
    spanText: "Math?.random",
  },
  {
    rule: MATH_RANDOM_RULE,
    statement: "const random = Math.random;\nconst sample = random();",
    spanText: "random",
  },
  {
    rule: ARGLESS_NEW_DATE_RULE,
    statement: "const started = new Date();",
    spanText: "new Date()",
  },
  {
    rule: ARGLESS_NEW_DATE_RULE,
    statement: "const started = new globalThis.Date();",
    spanText: "new globalThis.Date()",
  },
  {
    rule: ARGLESS_NEW_DATE_RULE,
    statement: "const Clock = Date;\nconst started = new Clock();",
    spanText: "new Clock()",
  },
] as const satisfies readonly RuleSpanCase[]);

const SURROUNDING_CASES = Object.freeze([
  {
    name: "lf-baseline",
    terminator: "\n",
    prefix: "const before = 1;",
    suffix: "const after = before;",
  },
  {
    name: "crlf-terminators",
    terminator: "\r\n",
    prefix: "const before = 1;",
    suffix: "const after = before;",
  },
  {
    name: "unicode-bmp",
    terminator: "\n",
    prefix: "const caf\u00e9 = 1;",
    suffix: "const after = caf\u00e9;",
  },
  {
    name: "unicode-astral",
    terminator: "\n",
    prefix: "const face = '\u{1f600}';",
    suffix: "const after = face;",
  },
] as const satisfies readonly SurroundingCase[]);

const INTRA_EXPRESSION_ORDER_CASES = Object.freeze([
  {
    name: "mixed-array-expression",
    statement: "const hazards = [Math.random(), Date.now(), new Date(Date.now())];",
  },
  {
    name: "nested-new-date-expression",
    statement: [
      "const hazards = `",
      "$",
      "{new Date(Date.now()).toISOString()}-",
      "$",
      "{Math.random()}`;",
    ].join(""),
  },
] as const satisfies readonly IntraExpressionOrderCase[]);

/** Builds a complete workflow source for one span case. */
const sourceTextForCase = (ruleCase: RuleSpanCase, surroundingCase: SurroundingCase): string => {
  return [
    DEFAULT_META,
    surroundingCase.prefix,
    ruleCase.statement,
    surroundingCase.suffix,
    "",
  ].join(surroundingCase.terminator);
};

/** Builds a complete workflow source from one body statement. */
const sourceTextForStatement = (statement: string): string => {
  return [DEFAULT_META, statement, ""].join("\n");
};

/** Returns diagnostics for one focused body statement. */
const diagnosticsForStatement = (
  statement: string,
  label: string,
): { readonly sourceText: string; readonly diagnostics: readonly Diagnostic[] } => {
  const sourceText = sourceTextForStatement(statement);
  const sourceFile = createOriginalSourceFile({
    filePath: `workflows/${label}.js`,
    sourceText,
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), label);

  return { sourceText, diagnostics: scanDeterministicTimeWarnings(envelope) };
};

/** Returns the only diagnostic for one focused detector span case. */
const diagnosticForCase = (
  ruleCase: RuleSpanCase,
  surroundingCase: SurroundingCase,
): { readonly sourceText: string; readonly diagnostic: Diagnostic } => {
  const sourceText = sourceTextForCase(ruleCase, surroundingCase);
  const sourceFile = createOriginalSourceFile({
    filePath: `workflows/${String(ruleCase.rule).replace("odw/", "")}-${surroundingCase.name}.js`,
    sourceText,
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), surroundingCase.name);
  const diagnostics = scanDeterministicTimeWarnings(envelope);

  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0];
  if (diagnostic === undefined) {
    throw new Error("Expected one deterministic-time span diagnostic.");
  }

  return { sourceText, diagnostic };
};

/** Escapes non-ASCII snapshot text so committed snapshots stay portable. */
const asciiJsonString = (value: string): string => {
  return JSON.stringify(value).replaceAll(/[\u007f-\uffff]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
};

/** Captures the reviewer-facing diagnostic span snapshot shape. */
const snapshotForDiagnostic = (diagnostic: Diagnostic, spanText: string) => {
  return {
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    span: diagnostic.span,
    spanText: asciiJsonString(spanText),
  };
};

describe("deterministic-time diagnostic spans", () => {
  it.each(
    RULE_SPAN_CASES.flatMap((ruleCase) => {
      return SURROUNDING_CASES.map((surroundingCase) => [
        `${String(ruleCase.rule)} ${surroundingCase.name}`,
        ruleCase,
        surroundingCase,
      ]);
    }),
  )("round-trips original-source snippets for %s", (_, ruleCase, surroundingCase) => {
    const { sourceText, diagnostic } = diagnosticForCase(ruleCase, surroundingCase);
    const sourceFile = createOriginalSourceFile({ filePath: diagnostic.file, sourceText });
    const oracleText = decodeSpanText(sourceText, diagnostic.span);
    const snippet = snippetForSpan(sourceFile, diagnostic.span);

    expect(diagnostic.rule).toBe(ruleCase.rule);
    expect(diagnostic.severity).toBe("warning");
    expect(oracleText).toBe(ruleCase.spanText);
    expectSpanToMatchSource(sourceText, diagnostic.span, ruleCase.spanText);
    expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe(oracleText);
    expect(snippet.text).toBe(oracleText);
    expect(Buffer.byteLength(sourceText, "utf8")).toBeGreaterThanOrEqual(sourceText.length);
    if (surroundingCase.name === "unicode-bmp" || surroundingCase.name === "unicode-astral") {
      const prefixBeforeSpan = sourceText.slice(0, sourceText.indexOf(ruleCase.spanText));

      expect(Buffer.byteLength(prefixBeforeSpan, "utf8")).toBeGreaterThan(prefixBeforeSpan.length);
    }
    expect(snapshotForDiagnostic(diagnostic, snippet.text)).toMatchSnapshot();
  });

  it.each(
    INTRA_EXPRESSION_ORDER_CASES.map((testCase) => [testCase.name, testCase]),
  )("keeps intra-expression hazard order stable for %s", (_, testCase) => {
    const { sourceText, diagnostics } = diagnosticsForStatement(testCase.statement, testCase.name);
    const sourceFile = createOriginalSourceFile({
      filePath: `workflows/${testCase.name}.js`,
      sourceText,
    });

    expect(
      diagnostics.map((diagnostic) => {
        return snapshotForDiagnostic(diagnostic, sliceSourceSpan(sourceFile, diagnostic.span));
      }),
    ).toMatchSnapshot();
  });

  it("reports no Claude compatibility diagnostics for trusted ODW examples", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fileName);
      const result = lintWorkflowSource({
        filePath: fixture.fixturePath,
        sourceText,
      });

      expect(result.claudeCompatibility).toEqual([]);
    }
  });
});
