/**
 * @file Tests for the standalone workflow body parser adapter.
 */

import { describe, expect, it } from "bun:test";
import { parseSync } from "@swc/core";
import * as fc from "fast-check";
import {
  createOriginalSourceFile,
  makeRuleId,
  messageMatchesTemplate,
  normalizeWorkflowBody,
  originalSpanFromNormalizedOffsets,
  parseWorkflowBody,
  ruleDefinitionFor,
  scanWorkflowEnvelope,
  sliceSourceSpan,
  type WorkflowBodyParseResult,
} from "odw-lint";
import { firstReviewedRuleTemplate } from "../../src/diagnostics/rule-catalogue";
import { isUnknownRecord } from "../../src/static-analysis/value-guards";
import { readFixtureSource } from "./fixtures/corpus-support";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./fixtures/odw-examples";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const INVALID_FIXTURE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/",
  recursive: true,
} as const;
const SYNTAX_ERROR_FIXTURES = [
  "syntax-error/body-unclosed-block.js",
  "syntax-error/body-unclosed-call.js",
] as const;
const VALID_BODY_STATEMENT = fc.constantFrom(
  "const x = 1;\n",
  'await agent("ok");\n',
  'const result = await agent("ok");\nresult;\n',
);
const BROKEN_BODY_SUFFIX = fc.constantFrom(
  "if (args.ready) {\n  const x = 1;\n",
  'agent("draft"\n',
  "const values = [1, 2;\n",
  'const message = "unterminated;\n',
  "const ratio = 1__2;\n",
  "const value = ;\n",
  "}\n",
);
const BROKEN_BODY_SOURCE = fc
  .tuple(fc.array(VALID_BODY_STATEMENT, { maxLength: 3 }), BROKEN_BODY_SUFFIX)
  .map(([statements, suffix]) => `${statements.join("")}${suffix}`);
const VALID_BODY_SOURCE = fc
  .array(VALID_BODY_STATEMENT, { minLength: 1, maxLength: 4 })
  .map((statements) => statements.join(""));
const BODY_PARSER_PROPERTY_RUNNER = {
  numRuns: 100,
} as const;
const NON_EXPECTED_SYNTAX_ERROR_BODIES = [
  ["unterminated string literal", 'const message = "unterminated;\n'],
  ["invalid numeric literal", "const ratio = 1__2;\n"],
  ["missing expression", "const value = ;\n"],
  ["stray closing brace", "}\n"],
] as const;
const ODW_EXAMPLE_FIXTURE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/odw-examples/", import.meta.url),
} as const;
const BODY_SYNTAX_RULE_DEFINITION = ruleDefinitionFor(makeRuleId("odw/body-syntax"));
const BODY_SYNTAX_TEMPLATE = firstReviewedRuleTemplate(BODY_SYNTAX_RULE_DEFINITION);

type SwcSpanNode = {
  readonly span: {
    readonly start: number;
    readonly end: number;
  };
};
type NormalizedByteSpan = {
  readonly start: number;
  readonly end: number;
};
/** Builds a scanned workflow envelope for one body snippet. */
const envelopeForBody = (body: string) => {
  return scannedEnvelopeFor({
    filePath: "workflows/example.js",
    sourceText: `export const meta = { name: "example", description: "ok" };\n${body}`,
  });
};

/** Builds a scanned workflow envelope for one source fixture. */
const scannedEnvelopeFor = (source: { readonly filePath: string; readonly sourceText: string }) => {
  const sourceFile = createOriginalSourceFile({
    filePath: source.filePath,
    sourceText: source.sourceText,
  });

  return expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), source.filePath);
};

/** Reads and scans an invalid workflow fixture. */
const envelopeForInvalidFixture = (fixturePath: string) => {
  return scannedEnvelopeFor({
    filePath: fixturePath,
    sourceText: readFixtureSource(INVALID_FIXTURE_CORPUS, fixturePath),
  });
};

/** Reads and scans one trusted ODW example fixture. */
const envelopeForOdwExample = (fixturePath: string) => {
  return scannedEnvelopeFor({
    filePath: fixturePath,
    sourceText: readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixturePath),
  });
};

/** Requires a syntax diagnostic result for focused assertions. */
const expectBodySyntaxDiagnostic = (
  result: WorkflowBodyParseResult,
): Extract<WorkflowBodyParseResult, { readonly ok: false }>["diagnostic"] => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected body parser to return a syntax diagnostic.");
  }

  return result.diagnostic;
};

/** Checks whether an unknown SWC span has numeric byte offsets. */
const isNumericSwcSpan = (span: unknown): span is SwcSpanNode["span"] => {
  if (!isUnknownRecord(span)) {
    return false;
  }
  const candidate = span as { readonly start?: unknown; readonly end?: unknown };

  return typeof candidate.start === "number" && typeof candidate.end === "number";
};

/** Checks whether an unknown SWC value exposes a numeric byte span. */
const isSwcSpanNode = (value: unknown): value is SwcSpanNode => {
  if (!isUnknownRecord(value)) {
    return false;
  }
  if (!("span" in value)) {
    return false;
  }
  const candidate = value as { readonly span?: unknown };

  return isNumericSwcSpan(candidate.span);
};

/** Collects SWC nodes that expose byte spans without depending on AST kinds. */
const collectSwcSpanNodes = (value: unknown): readonly SwcSpanNode[] => {
  const nodes: SwcSpanNode[] = [];

  const visit = (candidate: unknown): void => {
    if (isSwcSpanNode(candidate)) {
      nodes.push(candidate);
    }
    if (!isUnknownRecord(candidate)) {
      return;
    }
    for (const child of Object.values(candidate)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          visit(item);
        }
      } else {
        visit(child);
      }
    }
  };

  visit(value);
  return nodes;
};

/** Checks whether a normalized byte span points wholly inside the body slice. */
const isInNormalizedBodySpan = (
  span: NormalizedByteSpan,
  normalized: { readonly prefixByteLength: number; readonly bodyByteLength: number },
): boolean => {
  const bodyStart = normalized.prefixByteLength;
  const bodyEnd = normalized.prefixByteLength + normalized.bodyByteLength;

  return span.start >= bodyStart && span.end <= bodyEnd;
};

describe("parseWorkflowBody", () => {
  it.each(
    SYNTAX_ERROR_FIXTURES.map((fixturePath) => [fixturePath]),
  )("converts %s syntax errors to body diagnostics", (fixturePath) => {
    const envelope = envelopeForInvalidFixture(fixturePath);
    const diagnostic = expectBodySyntaxDiagnostic(parseWorkflowBody(envelope));

    expect({
      rule: String(diagnostic.rule),
      severity: diagnostic.severity,
      message: diagnostic.message,
      span: diagnostic.span,
      docs: diagnostic.docs,
    }).toMatchSnapshot();
    expect(messageMatchesTemplate(BODY_SYNTAX_TEMPLATE, diagnostic.message)).toBeTrue();
    expect(diagnostic.message).not.toBe(BODY_SYNTAX_RULE_DEFINITION.messages[0]);
  });

  it.each(
    SYNTAX_ERROR_FIXTURES.map((fixturePath) => [fixturePath]),
  )("emits original-source body span text for %s", (fixturePath) => {
    const envelope = envelopeForInvalidFixture(fixturePath);
    const diagnostic = expectBodySyntaxDiagnostic(parseWorkflowBody(envelope));

    expect(diagnostic.span).toEqual(envelope.bodySpan);
    expect(sliceSourceSpan(envelope.sourceFile, diagnostic.span)).toBe(
      sliceSourceSpan(envelope.sourceFile, envelope.bodySpan),
    );
  });

  it("returns ok for a valid non-return body", () => {
    expect(parseWorkflowBody(envelopeForBody('await agent("ok");\n'))).toEqual({ ok: true });
  });

  it("returns ok for a top-level return body", () => {
    expect(parseWorkflowBody(envelopeForBody("return { done: true };\n"))).toEqual({ ok: true });
  });

  it("keeps top-level await valid after normalization", () => {
    expect(parseWorkflowBody(envelopeForBody('const x = await agent("ok");\nreturn x;\n'))).toEqual(
      {
        ok: true,
      },
    );
  });

  it.each(
    ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((fixture) => [fixture.fileName]),
  )("parses trusted ODW example %s", (fixturePath) => {
    expect(parseWorkflowBody(envelopeForOdwExample(fixturePath))).toEqual({ ok: true });
  });

  it("maps a real SWC body node span back to original source", () => {
    const envelope = envelopeForBody("const marker = 42;\nreturn marker;\n");
    const normalized = normalizeWorkflowBody(envelope);
    const program = parseSync(normalized.normalizedText, {
      syntax: "ecmascript",
      jsx: false,
    });
    const base = program.span.start;
    const mappedTexts = collectSwcSpanNodes(program)
      .map((node) => ({
        start: node.span.start - base,
        end: node.span.end - base,
      }))
      .filter((span) => isInNormalizedBodySpan(span, normalized))
      .map((span) =>
        sliceSourceSpan(
          envelope.sourceFile,
          originalSpanFromNormalizedOffsets(envelope.sourceFile, normalized, span.start, span.end),
        ),
      );

    expect(mappedTexts).toContain("marker");
  });

  it("does not throw for malformed bodies", () => {
    const envelope = envelopeForBody("if (args.ready) {\n");

    expect(() => parseWorkflowBody(envelope)).not.toThrow();
    expect(parseWorkflowBody(envelope).ok).toBe(false);
  });

  it.each(NON_EXPECTED_SYNTAX_ERROR_BODIES)("does not throw for %s", (_description, body) => {
    const envelope = envelopeForBody(body);

    expect(() => parseWorkflowBody(envelope)).not.toThrow();
    const diagnostic = expectBodySyntaxDiagnostic(parseWorkflowBody(envelope));
    expect(String(diagnostic.rule)).toBe("odw/body-syntax");
  });

  it("freezes parser results and diagnostics", () => {
    const okResult = parseWorkflowBody(envelopeForBody("const x = 1;\n"));
    const errorResult = parseWorkflowBody(envelopeForBody("if (args.ready) {\n"));

    expect(Object.isFrozen(okResult)).toBe(true);
    expect(Object.isFrozen(errorResult)).toBe(true);
    expect(Object.isFrozen(expectBodySyntaxDiagnostic(errorResult))).toBe(true);
  });

  it("never throws for generated bodies in the 2.2.1 contract", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          VALID_BODY_SOURCE.map((body) => ({ body, shouldParse: true })),
          BROKEN_BODY_SOURCE.map((body) => ({ body, shouldParse: false })),
        ),
        ({ body, shouldParse }) => {
          const result = parseWorkflowBody(envelopeForBody(body));

          expect(typeof result.ok).toBe("boolean");
          if (shouldParse) {
            expect(result.ok).toBe(true);
          } else {
            const diagnostic = expectBodySyntaxDiagnostic(result);
            expect(String(diagnostic.rule)).toBe("odw/body-syntax");
          }
        },
      ),
      BODY_PARSER_PROPERTY_RUNNER,
    );
  });
});
