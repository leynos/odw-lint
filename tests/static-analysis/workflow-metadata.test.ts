/**
 * @file Metadata literal parser and classifier tests.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import { sliceSourceSpan } from "../../src/static-analysis/source-snippet";
import { scanWorkflowEnvelope } from "../../src/static-analysis/workflow-envelope";
import {
  classifyWorkflowMetadata,
  parseWorkflowMetadataLiteral,
} from "../../src/static-analysis/workflow-metadata";
import { readFixtureSource } from "./fixtures/corpus-support";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "./fixtures/invalid-workflows/corpus";
import type { InvalidWorkflowFixtureFamily } from "./fixtures/invalid-workflows/manifest-types";

const HOSTILE_MARKER_PROPERTY = "__odwLintHostileMetadataWasEvaluated";

/** Creates an original source record for inline workflow source. */
const sourceFileFor = (sourceText: string) =>
  createOriginalSourceFile({ filePath: "fixtures/workflow.js", sourceText });

/** Runs the envelope scanner for inline workflow source. */
const scanSource = (sourceText: string) => scanWorkflowEnvelope(sourceFileFor(sourceText));

/** Slices source text for a diagnostic span produced from the same source. */
const spanText = (sourceText: string, span: Parameters<typeof sliceSourceSpan>[1]) =>
  sliceSourceSpan(sourceFileFor(sourceText), span);

/** Returns compact diagnostic facts used by metadata-classifier assertions. */
const diagnosticSummary = (sourceText: string) => {
  const classification = classifyWorkflowMetadata(scanSource(sourceText));

  return classification.diagnostics.map((diagnostic) => ({
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    message: diagnostic.message,
    spanText: spanText(sourceText, diagnostic.span),
  }));
};

/** Parses metadata facts from inline workflow source. */
const parseFacts = (sourceText: string) => {
  const result = parseWorkflowMetadataLiteral(scanSource(sourceText));
  if (result.status !== "parsed") {
    throw new Error(`Expected parsed metadata, got ${result.status}.`);
  }
  return result.facts;
};

/** Asserts the first impure parser span for inline object-literal metadata. */
const expectFirstImpureSpan = (sourceText: string, expectedSpanText: string) => {
  const result = parseWorkflowMetadataLiteral(scanSource(sourceText));

  expect(result.status).toBe("parsed");
  if (result.status === "parsed") {
    expect(result.facts.portability).toBe("not-statically-provable");
    expect(result.facts.firstImpureSpan).toBeDefined();
    if (result.facts.firstImpureSpan !== undefined) {
      expect(spanText(sourceText, result.facts.firstImpureSpan)).toBe(expectedSpanText);
    }
  }
};

/** Looks up an invalid fixture snapshot by family and file name. */
const invalidFixture = (family: InvalidWorkflowFixtureFamily, fileName: string) => {
  return findInvalidWorkflowFixture({ family, fileName });
};

/** Reads an invalid fixture source by family and file name. */
const invalidFixtureSource = (family: InvalidWorkflowFixtureFamily, fileName: string): string => {
  return readFixtureSource(
    INVALID_WORKFLOW_FIXTURE_CORPUS,
    invalidFixture(family, fileName).fixturePath,
  );
};

/** Projects manifest diagnostics to the metadata classifier summary shape. */
const expectedInvalidFixtureDiagnosticSummary = (
  family: InvalidWorkflowFixtureFamily,
  fileName: string,
) => {
  return invalidFixture(family, fileName).expectedDiagnostics.map((diagnostic) => ({
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    message: diagnostic.message,
    spanText: diagnostic.spanText,
  }));
};

describe("workflow metadata literal parser", () => {
  it("parses object metadata with nested literal values", () => {
    const facts = parseFacts(`export const meta = {
      name: 'Example',
      "description": "Escaped \\"description\\".",
      phases: [{ title: "Run" }],
      retries: 3,
      flags: [true, false, null],
      nested: { mode: \`plain template\` },
    };
    `);

    expect(facts.portability).toBe("pure-literal");
    expect(facts.name?.value.kind).toBe("primitive");
    expect(facts.description?.value.kind).toBe("primitive");
    expect(facts.properties.map((property) => property.key)).toEqual([
      "name",
      "description",
      "phases",
      "retries",
      "flags",
      "nested",
    ]);
  });

  it("parses comments and trailing commas around properties", () => {
    const facts = parseFacts(`export const meta = {
      // keep comments inert
      name: "commented",
      /* block comment */ description: "With comments.",
    };`);

    expect(facts.name).toBeDefined();
    expect(facts.description).toBeDefined();
  });

  it("decodes simple string escapes without evaluating computed escapes", () => {
    const facts = parseFacts(
      'export const meta = { name: "escaped", description: "line\\nindent\\t\\"quoted\\"" };',
    );
    const descriptionValue = facts.description?.value;

    expect(descriptionValue).toBeDefined();
    if (descriptionValue === undefined) {
      return;
    }
    expect(descriptionValue).toEqual({
      kind: "primitive",
      span: descriptionValue.span,
      value: 'line\nindent\t"quoted"',
    });
  });

  it("freezes parser results deeply", () => {
    const facts = parseFacts(
      'export const meta = { name: "frozen", description: "Frozen metadata." };',
    );

    expect(Object.isFrozen(facts)).toBeTrue();
    expect(Object.isFrozen(facts.properties)).toBeTrue();
    expect(Object.isFrozen(facts.properties[0])).toBeTrue();
    expect(Object.isFrozen(facts.properties[0]?.value)).toBeTrue();
  });

  it("reports UTF-8 byte offsets for values after Unicode text", () => {
    const sourceText =
      'const café = "before";\nexport const meta = { name: "unicode", description: suffix };\n';
    const result = parseWorkflowMetadataLiteral(scanSource(sourceText));

    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.facts.firstImpureSpan).toBeDefined();
      if (result.facts.firstImpureSpan === undefined) {
        return;
      }
      expect(spanText(sourceText, result.facts.firstImpureSpan)).toBe("suffix");
      expect(result.facts.firstImpureSpan.start.offset).toBe(
        Buffer.byteLength(
          'const café = "before";\nexport const meta = { name: "unicode", description: ',
          "utf8",
        ),
      );
    }
  });

  for (const [description, sourceText, expectedSpanText] of [
    [
      "string concatenation",
      'export const meta = { name: "n", description: "Computed " + "description." };',
      '"Computed " + "description."',
    ],
    [
      "IIFE value",
      'export const meta = { name: "n", description: (() => "d")() };',
      '(() => "d")()',
    ],
    [
      "spread property",
      'export const meta = { name: "n", ...extra, description: "d" };',
      "...extra",
    ],
    ["computed key", 'export const meta = { name: "n", [key]: "d", description: "d" };', "[key]"],
    ["shorthand property", 'export const meta = { name, description: "d" };', "name"],
    [
      "template interpolation",
      'export const meta = { name: "n", description: `hello $' + "{name}` };",
      "`hello $" + "{name}`",
    ],
    [
      "Unicode string escape",
      'export const meta = { name: "n", description: "\\u0064" };',
      '"\\u0064"',
    ],
    ["numeric string escape", 'export const meta = { name: "n", description: "\\0" };', '"\\0"'],
  ] as const) {
    it(`records the first impure span for ${description}`, () => {
      expectFirstImpureSpan(sourceText, expectedSpanText);
    });
  }
});

describe("workflow metadata classifier", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[HOSTILE_MARKER_PROPERTY];
  });

  for (const [description, sourceText, expected] of [
    [
      "missing value",
      "export const meta = ;",
      {
        rule: "odw/meta-object",
        severity: "error",
        message: "Workflow metadata must be an object literal.",
        spanText: "",
      },
    ],
    [
      "non-object expression",
      'export const meta = "not an object";',
      {
        rule: "odw/meta-object",
        severity: "error",
        message: "Workflow metadata must be an object literal.",
        spanText: '"not an object"',
      },
    ],
    [
      "unterminated object",
      'export const meta = { name: "n", description: "d";',
      {
        rule: "odw/meta-object",
        severity: "error",
        message: "Workflow metadata object literal must be complete.",
        spanText: '{ name: "n", description: "d";',
      },
    ],
    [
      "missing name",
      'export const meta = { description: "d" };',
      {
        rule: "odw/meta-name",
        severity: "error",
        message: "Workflow metadata must include a non-empty name string.",
        spanText: '{ description: "d" }',
      },
    ],
    [
      "empty name",
      'export const meta = { name: "", description: "d" };',
      {
        rule: "odw/meta-name",
        severity: "error",
        message: "Workflow metadata must include a non-empty name string.",
        spanText: '""',
      },
    ],
    [
      "numeric name",
      'export const meta = { name: 123, description: "d" };',
      {
        rule: "odw/meta-name",
        severity: "error",
        message: "Workflow metadata must include a non-empty name string.",
        spanText: "123",
      },
    ],
    [
      "missing description",
      'export const meta = { name: "n" };',
      {
        rule: "odw/meta-description",
        severity: "error",
        message: "Workflow metadata must include a description string.",
        spanText: '{ name: "n" }',
      },
    ],
    [
      "numeric description",
      'export const meta = { name: "n", description: 123 };',
      {
        rule: "odw/meta-description",
        severity: "error",
        message: "Workflow metadata description must be a string.",
        spanText: "123",
      },
    ],
  ] as const) {
    it(`emits runtime-invalid metadata diagnostics for ${description}`, () => {
      expect(diagnosticSummary(sourceText)).toEqual([expected]);
    });
  }

  it("accepts an empty string description under the current runtime contract", () => {
    expect(diagnosticSummary('export const meta = { name: "n", description: "" };')).toEqual([]);
  });

  it("keeps function block bodies runtime-invalid as non-object metadata", () => {
    expect(
      diagnosticSummary('export const meta = () => { return { name: "n", description: "d" }; };'),
    ).toEqual([
      {
        rule: "odw/meta-object",
        severity: "error",
        message: "Workflow metadata must be an object literal.",
        spanText: '() => { return { name: "n", description: "d" }; }',
      },
    ]);
  });

  for (const [description, sourceText, expectedSpanText] of [
    [
      "computed string concatenation",
      'export const meta = { name: "n", description: "a" + "b" };',
      '"a" + "b"',
    ],
    [
      "object-bearing function call",
      'export const meta = makeMeta({ name: "n", description: "d" });',
      'makeMeta({ name: "n", description: "d" })',
    ],
    [
      "conditional object expression",
      'export const meta = condition ? { name: "n", description: "d" } : fallback;',
      'condition ? { name: "n", description: "d" } : fallback',
    ],
    [
      "parenthesized object expression",
      'export const meta = ({ name: "n", description: "d" });',
      '({ name: "n", description: "d" })',
    ],
    [
      "logical operator object expression",
      'export const meta = enabled && { name: "n", description: "d" };',
      'enabled && { name: "n", description: "d" }',
    ],
    [
      "additive operator object expression",
      'export const meta = prefix + { name: "n", description: "d" };',
      'prefix + { name: "n", description: "d" }',
    ],
  ] as const) {
    it(`emits statically-unprovable diagnostics for ${description}`, () => {
      expect(diagnosticSummary(sourceText)).toEqual([
        {
          rule: "odw/meta-statically-unprovable",
          severity: "warning",
          message: "Workflow metadata must remain statically provable without evaluation.",
          spanText: expectedSpanText,
        },
      ]);
    });
  }

  it("keeps hostile global-marker metadata passive", () => {
    const sourceText = invalidFixtureSource("hostile-metadata", "global-marker.js");

    expect(diagnosticSummary(sourceText)).toEqual(
      expectedInvalidFixtureDiagnosticSummary("hostile-metadata", "global-marker.js"),
    );
    expect((globalThis as Record<string, unknown>)[HOSTILE_MARKER_PROPERTY]).toBeUndefined();
  });

  it("returns a warning instead of throwing hostile throw-marker metadata", () => {
    const sourceText = invalidFixtureSource("hostile-metadata", "throw-marker.js");

    expect(diagnosticSummary(sourceText)).toEqual(
      expectedInvalidFixtureDiagnosticSummary("hostile-metadata", "throw-marker.js"),
    );
  });
});
