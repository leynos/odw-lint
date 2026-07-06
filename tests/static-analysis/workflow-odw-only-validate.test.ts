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
const VALIDATE_ALIAS_IDENTIFIER = fc.constantFrom(
  "v",
  "checkSource",
  "validateSource",
  "sourceValidator",
  "_validate",
);
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
const expectValidateDiagnostic = (
  diagnostic: Diagnostic,
  sourceText: string,
  expectedSpanText = "validate",
): void => {
  const rule = ruleDefinitionFor(ODW_ONLY_VALIDATE_RULE);

  expect(diagnostic.rule).toBe(ODW_ONLY_VALIDATE_RULE);
  expect(diagnostic.severity).toBe("info");
  expect(diagnostic.message).toBe(firstReviewedRuleMessage(rule));
  expect(decodeSpanText(sourceText, diagnostic.span)).toBe(expectedSpanText);
  expectSpanToMatchSource(sourceText, diagnostic.span, expectedSpanText);
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

  it("reports single-hop validate aliases with an alias span", () => {
    const { sourceText, diagnostics } = scanBody(
      "const v = validate;\nconst out = v(args.source);",
      "positive-alias",
    );

    expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, "v");
  });

  it("emits one diagnostic per validate alias call in source order", () => {
    const { sourceText, diagnostics } = scanBody(
      "const v = validate;\nv(args.first);\nv(args.second);",
      "multiple-alias",
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((diagnostic) => decodeSpanText(sourceText, diagnostic.span))).toEqual([
      "v",
      "v",
    ]);
  });

  it("keeps alias and bare validate call diagnostics in source order", () => {
    const { sourceText, diagnostics } = scanBody(
      "const v = validate;\nv(args.first);\nvalidate(args.second);",
      "alias-and-bare",
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((diagnostic) => decodeSpanText(sourceText, diagnostic.span))).toEqual([
      "v",
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

  it("ignores aliases whose validate initializer is workflow-local", () => {
    const { diagnostics } = scanBody(
      "const validate = makeValidator();\nconst v = validate;\nv(args.source);",
      "shadowed-alias-initializer",
    );

    expect(diagnostics).toEqual([]);
  });

  it("lets call-site alias shadows suppress only the nested alias call", () => {
    const { sourceText, diagnostics } = scanBody(
      "const v = validate;\nif (args.local) {\n  const v = other;\n  v(args.source);\n}\nv(args.after);",
      "shadowed-alias-call-site",
    );

    expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, "v");
  });

  it("follows chained validate aliases", () => {
    const { sourceText, diagnostics } = scanBody(
      "const v = validate;\nconst w = v;\nw(args.source);",
      "chained-alias",
    );

    expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, "w");
  });

  it("follows multi-hop validate alias chains", () => {
    const { sourceText, diagnostics } = scanBody(
      "const a = validate;\nconst b = a;\nconst c = b;\nc(args.source);",
      "multi-hop-alias",
    );

    expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, "c");
  });

  it("follows a reverse-declared chain within one scope", () => {
    const { sourceText, diagnostics } = scanBody(
      "var w = v;\nvar v = validate;\nw(args.source);",
      "reverse-declared-alias",
    );

    expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, "w");
  });

  it("stops a chain when the base is shadowed in a nested scope", () => {
    const { diagnostics } = scanBody(
      "const v = validate;\nif (args.local) {\n  const v = other;\n  const w = v;\n  w(args.source);\n}",
      "nested-shadowed-chain",
    );

    expect(diagnostics).toEqual([]);
  });

  it("ignores a chain whose base is workflow-local", () => {
    const { diagnostics } = scanBody(
      "const validate = makeValidator();\nconst v = validate;\nconst w = v;\nw(args.source);",
      "workflow-local-chain",
    );

    expect(diagnostics).toEqual([]);
  });

  it("treats a chain off a reassigned base as the documented whole-scope bound", () => {
    const { sourceText, diagnostics } = scanBody(
      "let v = validate;\nv = other;\nconst w = v;\nw(args.source);",
      "reassigned-base-chain",
    );

    expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, "w");
  });

  it("ignores member, computed, and non-call validate references", () => {
    const bodies = [
      "schema.validate(args.source);",
      'registry["validate"](args.source);',
      "globalThis.validate(args.source);",
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

  it("reports generated valid single-hop validate aliases", () => {
    fc.assert(
      fc.property(VALIDATE_ALIAS_IDENTIFIER, (name) => {
        const { sourceText, diagnostics } = scanBody(
          `const ${name} = validate;\n${name}(args.source);`,
          "generated-alias",
        );

        expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, name);
      }),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("reports generated valid two-hop validate aliases", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(VALIDATE_ALIAS_IDENTIFIER, VALIDATE_ALIAS_IDENTIFIER)
          .filter(([firstName, secondName]) => firstName !== secondName),
        ([firstName, secondName]) => {
          const { sourceText, diagnostics } = scanBody(
            `const ${firstName} = validate;\nconst ${secondName} = ${firstName};\n${secondName}(args.source);`,
            "generated-chained-alias",
          );

          expectValidateDiagnostic(expectSingleDiagnostic(diagnostics), sourceText, secondName);
        },
      ),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});
