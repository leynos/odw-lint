/**
 * @file Tests for expression-leading previous-character ownership.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile, spanFromOffsets } from "../../src/static-analysis/source-file";
import { REGEX_ALLOWED_PREVIOUS_CHARACTERS } from "../../src/static-analysis/source-mask-regex";
import { EXPRESSION_LEADING_PREVIOUS_CHARACTERS } from "../../src/static-analysis/source-scanner-primitives";
import { expressionContainsObjectLiteralCandidate } from "../../src/static-analysis/workflow-metadata-expression";

const BASE_EXPRESSION_LEADING_CHARACTERS = "([{,;:=!&|?+-*%<>~^".split("");

/** Returns the object-literal set derived from the shared base contract. */
const objectLiteralPreviousCharacters = (): ReadonlySet<string> => {
  return new Set([...EXPRESSION_LEADING_PREVIOUS_CHARACTERS, "/"]);
};

/** Builds a source/span pair for expression candidate tests. */
const expressionSpanFor = (sourceText: string) => {
  const sourceFile = createOriginalSourceFile({
    filePath: "expression-leading-characters.odw.js",
    sourceText,
  });

  return {
    sourceFile,
    span: spanFromOffsets(sourceFile, 0, sourceText.length),
  };
};

describe("expression-leading previous characters", () => {
  it("owns the shared regex/object-literal base set once", () => {
    expect([...EXPRESSION_LEADING_PREVIOUS_CHARACTERS]).toEqual(BASE_EXPRESSION_LEADING_CHARACTERS);
    expect([...REGEX_ALLOWED_PREVIOUS_CHARACTERS]).toEqual(BASE_EXPRESSION_LEADING_CHARACTERS);
    expect([...objectLiteralPreviousCharacters()]).toEqual([
      ...BASE_EXPRESSION_LEADING_CHARACTERS,
      "/",
    ]);
  });

  it("keeps object-literal slash and arrow-body behaviour unchanged", () => {
    const divisionExpression = expressionSpanFor("a / {}");
    const arrowBodyExpression = expressionSpanFor("() => {}");

    expect(
      expressionContainsObjectLiteralCandidate(
        divisionExpression.sourceFile,
        divisionExpression.span,
      ),
    ).toBeTrue();
    expect(
      expressionContainsObjectLiteralCandidate(
        arrowBodyExpression.sourceFile,
        arrowBodyExpression.span,
      ),
    ).toBeFalse();
  });
});
