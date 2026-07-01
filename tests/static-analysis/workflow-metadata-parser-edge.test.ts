/**
 * @file Edge-case tests for the workflow metadata literal parser.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import { sliceSourceSpan } from "../../src/static-analysis/source-snippet";
import { scanWorkflowEnvelope } from "../../src/static-analysis/workflow-envelope";
import {
  type ParsedMetadataValue,
  parseWorkflowMetadataLiteral,
} from "../../src/static-analysis/workflow-metadata";

/** Creates an original source record for inline workflow source. */
const sourceFileFor = (sourceText: string) =>
  createOriginalSourceFile({ filePath: "fixtures/workflow.js", sourceText });

/** Parses metadata from inline workflow source. */
const parseSource = (sourceText: string) =>
  parseWorkflowMetadataLiteral(scanWorkflowEnvelope(sourceFileFor(sourceText)));

/** Slices source text for a diagnostic span produced from the same source. */
const spanText = (sourceText: string, span: Parameters<typeof sliceSourceSpan>[1]) =>
  sliceSourceSpan(sourceFileFor(sourceText), span);

/** Returns a recursive reviewer-friendly value shape for parser snapshots. */
const parsedValueSummary = (value: ParsedMetadataValue): unknown => {
  if (value.kind === "primitive") {
    return { kind: value.kind, value: value.value };
  }
  if (value.kind === "array") {
    return { kind: value.kind, items: value.items.map(parsedValueSummary) };
  }
  return {
    kind: value.kind,
    properties: value.properties.map((property) => ({
      key: property.key,
      value: parsedValueSummary(property.value),
    })),
  };
};

/** Returns a compact parser result shape for snapshot assertions. */
const parserOutcomeSummary = (sourceText: string): unknown => {
  const result = parseSource(sourceText);
  if (result.status === "not-statically-provable") {
    return {
      status: result.status,
      spanText: spanText(sourceText, result.span),
    };
  }

  return {
    status: result.status,
    properties: result.facts.properties.map((property) => ({
      key: property.key,
      value: parsedValueSummary(property.value),
    })),
  };
};

/** Parses metadata facts or fails the test with parser status context. */
const parsedFacts = (sourceText: string) => {
  const result = parseSource(sourceText);
  if (result.status !== "parsed") {
    throw new Error(`Expected parsed metadata, got ${result.status}.`);
  }
  return result.facts;
};

/** Asserts the first unprovable parser span for inline workflow source. */
const expectUnprovableSpan = (sourceText: string, expectedSpanText: string): void => {
  const result = parseSource(sourceText);

  expect(result.status).toBe("not-statically-provable");
  if (result.status === "not-statically-provable") {
    expect(spanText(sourceText, result.span)).toBe(expectedSpanText);
  }
};

describe("workflow metadata parser edge cases", () => {
  it("snapshots a fully parsed nested object literal", () => {
    expect(
      parserOutcomeSummary(
        'export const meta = { name: "n", description: "d", nested: { ok: true }, flags: [false, null] };',
      ),
    ).toMatchSnapshot();
  });

  it("normalizes numeric property keys to runtime string form", () => {
    const facts = parsedFacts(
      'export const meta = { 0x10: "hex", 1_000: "separator", 1e2: "exponent", name: "n", description: "d" };',
    );

    expect(facts.properties.map((property) => property.key)).toEqual([
      "16",
      "1000",
      "100",
      "name",
      "description",
    ]);
  });

  it("parses numeric values with separators", () => {
    const facts = parsedFacts(
      'export const meta = { name: "n", description: "d", retries: 1_000 };',
    );
    const retries = facts.properties.find((property) => property.key === "retries");

    expect(retries).toBeDefined();
    if (retries === undefined) {
      return;
    }
    expect(parsedValueSummary(retries.value)).toEqual({
      kind: "primitive",
      value: 1000,
    });
  });

  it("rejects infix arithmetic instead of tokenizing it as a number", () => {
    expectUnprovableSpan(
      'export const meta = { name: "n", description: "d", retries: 1-2 };',
      "1-2",
    );
  });

  it("consumes string line continuations without preserving the newline", () => {
    const facts = parsedFacts(
      'export const meta = { name: "n", description: "continued\\\nline" };',
    );

    expect(facts.description?.value).toMatchObject({
      kind: "primitive",
      value: "continuedline",
    });
  });

  it("rejects raw line terminators inside quoted strings", () => {
    expectUnprovableSpan(
      'export const meta = { name: "n", description: "broken\nline" };',
      '"broken\nline"',
    );
  });

  it("ignores braces inside comments while balancing computed keys", () => {
    expectUnprovableSpan(
      'export const meta = { name: "n", [/* } */ key]: "d", description: "d" };',
      "[/* } */ key]",
    );
  });
});
