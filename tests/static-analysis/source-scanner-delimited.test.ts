/** @file Tests for shared source-scanner delimiter primitives. */

import { describe, expect, it } from "bun:test";
import {
  isDelimiterDepthTopLevel,
  isQuotedStringDelimiter,
  isRegexDelimiter,
  isStringLikeDelimiter,
  isTemplateDelimiter,
  nextDelimiterDepthState,
  templateExpressionEnd,
} from "../../src/static-analysis/source-scanner-primitives";

describe("source scanner delimiter primitives", () => {
  it("classifies delimiter families", () => {
    expect(["'", '"'].every(isQuotedStringDelimiter)).toBeTrue();
    expect(isTemplateDelimiter("`")).toBeTrue();
    expect(isRegexDelimiter("/")).toBeTrue();
    expect(["'", '"', "`"].every(isStringLikeDelimiter)).toBeTrue();
    expect(["/", "{", "x"].some(isStringLikeDelimiter)).toBeFalse();
  });

  it("finds simple and nested template expression ends", () => {
    const simpleExpression = "$" + "{value} tail";
    const nestedExpression = "$" + "{{ value: { nested: true } }} tail";

    expect(templateExpressionEnd(simpleExpression, 2, simpleExpression.length)).toBe(
      simpleExpression.indexOf(" tail"),
    );
    expect(templateExpressionEnd(nestedExpression, 2, nestedExpression.length)).toBe(
      nestedExpression.indexOf(" tail"),
    );
  });

  it("ignores braces inside strings and comments", () => {
    const stringExpression = "$" + "{'}' + `}` + \"}\"} tail";
    const commentExpression = "$" + "{/* } */ value} tail";
    const lineCommentExpression = "$" + "{// }\nvalue} tail";
    const nestedTokenExpression = "$" + "{`outer $" + "{/* } */ '}'} end`} tail";

    expect(templateExpressionEnd(stringExpression, 2, stringExpression.length)).toBe(
      stringExpression.indexOf(" tail"),
    );
    expect(templateExpressionEnd(commentExpression, 2, commentExpression.length)).toBe(
      commentExpression.indexOf(" tail"),
    );
    expect(templateExpressionEnd(lineCommentExpression, 2, lineCommentExpression.length)).toBe(
      lineCommentExpression.indexOf(" tail"),
    );
    expect(templateExpressionEnd(nestedTokenExpression, 2, nestedTokenExpression.length)).toBe(
      nestedTokenExpression.indexOf(" tail"),
    );
  });

  it("falls back to the scan bound for unterminated expressions", () => {
    const unterminatedExpression = "$" + "{{ value";

    expect(templateExpressionEnd(unterminatedExpression, 2, unterminatedExpression.length)).toBe(
      unterminatedExpression.length,
    );
  });

  it("clamps unmatched delimiter closers at top level", () => {
    const topLevelDepth = { braceDepth: 0, bracketDepth: 0, parenDepth: 0 };

    expect(isDelimiterDepthTopLevel(nextDelimiterDepthState(topLevelDepth, "}"))).toBeTrue();
    expect(isDelimiterDepthTopLevel(nextDelimiterDepthState(topLevelDepth, "]"))).toBeTrue();
    expect(isDelimiterDepthTopLevel(nextDelimiterDepthState(topLevelDepth, ")"))).toBeTrue();
  });

  it("tracks nested delimiter depth across delimiter families", () => {
    const topLevelDepth = { braceDepth: 0, bracketDepth: 0, parenDepth: 0 };
    const nestedDepth = ["{", "[", "("].reduce(nextDelimiterDepthState, topLevelDepth);

    expect(isDelimiterDepthTopLevel(nestedDepth)).toBeFalse();
    expect([")", "]", "}"].reduce(nextDelimiterDepthState, nestedDepth)).toEqual(topLevelDepth);
  });
});
