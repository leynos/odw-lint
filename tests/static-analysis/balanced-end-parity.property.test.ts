/** @file Differential property tests for balanced metadata scanner refactors. */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import type { ParserCursor } from "../../src/static-analysis/workflow-metadata-parser";
import {
  scanBalancedEnd,
  scanExpressionEnd,
} from "../../src/static-analysis/workflow-metadata-parser-scan";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";

type BalancedDelimiterCase = Readonly<{
  readonly open: "{" | "[" | "(";
  readonly close: "}" | "]" | ")";
}>;

type ExpressionDepth = Readonly<{
  readonly braceDepth: number;
  readonly bracketDepth: number;
  readonly parenDepth: number;
}>;

const BALANCED_DELIMITER_CASES: readonly BalancedDelimiterCase[] = [
  { open: "{", close: "}" },
  { open: "[", close: "]" },
  { open: "(", close: ")" },
];
const EXPRESSION_TERMINATOR_CASES = [[","], ["}", ","], [",", "}", "]"]] as const;
const SOURCE_FRAGMENT = fc.constantFrom(
  "",
  "a",
  " ",
  "\t",
  "\u00a0",
  "\f",
  "\v",
  "{",
  "}",
  "[",
  "]",
  "(",
  ")",
  ",",
  "'}'",
  "'\\}'",
  '"}"',
  '"\\"}"',
  "`outer $" + "{'}'} end`",
  "`escaped \\` delimiter`",
  "`nested $" + "{`inner $" + "{call('}')}`}`",
  "'quoted \" double'",
  '"quoted \' single"',
  "/[\\]`'\"]/g",
  "// } \n",
  "/* ] */",
  "\n",
  "\r\n",
  "\u2028",
  "\u2029",
);
const GENERATED_BODY = fc.array(SOURCE_FRAGMENT, { maxLength: 20 }).map((parts) => parts.join(""));

describe("balanced metadata scanner parity", () => {
  it("anchors the frozen balanced oracle to explicit cases", () => {
    for (const [sourceText, open, close, expectedEnd] of [
      ["{ nested: { ok: true } } tail", "{", "}", 24],
      ["[call(']'), /* ] */ value] tail", "[", "]", 26],
      ["(call(`outer $" + "{/* ) */ value}`)) tail", "(", ")", 32],
    ] as const) {
      const cursor = parserCursor(sourceText);

      expect(expectedBalancedEnd(cursor, open, close)).toBe(expectedEnd);
      expect(scanBalancedEnd(cursor, open, close)).toBe(expectedEnd);
    }
  });

  it("anchors the frozen expression oracle to terminator and trimming cases", () => {
    for (const [sourceText, terminators, expectedEnd] of [
      ["value   , tail", [","], 5],
      ["call({ inner: '}' })   } tail", ["}"], 20],
      ["`outer $" + "{/* , */ value}` , tail", [","], 24],
    ] as const) {
      const cursor = parserCursor(sourceText);

      expect(expectedExpressionEnd(cursor, terminators)).toBe(expectedEnd);
      expect(scanExpressionEnd(cursor, terminators)).toBe(expectedEnd);
    }
  });

  it("keeps balanced scanning equivalent to the oracle", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BALANCED_DELIMITER_CASES),
        GENERATED_BODY,
        (delimiters, body) => {
          const sourceText = `${delimiters.open}${body}`;
          const cursor = parserCursor(sourceText);

          expect(scanBalancedEnd(cursor, delimiters.open, delimiters.close)).toBe(
            expectedBalancedEnd(cursor, delimiters.open, delimiters.close),
          );
        },
      ),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("keeps expression scanning equivalent to the oracle", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EXPRESSION_TERMINATOR_CASES),
        GENERATED_BODY,
        (terminators, body) => {
          const cursor = parserCursor(body);

          expect(scanExpressionEnd(cursor, terminators)).toBe(
            expectedExpressionEnd(cursor, terminators),
          );
        },
      ),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});

/** Creates a parser cursor spanning one generated source string. */
const parserCursor = (text: string): ParserCursor => {
  return {
    file: createOriginalSourceFile({
      filePath: "fixtures/balanced-end-parity.js",
      sourceText: text,
    }),
    text,
    index: 0,
    endIndex: text.length,
  };
};

/** Frozen copy of the pre-refactor metadata balanced scanner. */
const expectedBalancedEnd = (
  cursor: ParserCursor,
  open: "{" | "[" | "(",
  close: "}" | "]" | ")",
): number => {
  let depth = 0;
  for (let index = cursor.index; index < cursor.endIndex; index += 1) {
    const character = cursor.text[index] ?? "";
    const commentEndIndex = expectedCommentEnd(cursor.text, index, cursor.endIndex);
    if (commentEndIndex !== undefined) {
      index = commentEndIndex - 1;
      continue;
    }
    if (isExpectedStringLikeDelimiter(character)) {
      index = expectedDelimitedEnd(cursor.text, index, character, cursor.endIndex) - 1;
      continue;
    }
    if (character === open) {
      depth += 1;
    }
    if (character === close) {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return cursor.endIndex;
};

/** Frozen copy of the pre-refactor metadata expression scanner. */
const expectedExpressionEnd = (cursor: ParserCursor, terminators: readonly string[]): number => {
  let depth: ExpressionDepth = { braceDepth: 0, bracketDepth: 0, parenDepth: 0 };
  let index = cursor.index;
  while (index < cursor.endIndex) {
    const character = cursor.text[index] ?? "";
    if (isExpectedStringLikeDelimiter(character)) {
      index = expectedDelimitedEnd(cursor.text, index, character, cursor.endIndex);
      continue;
    }
    const commentEndIndex = expectedCommentEnd(cursor.text, index, cursor.endIndex);
    if (commentEndIndex !== undefined) {
      index = commentEndIndex;
      continue;
    }
    if (isExpectedExpressionTerminator(character, terminators, depth)) {
      return expectedTrimTrailingTriviaIndex(cursor.text, cursor.index, index);
    }
    depth = expectedNextExpressionDepth(depth, character);
    index += 1;
  }
  return expectedTrimTrailingTriviaIndex(cursor.text, cursor.index, index);
};

/** Frozen copy of the metadata delimited-end scanner. */
const expectedDelimitedEnd = (
  text: string,
  startIndex: number,
  delimiter: "'" | '"' | "`",
  endIndex: number,
): number => {
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const character = text[index] ?? "";
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (delimiter === "`" && text.startsWith("${", index)) {
      index = expectedTemplateExpressionEnd(text, index + 2, endIndex) - 1;
      continue;
    }
    if (character === delimiter) {
      return index + 1;
    }
  }
  return endIndex;
};

/** Frozen copy of the template interpolation scanner used by delimited scans. */
const expectedTemplateExpressionEnd = (
  text: string,
  startIndex: number,
  endIndex: number,
): number => {
  let depth = 1;
  for (let index = startIndex; index < endIndex; index += 1) {
    const character = text[index] ?? "";
    if (isExpectedStringLikeDelimiter(character)) {
      index = expectedDelimitedEnd(text, index, character, endIndex) - 1;
      continue;
    }
    const commentEndIndex = expectedCommentEnd(text, index, endIndex);
    if (commentEndIndex !== undefined) {
      index = commentEndIndex - 1;
      continue;
    }
    if (character === "{") {
      depth += 1;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return endIndex;
};

/** Frozen copy of the duplicated comment dispatch used by metadata scans. */
const expectedCommentEnd = (
  text: string,
  startIndex: number,
  endIndex: number,
): number | undefined => {
  if (text.startsWith("//", startIndex)) {
    return expectedLineCommentEnd(text, startIndex + 2, endIndex);
  }
  if (text.startsWith("/*", startIndex)) {
    return expectedBlockCommentEnd(text, startIndex + 2, endIndex);
  }
  return undefined;
};

/** Frozen line-comment scanner: content end, not terminator end. */
const expectedLineCommentEnd = (text: string, startIndex: number, endIndex: number): number => {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (isExpectedLineTerminator(text[index] ?? "")) {
      return index;
    }
  }
  return endIndex;
};

/** Frozen line-terminator guard used by the copied scanner oracles. */
const isExpectedLineTerminator = (character: string): boolean => {
  return ["\n", "\r", "\u2028", "\u2029"].includes(character);
};

/** Frozen block-comment scanner. */
const expectedBlockCommentEnd = (text: string, startIndex: number, endIndex: number): number => {
  for (let index = startIndex; index + 1 < endIndex; index += 1) {
    if (text[index] === "*" && text[index + 1] === "/") {
      return index + 2;
    }
  }
  return endIndex;
};

/** Frozen delimiter guard used by the metadata scanner oracles. */
const isExpectedStringLikeDelimiter = (character: string): character is "'" | '"' | "`" => {
  return character === "'" || character === '"' || character === "`";
};

/** Frozen terminator guard used by the expression scanner. */
const isExpectedExpressionTerminator = (
  character: string,
  terminators: readonly string[],
  depth: ExpressionDepth,
): boolean => {
  if (!isExpectedDelimiterDepthTopLevel(depth)) {
    return false;
  }
  return terminators.includes(character);
};

/** Frozen delimiter-depth top-level check. */
const isExpectedDelimiterDepthTopLevel = (depth: ExpressionDepth): boolean => {
  return depth.braceDepth === 0 && depth.bracketDepth === 0 && depth.parenDepth === 0;
};

/** Frozen expression-depth transition. */
const expectedNextExpressionDepth = (
  depth: ExpressionDepth,
  character: string,
): ExpressionDepth => {
  switch (character) {
    case "{":
      return { ...depth, braceDepth: depth.braceDepth + 1 };
    case "}":
      return { ...depth, braceDepth: Math.max(0, depth.braceDepth - 1) };
    case "[":
      return { ...depth, bracketDepth: depth.bracketDepth + 1 };
    case "]":
      return { ...depth, bracketDepth: Math.max(0, depth.bracketDepth - 1) };
    case "(":
      return { ...depth, parenDepth: depth.parenDepth + 1 };
    case ")":
      return { ...depth, parenDepth: Math.max(0, depth.parenDepth - 1) };
    default:
      return depth;
  }
};

/** Frozen trailing-trivia trim from the expression scanner. */
const expectedTrimTrailingTriviaIndex = (
  text: string,
  startIndex: number,
  endIndex: number,
): number => {
  let trimmedEndIndex = endIndex;
  while (trimmedEndIndex > startIndex && isExpectedWhitespace(text[trimmedEndIndex - 1] ?? "")) {
    trimmedEndIndex -= 1;
  }
  return trimmedEndIndex;
};

/** Frozen metadata whitespace classifier. */
const isExpectedWhitespace = (character: string): boolean => {
  return /\s/u.test(character);
};
