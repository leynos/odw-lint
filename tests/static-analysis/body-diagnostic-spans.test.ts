/**
 * @file Parser-backed diagnostic span snapshot tests.
 */

import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import {
  createOriginalSourceFile,
  makeRuleId,
  parseWorkflowBody,
  scanWorkflowEnvelope,
  sliceSourceSpan,
  snippetForSpan,
  type WorkflowBodyParseResult,
} from "odw-lint";
import { decodeSpanText, expectSpanToMatchSource } from "./source-span-oracle";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const DEFAULT_META = 'export const meta = { name: "span-snapshot", description: "ok" };';
const BODY_SYNTAX_RULE = makeRuleId("odw/body-syntax");
const TEMPLATE_INTERPOLATION_BODY = "const t = `hi $" + "{name}`;\nif (args.ready) {\n";
const BODY_DIAGNOSTIC_SPAN_CASES = Object.freeze([
  {
    name: "lf-baseline",
    terminator: "\n",
    body: "const caf\u00e9 = 1;\nif (args.ready) {\n",
  },
  {
    name: "crlf-terminators",
    terminator: "\r\n",
    body: "const caf\u00e9 = 1;\r\nif (args.ready) {\r\n",
  },
  {
    name: "unicode-bmp",
    terminator: "\n",
    body: "const d\u00e9cor = caf\u00e9;\nif (args.ready) {\n",
  },
  {
    name: "unicode-astral",
    terminator: "\n",
    body: "const s = '\u{1f600}';\nif (args.ready) {\n",
  },
  {
    name: "line-comment",
    terminator: "\n",
    body: "// draft note\nif (args.ready) {\n",
  },
  {
    name: "block-comment",
    terminator: "\n",
    body: "/* multi\n   line */\nif (args.ready) {\n",
  },
  {
    name: "regex-literal",
    terminator: "\n",
    body: "const re = /ab+c\\/d/g;\nif (args.ready) {\n",
  },
  {
    name: "template-text",
    terminator: "\n",
    body: "const t = `plain text`;\nif (args.ready) {\n",
  },
  {
    name: "template-interpolation",
    terminator: "\n",
    body: TEMPLATE_INTERPOLATION_BODY,
  },
] as const);

type BodyDiagnosticSpanCase = (typeof BODY_DIAGNOSTIC_SPAN_CASES)[number];
type BodySyntaxDiagnostic = Extract<WorkflowBodyParseResult, { readonly ok: false }>["diagnostic"];

/** Builds a workflow source text for one parser-backed diagnostic case. */
const sourceTextForCase = (diagnosticCase: BodyDiagnosticSpanCase): string => {
  return `${DEFAULT_META}${diagnosticCase.terminator}${diagnosticCase.body}`;
};

/** Returns the independently expected whole-body snippet for a case. */
const expectedSpanTextForCase = (diagnosticCase: BodyDiagnosticSpanCase): string => {
  return `${diagnosticCase.terminator}${diagnosticCase.body}`;
};

/** Requires a syntax diagnostic result for focused span assertions. */
const expectBodySyntaxDiagnostic = (result: WorkflowBodyParseResult): BodySyntaxDiagnostic => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected body parser to return a syntax diagnostic.");
  }

  expect(result.diagnostic.rule).toBe(BODY_SYNTAX_RULE);
  expect(result.diagnostic.severity).toBe("error");

  return result.diagnostic;
};

/** Escapes non-ASCII snapshot text so committed snapshots stay portable. */
const asciiJsonString = (value: string): string => {
  return JSON.stringify(value).replaceAll(/[\u007f-\uffff]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
};

/** Captures the reviewer-facing diagnostic span snapshot shape. */
const snapshotForDiagnostic = (diagnostic: BodySyntaxDiagnostic, spanText: string) => {
  return {
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    span: diagnostic.span,
    spanText: asciiJsonString(spanText),
  };
};

/** Checks Unicode-specific width properties for cases that target them. */
const expectUnicodeWidthProperties = (
  diagnosticCase: BodyDiagnosticSpanCase,
  diagnostic: BodySyntaxDiagnostic,
  expectedSpanText: string,
): void => {
  if (diagnosticCase.name === "unicode-bmp") {
    const spanByteWidth = diagnostic.span.end.offset - diagnostic.span.start.offset;

    expect(spanByteWidth).toBe(Buffer.byteLength(expectedSpanText, "utf8"));
    expect(spanByteWidth).toBeGreaterThan(expectedSpanText.length);
  }

  if (diagnosticCase.name === "unicode-astral") {
    const firstBodyLine = diagnosticCase.body.split("\n")[0] ?? "";

    expect(Array.from(firstBodyLine).length).toBeLessThan(firstBodyLine.length);
    expect(Buffer.byteLength(expectedSpanText, "utf8")).toBeGreaterThan(expectedSpanText.length);
  }
};

describe("parser-backed diagnostic spans", () => {
  it.each(
    BODY_DIAGNOSTIC_SPAN_CASES.map((diagnosticCase) => [diagnosticCase.name, diagnosticCase]),
  )("round-trips original-source snippets for %s", (_, diagnosticCase) => {
    const sourceText = sourceTextForCase(diagnosticCase);
    const sourceFile = createOriginalSourceFile({
      filePath: `workflows/${diagnosticCase.name}.js`,
      sourceText,
    });
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), diagnosticCase.name);
    const diagnostic = expectBodySyntaxDiagnostic(parseWorkflowBody(envelope));
    const oracleText = decodeSpanText(sourceText, diagnostic.span);
    const expectedSpanText = expectedSpanTextForCase(diagnosticCase);
    const snippet = snippetForSpan(sourceFile, diagnostic.span);

    expect(oracleText).toBe(expectedSpanText);
    expectSpanToMatchSource(sourceText, diagnostic.span, expectedSpanText);
    expectUnicodeWidthProperties(diagnosticCase, diagnostic, expectedSpanText);
    expect(sliceSourceSpan(sourceFile, diagnostic.span)).toBe(oracleText);
    expect(snippet.text).toBe(oracleText);
    expect(snapshotForDiagnostic(diagnostic, snippet.text)).toMatchSnapshot();
  });
});
