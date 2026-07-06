/**
 * @file Focused tests for ODW-only validate primitive notes.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import type { Diagnostic, WorkflowEnvelope } from "odw-lint";
import {
  createOriginalSourceFile,
  firstReviewedRuleMessage,
  makeRuleId,
  ruleDefinitionFor,
  scanWorkflowEnvelope,
} from "odw-lint";
import { scanOdwOnlyValidateNotes } from "../../src/static-analysis/workflow-odw-only-validate";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";
import { decodeSpanText, expectSpanToMatchSource } from "./source-span-oracle";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const DEFAULT_META = 'export const meta = { name: "validate-check", description: "ok" };';
const ODW_ONLY_VALIDATE_RULE = makeRuleId("odw/no-odw-only-validate");
const NON_VALIDATE_IDENTIFIER = fc
  .tuple(
    fc.constantFrom("check", "validateFoo", "myValidate", "source", "Validate", "validator"),
    fc.array(fc.constantFrom("A", "b", "0", "_"), { maxLength: 4 }),
  )
  .map(([first, rest]) => `${first}${rest.join("")}`)
  .filter((name) => name !== "validate");

/** Builds a complete workflow source from a body fragment. */
const sourceTextForBody = (body: string): string => {
  return `${DEFAULT_META}\n${body}\n`;
};

/** Scans a body fragment and returns detector diagnostics plus source text. */
const scanBody = (body: string, label = "odw-only-validate") => {
  const sourceText = sourceTextForBody(body);
  const sourceFile = createOriginalSourceFile({
    filePath: `workflows/${label}.js`,
    sourceText,
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), label);

  return {
    sourceText,
    diagnostics: scanOdwOnlyValidateNotes(envelope),
  };
};

/** Returns the first validate diagnostic or fails with context. */
const expectSingleDiagnostic = (diagnostics: readonly Diagnostic[]): Diagnostic => {
  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0];
  if (diagnostic === undefined) {
    throw new Error("Expected one ODW-only validate diagnostic.");
  }

  return diagnostic;
};

/** Asserts the fixed catalogue fields for one validate diagnostic. */
const expectValidateDiagnostic = (diagnostic: Diagnostic, sourceText: string): void => {
  const rule = ruleDefinitionFor(ODW_ONLY_VALIDATE_RULE);

  expect(diagnostic.rule).toBe(ODW_ONLY_VALIDATE_RULE);
  expect(diagnostic.severity).toBe("info");
  expect(diagnostic.message).toBe(firstReviewedRuleMessage(rule));
  expect(decodeSpanText(sourceText, diagnostic.span)).toBe("validate");
  expectSpanToMatchSource(sourceText, diagnostic.span, "validate");
};

describe("scanOdwOnlyValidateNotes", () => {
  it("reports unshadowed bare validate calls with an original-source span", () => {
    const { sourceText, diagnostics } = scanBody(
      "const result = validate(args.source);",
      "positive",
    );

    expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText);
  });

  it("emits one diagnostic per validate call in source order", () => {
    const { sourceText, diagnostics } = scanBody(
      "validate(args.first);\nvalidate(args.second);",
      "multiple",
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((diagnostic) => decodeSpanText(sourceText, diagnostic.span))).toEqual([
      "validate",
      "validate",
    ]);
  });

  it("ignores validate calls shadowed in the current lexical scope", () => {
    const { diagnostics } = scanBody(
      "const validate = () => ok;\nvalidate(args.source);",
      "shadowed",
    );

    expect(diagnostics).toEqual([]);
  });

  it("does not let a sibling-scope shadow suppress an unshadowed call", () => {
    const { diagnostics } = scanBody(
      "if (args.local) {\n  const validate = () => ok;\n  validate(args.source);\n}\nvalidate(args.source);",
      "sibling-scope",
    );

    expect(diagnostics).toHaveLength(1);
  });

  it("ignores member, computed, and non-call validate references", () => {
    const bodies = [
      "schema.validate(args.source);",
      'obj["validate"](args.source);',
      "const fn = validate;",
    ] as const;

    for (const body of bodies) {
      expect(scanBody(body, "excluded").diagnostics).toEqual([]);
    }
  });

  it("matches the injected primitive by identity rather than arity", () => {
    const { diagnostics } = scanBody("validate();\nvalidate(args.a, args.b);", "arity");

    expect(diagnostics).toHaveLength(2);
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

    expect(scanOdwOnlyValidateNotes(envelope)).toEqual([]);
  });

  it("does not report generated non-validate identifiers", () => {
    fc.assert(
      fc.property(NON_VALIDATE_IDENTIFIER, (name) => {
        expect(scanBody(`${name}(args.source);`, "generated-name").diagnostics).toEqual([]);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});
