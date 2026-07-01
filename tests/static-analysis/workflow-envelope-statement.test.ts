/**
 * @file Workflow envelope statement boundary tests.
 */

import { describe, expect, it } from "bun:test";
import {
  isTopLevel,
  nextDepthState,
  topLevelStatementEndIndex,
} from "../../src/static-analysis/workflow-envelope-statement";

describe("workflow envelope statement scanner", () => {
  it.each([
    {
      name: "CRLF terminator",
      sourceText: "makeMeta()\r\nawait agent();",
      expectedText: "makeMeta()",
    },
    {
      name: "nested delimiters",
      sourceText: "makeMeta({ nested: [call(';')] });\nawait agent();",
      expectedText: "makeMeta({ nested: [call(';')] });",
    },
    {
      name: "unmatched closing delimiter",
      sourceText: "makeMeta())\nawait agent();",
      expectedText: "makeMeta())",
    },
    {
      name: "unmatched closing brace",
      sourceText: "makeMeta()}\nawait agent();",
      expectedText: "makeMeta()}",
    },
    {
      name: "unmatched closing bracket",
      sourceText: "makeMeta()]\nawait agent();",
      expectedText: "makeMeta()]",
    },
    {
      name: "semicolon-less top-level statement",
      sourceText: "makeMeta()\nawait agent();",
      expectedText: "makeMeta()",
    },
    {
      name: "end-of-string fallback",
      sourceText: "makeMeta()",
      expectedText: "makeMeta()",
    },
    {
      name: "empty input",
      sourceText: "",
      expectedText: "",
    },
    {
      name: "continued assignment",
      sourceText: "const value =\n  makeMeta();\nawait agent();",
      expectedText: "const value =\n  makeMeta();",
    },
    {
      name: "continued member access",
      sourceText: "makeMeta()\n  .validate();\nawait agent();",
      expectedText: "makeMeta()\n  .validate();",
    },
    {
      name: "continued method chain",
      sourceText: "makeMeta().map((item) => item)\n  .filter(Boolean);\nawait agent();",
      expectedText: "makeMeta().map((item) => item)\n  .filter(Boolean);",
    },
    {
      name: "continued arrow body",
      sourceText: "const createMeta = () =>\n  makeMeta();\nawait agent();",
      expectedText: "const createMeta = () =>\n  makeMeta();",
    },
    {
      name: "continued comma declaration",
      sourceText: "const first = 1,\n  second = 2;\nawait agent();",
      expectedText: "const first = 1,\n  second = 2;",
    },
    {
      name: "continued comparison",
      sourceText: "const isReady = count <\n  limit;\nawait agent();",
      expectedText: "const isReady = count <\n  limit;",
    },
    {
      name: "continued leading operator",
      sourceText: "const isReady = ready\n  && enabled;\nawait agent();",
      expectedText: "const isReady = ready\n  && enabled;",
    },
  ])("finds the statement boundary for $name", ({ sourceText, expectedText }) => {
    expect(sourceText.slice(0, topLevelStatementEndIndex(sourceText, 0))).toBe(expectedText);
  });

  it("finds a statement boundary from a non-zero start index", () => {
    const prefix = "const ignored = true; ";
    const sourceText = `${prefix}makeMeta();\nawait agent();`;

    expect(
      sourceText.slice(prefix.length, topLevelStatementEndIndex(sourceText, prefix.length)),
    ).toBe("makeMeta();");
  });

  it("clamps unmatched closing delimiters at top level", () => {
    expect(nextDepthState({ braceDepth: 0, bracketDepth: 0, parenDepth: 0 }, "}")).toEqual({
      braceDepth: 0,
      bracketDepth: 0,
      parenDepth: 0,
    });
    expect(nextDepthState({ braceDepth: 0, bracketDepth: 0, parenDepth: 0 }, "]")).toEqual({
      braceDepth: 0,
      bracketDepth: 0,
      parenDepth: 0,
    });
  });

  it("detects top-level delimiter states", () => {
    expect(isTopLevel({ braceDepth: 0, bracketDepth: 0, parenDepth: 0 })).toBeTrue();
    expect(isTopLevel({ braceDepth: 1, bracketDepth: 0, parenDepth: 0 })).toBeFalse();
  });
});
