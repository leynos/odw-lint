/** @file Differential property tests for delimited scanner refactors. */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { scanEscapedDelimitedEnd } from "../../src/static-analysis/source-mask-delimiters";
import { scanDelimitedEnd } from "../../src/static-analysis/workflow-metadata-comment-scan";
import { SOURCE_SPAN_PROPERTY_RUNNER } from "./source-file-property-oracle";

type SourceMaskDelimiter = "'" | '"' | "`" | "/";
type MetadataDelimiter = "'" | '"' | "`";

const SOURCE_FRAGMENT = fc.constantFrom(
  "",
  "a",
  " ",
  "{",
  "}",
  "$",
  "${",
  "\\",
  "\\'",
  '\\"',
  "\\`",
  "// } \n",
  "/* } */",
  "\r\n",
  "\u2028",
  "'",
  '"',
  "`",
  "/",
);
const GENERATED_BODY = fc.array(SOURCE_FRAGMENT, { maxLength: 24 }).map((parts) => parts.join(""));

describe("delimited scanner parity", () => {
  it("keeps source-mask escaped-delimited scanning equivalent to the oracle", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SourceMaskDelimiter>("'", '"', "`", "/"),
        GENERATED_BODY,
        (delimiter, body) => {
          const sourceText = `${delimiter}${body}`;

          expect(scanEscapedDelimitedEnd(sourceText, 0, delimiter)).toBe(
            expectedEscapedDelimitedEnd(sourceText, 0, delimiter),
          );
        },
      ),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });

  it("keeps metadata delimited scanning equivalent to the oracle", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<MetadataDelimiter>("'", '"', "`"),
        GENERATED_BODY,
        (delimiter, body) => {
          const sourceText = `${delimiter}${body}`;

          expect(scanDelimitedEnd(sourceText, 0, delimiter, sourceText.length)).toBe(
            expectedDelimitedEnd(sourceText, 0, delimiter, sourceText.length),
          );
        },
      ),
      SOURCE_SPAN_PROPERTY_RUNNER,
    );
  });
});

/** Frozen copy of the pre-refactor source-mask delimited-end scanner. */
const expectedEscapedDelimitedEnd = (
  text: string,
  startIndex: number,
  delimiter: string,
): number => {
  let index = startIndex + 1;

  while (index < text.length) {
    const character = text[index] ?? "";
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === delimiter) {
      return index + 1;
    }
    index += 1;
  }

  return text.length;
};

/** Frozen copy of the pre-refactor metadata delimited-end scanner. */
const expectedDelimitedEnd = (
  text: string,
  startIndex: number,
  delimiter: MetadataDelimiter,
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

/** Frozen copy of the pre-refactor template interpolation scanner. */
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
    if (["\n", "\r", "\u2028", "\u2029"].includes(text[index] ?? "")) {
      return index;
    }
  }
  return endIndex;
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

/** Frozen delimiter guard used by the metadata template-expression oracle. */
const isExpectedStringLikeDelimiter = (character: string): character is MetadataDelimiter => {
  return character === "'" || character === '"' || character === "`";
};
