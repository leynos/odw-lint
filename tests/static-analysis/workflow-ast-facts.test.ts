/**
 * @file Tests for public workflow AST fact aggregation.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import type {
  LexicalBindingFacts,
  OriginalSourceFile,
  SourceMaskRange,
  WorkflowAstFacts,
  WorkflowSuppressionMasks,
} from "odw-lint";
import { collectWorkflowAstFacts, isIdentifierBound, isIndexInInertRegion } from "odw-lint";
import { collectWorkflowAstFactsFromParseResult } from "../../src/static-analysis/workflow-ast-facts";
import { parseNormalizedWorkflowBody } from "../../src/static-analysis/workflow-body-parse";
import { envelopeForBody } from "./workflow-envelope-support";

const DECOY_DIRECTIVE = "odw-lint-disable";

describe("collectWorkflowAstFacts", () => {
  it("combines lexical bindings and suppression masks for parseable bodies", () => {
    const facts = collectWorkflowAstFacts(
      envelopeForBody(
        `const Math = customMath;\nparallel(items);\nconst decoy = "${DECOY_DIRECTIVE}";\n`,
      ),
    );
    const decoyIndex = facts.suppressionMasks.sourceFile.sourceText.indexOf(DECOY_DIRECTIVE);

    expect(facts.parseSucceeded).toBeTrue();
    expect(isIdentifierBound(facts.lexicalBindings, "Math")).toBeTrue();
    expect(isIdentifierBound(facts.lexicalBindings, "parallel")).toBeFalse();
    expect(JSON.stringify(facts.suppressionMasks.directiveScanText)).toMatchSnapshot();
    expect(facts.suppressionMasks.directiveScanText).not.toContain(DECOY_DIRECTIVE);
    expect(isIndexInInertRegion(facts.suppressionMasks, decoyIndex)).toBeTrue();
    expect(Object.isFrozen(facts)).toBeTrue();
  });

  it("returns empty bindings and populated masks when body parsing fails", () => {
    const facts = collectWorkflowAstFacts(envelopeForBody(`if (args.ready) {\n`));

    expect(facts.parseSucceeded).toBeFalse();
    expect(facts.lexicalBindings.boundNames).toEqual([]);
    expect(facts.suppressionMasks.sourceFile.filePath).toBe("workflows/example.js");
    expect(facts.suppressionMasks.directiveScanText).toHaveLength(
      facts.suppressionMasks.sourceFile.sourceText.length,
    );
  });

  it("reports built-in shadowing and rejects negative inert indexes", () => {
    const facts = collectWorkflowAstFacts(envelopeForBody("const Object = customObject;\n"));

    expect(isIdentifierBound(facts.lexicalBindings, "Object")).toBeTrue();
    expect(isIndexInInertRegion(facts.suppressionMasks, -1)).toBeFalse();
  });

  it("can assemble public facts from an existing internal parse result", () => {
    const envelope = envelopeForBody("const Number = customNumber;\n");
    const parseResult = parseNormalizedWorkflowBody(envelope);
    const facts = collectWorkflowAstFactsFromParseResult(envelope, parseResult);

    expect(parseResult.ok).toBeTrue();
    expect(facts.parseSucceeded).toBeTrue();
    expect(isIdentifierBound(facts.lexicalBindings, "Number")).toBeTrue();
  });

  it("rejects parse results from a different workflow envelope", () => {
    const envelope = envelopeForBody("const Array = customArray;\n");
    const otherEnvelope = envelopeForBody("const Array = otherArray;\n");
    const parseResult = parseNormalizedWorkflowBody(otherEnvelope);

    expect(() => collectWorkflowAstFactsFromParseResult(envelope, parseResult)).toThrow(
      "Parse result must belong to the same workflow envelope.",
    );
  });

  it("rejects parse results with a mismatched body span", () => {
    const envelope = envelopeForBody("const Array = customArray;\n");
    const parseResult = parseNormalizedWorkflowBody(envelope);
    const mismatchedParseResult = {
      ...parseResult,
      bodySpan: {
        start: parseResult.bodySpan.start,
        end: {
          ...parseResult.bodySpan.end,
          offset: parseResult.bodySpan.end.offset + 1,
        },
      },
    };

    expect(() => collectWorkflowAstFactsFromParseResult(envelope, mismatchedParseResult)).toThrow(
      "Parse result must belong to the same workflow envelope.",
    );
  });

  it("keeps workflow AST fact types importable from the package entry", () => {
    expectTypeOf<LexicalBindingFacts>().toEqualTypeOf<{
      readonly boundNames: readonly string[];
    }>();
    expectTypeOf<WorkflowSuppressionMasks>().toEqualTypeOf<{
      readonly sourceFile: OriginalSourceFile;
      readonly directiveScanText: string;
      readonly inertRanges: readonly SourceMaskRange[];
    }>();
    expectTypeOf<WorkflowAstFacts>().toEqualTypeOf<{
      readonly parseSucceeded: boolean;
      readonly lexicalBindings: LexicalBindingFacts;
      readonly suppressionMasks: WorkflowSuppressionMasks;
    }>();
  });
});
