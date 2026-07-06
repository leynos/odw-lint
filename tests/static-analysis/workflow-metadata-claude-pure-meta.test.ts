/**
 * @file Claude pure-literal metadata compatibility tests.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import { sliceSourceSpan } from "../../src/static-analysis/source-snippet";
import { scanWorkflowEnvelope } from "../../src/static-analysis/workflow-envelope";
import { classifyWorkflowMetadata } from "../../src/static-analysis/workflow-metadata";

const CLAUDE_PURE_META_MESSAGE =
  "Workflow metadata is not a pure literal, which Claude Code rejects because its static workflow reader cannot evaluate computed metadata.";
const META_STATICALLY_UNPROVABLE_MESSAGE =
  "Workflow metadata must remain statically provable without evaluation.";

/** Creates an original source record for inline workflow source. */
const sourceFileFor = (sourceText: string) =>
  createOriginalSourceFile({ filePath: "fixtures/workflow.js", sourceText });

/** Slices source text for a diagnostic span produced from the same source. */
const spanText = (sourceText: string, span: Parameters<typeof sliceSourceSpan>[1]) =>
  sliceSourceSpan(sourceFileFor(sourceText), span);

/** Returns compact diagnostic facts used by classifier assertions. */
const diagnosticSummary = (sourceText: string) => {
  const sourceFile = sourceFileFor(sourceText);
  const classification = classifyWorkflowMetadata(scanWorkflowEnvelope(sourceFile));

  return classification.diagnostics.map((diagnostic) => ({
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    message: diagnostic.message,
    spanText: spanText(sourceText, diagnostic.span),
  }));
};

describe("Claude pure-literal metadata compatibility", () => {
  it("accepts fully pure-literal metadata without diagnostics", () => {
    expect(
      diagnosticSummary('export const meta = { name: "n", description: "d", tags: ["a", "b"] };'),
    ).toEqual([]);
  });

  for (const [description, sourceText, expectedSpanText] of [
    [
      "numeric subtraction",
      'export const meta = { name: "n", description: "d", retries: 1 - 2 };',
      "1 - 2",
    ],
    [
      "numeric multiplication",
      'export const meta = { name: "n", description: "d", timeout: 30 * 1000 };',
      "30 * 1000",
    ],
    [
      "string concatenation in an array",
      'export const meta = { name: "n", description: "d", tags: ["a" + "b"] };',
      '"a" + "b"',
    ],
    [
      "closed computed key",
      'export const meta = { name: "n", description: "d", [("a" + "b")]: "x" };',
      '[("a" + "b")]',
    ],
  ] as const) {
    it(`emits Claude pure-metadata diagnostics for ${description}`, () => {
      expect(diagnosticSummary(sourceText)).toEqual([
        {
          rule: "odw/claude-pure-meta",
          severity: "warning",
          message: CLAUDE_PURE_META_MESSAGE,
          spanText: expectedSpanText,
        },
      ]);
    });
  }

  for (const [description, sourceText, expectedSpanText] of [
    [
      "free identifier object-literal metadata",
      'export const meta = { name: "n", description: "d", phases: [{ title: helper }] };',
      "helper",
    ],
    [
      "throwing IIFE object-literal metadata",
      'export const meta = { name: "n", description: "d", phases: [{ title: (() => { throw new Error("x"); })() }] };',
      '(() => { throw new Error("x"); })()',
    ],
    [
      "free identifier computed key",
      'export const meta = { name: "n", description: "d", [key]: "d" };',
      "[key]",
    ],
    [
      "BigInt arithmetic",
      'export const meta = { name: "n", description: "d", retries: 1n / 0n };',
      "1n / 0n",
    ],
    [
      "computed description",
      'export const meta = { name: "n", description: "a" + "b" };',
      '"a" + "b"',
    ],
    ["computed name", 'export const meta = { name: getName(), description: "d" };', "getName()"],
    [
      "unaccepted string atom",
      'export const meta = { name: "n", description: "d", label: "\\u0064" };',
      '"\\u0064"',
    ],
  ] as const) {
    it(`keeps ${description} statically unprovable`, () => {
      expect(diagnosticSummary(sourceText)).toEqual([
        {
          rule: "odw/meta-statically-unprovable",
          severity: "warning",
          message: META_STATICALLY_UNPROVABLE_MESSAGE,
          spanText: expectedSpanText,
        },
      ]);
    });
  }
});
