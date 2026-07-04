/**
 * @file Shared JavaScript token-grammar primitives for source scanners.
 *
 * This internal module is the single home for low-level UTF-16 string logic
 * shared by the source-mask and workflow-metadata scanner families, plus the
 * original-source scanner where it needs the same classification rules. Keep
 * it free of mask-range, metadata-parser, and diagnostic types so scanner
 * families compose it without inheriting each other's domain concepts.
 */

import {
  isAsciiIdentifierCharacter,
  isIdentifierPartCharacter,
  isIdentifierStartCharacter,
} from "./javascript-identifiers";

/** JavaScript line terminators recognised by static source scanners. */
const SOURCE_LINE_TERMINATORS = new Set(["\n", "\r", "\u2028", "\u2029"]);

export type QuotedStringDelimiter = "'" | '"';
export type TemplateDelimiter = "`";
export type RegexDelimiter = "/";
export type StringLikeDelimiter = QuotedStringDelimiter | TemplateDelimiter;
export type DelimiterDepthState = Readonly<{
  braceDepth: number;
  bracketDepth: number;
  parenDepth: number;
}>;

/**
 * Checks whether a character is a JavaScript source line terminator.
 *
 * @param character - Source character to classify.
 * @returns True for LF, CR, U+2028, and U+2029 only.
 */
export const isSourceLineTerminator = (character: string): boolean => {
  return SOURCE_LINE_TERMINATORS.has(character);
};

/**
 * Checks whether `index` starts a CRLF line terminator pair.
 *
 * @param text - Source text to inspect.
 * @param index - UTF-16 index of the possible carriage return.
 * @returns True when the two code units at `index` are CR followed by LF.
 */
export const isCrLfAt = (text: string, index: number): boolean => {
  return text[index] === "\r" && text[index + 1] === "\n";
};

/**
 * Reads the source character at one UTF-16 source index.
 *
 * @param text - Source text to read.
 * @param index - UTF-16 index to inspect.
 * @returns The full code point as a string, or `""` at or past EOF. If `index`
 * lands on a lone low surrogate, returns that surrogate code unit as-is.
 */
export const codePointStringAt = (text: string, index: number): string => {
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? "" : String.fromCodePoint(codePoint);
};

/**
 * Finds the index after one backslash-escaped UTF-16 unit.
 *
 * @param _text - Source text that owns the index.
 * @param backslashIndex - Index where the caller already matched `\`.
 * @returns `backslashIndex + 2`; callers own EOF and line-continuation rules.
 */
export const indexAfterEscapedUnit = (_text: string, backslashIndex: number): number => {
  return backslashIndex + 2;
};

/**
 * Updates nested delimiter depth for one source character.
 *
 * @param depth - Delimiter depth before reading the character.
 * @param character - Current source character.
 * @returns Updated delimiter depth, clamped at zero for unmatched closers.
 */
export const nextDelimiterDepthState = (
  depth: DelimiterDepthState,
  character: string,
): DelimiterDepthState => {
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

/**
 * Checks whether delimiter depth is at top level.
 *
 * @param depth - Current delimiter depth.
 * @returns True when no brace, bracket, or parenthesis is open.
 */
export const isDelimiterDepthTopLevel = (depth: DelimiterDepthState): boolean => {
  return depth.braceDepth === 0 && depth.bracketDepth === 0 && depth.parenDepth === 0;
};

/**
 * Finds a line-comment body end without consuming the line terminator.
 *
 * @param text - Source text to scan.
 * @param start - Inclusive index after the opening `//`.
 * @param end - Exclusive maximum scan index.
 * @returns The terminator index, or `end` when none is found.
 */
export const lineCommentContentEnd = (text: string, start: number, end: number): number => {
  for (let index = start; index < end; index += 1) {
    if (isSourceLineTerminator(text[index] ?? "")) {
      return index;
    }
  }
  return end;
};

/**
 * Finds a line-comment end while consuming its terminator.
 *
 * @param text - Source text to scan.
 * @param start - Inclusive index after the opening `//`.
 * @returns The index after LF, CR, CRLF, U+2028, or U+2029; otherwise EOF.
 */
export const lineCommentTerminatorEnd = (text: string, start: number): number => {
  const terminatorIndex = lineCommentContentEnd(text, start, text.length);
  if (terminatorIndex === text.length) {
    return text.length;
  }
  return isCrLfAt(text, terminatorIndex) ? terminatorIndex + 2 : terminatorIndex + 1;
};

/**
 * Finds a block-comment end within a bounded scan region.
 *
 * @param text - Source text to scan.
 * @param start - Inclusive index after the opening `/*`.
 * @param end - Exclusive maximum scan index.
 * @returns The index after the closing block marker, or `end` when unterminated.
 */
export const blockCommentEnd = (text: string, start: number, end: number): number => {
  for (let index = start; index + 1 < end; index += 1) {
    if (text[index] === "*" && text[index + 1] === "/") {
      return index + 2;
    }
  }
  return end;
};

/**
 * Dispatches from a possible comment opener to the matching comment end.
 *
 * @param text - Source text to scan.
 * @param index - Inclusive index of a possible `/` comment opener.
 * @param end - Exclusive maximum scan index.
 * @returns Comment end for `//` or `/*`, otherwise `undefined`.
 */
export const commentDispatchEnd = (
  text: string,
  index: number,
  end: number,
): number | undefined => {
  if (text.startsWith("//", index)) {
    return lineCommentContentEnd(text, index + 2, end);
  }
  if (text.startsWith("/*", index)) {
    return blockCommentEnd(text, index + 2, end);
  }
  return undefined;
};

/**
 * Checks for a single-quoted or double-quoted string start.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can delimit a quoted string.
 */
export const isQuotedStringDelimiter = (character: string): character is QuotedStringDelimiter => {
  return character === "'" || character === '"';
};

/**
 * Checks for a template-literal delimiter.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can delimit a template literal.
 */
export const isTemplateDelimiter = (character: string): character is TemplateDelimiter => {
  return character === "`";
};

/**
 * Checks for a regex-literal delimiter.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can delimit a regex literal.
 */
export const isRegexDelimiter = (character: string): character is RegexDelimiter => {
  return character === "/";
};

/**
 * Checks for a nested string-like token start.
 *
 * @param character - Source character to classify.
 * @returns Whether the character can open string-like template content.
 */
export const isStringLikeDelimiter = (character: string): character is StringLikeDelimiter => {
  return isQuotedStringDelimiter(character) || isTemplateDelimiter(character);
};

/**
 * Scans a template interpolation expression while respecting nested delimiters.
 *
 * @param text - Source text to scan.
 * @param start - Inclusive index after the opening `${`.
 * @param end - Exclusive maximum scan index.
 * @returns The index after the matching `}`, or `end` when unterminated.
 */
export const templateExpressionEnd = (text: string, start: number, end: number): number => {
  const stringLikeRegionEnd = (startIndex: number, delimiter: StringLikeDelimiter): number => {
    for (let index = startIndex + 1; index < end; index += 1) {
      const character = text[index] ?? "";
      if (character === "\\") {
        index = indexAfterEscapedUnit(text, index) - 1;
        continue;
      }
      if (delimiter === "`" && text.startsWith("${", index)) {
        index = expressionEnd(index + 2) - 1;
        continue;
      }
      if (character === delimiter) {
        return index + 1;
      }
    }
    return end;
  };

  const expressionEnd = (startIndex: number): number => {
    let depth = 1;
    for (let index = startIndex; index < end; index += 1) {
      const character = text[index] ?? "";
      if (isStringLikeDelimiter(character)) {
        index = stringLikeRegionEnd(index, character) - 1;
        continue;
      }
      const commentEndIndex = commentDispatchEnd(text, index, end);
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
    return end;
  };

  return expressionEnd(start);
};

/**
 * Finds the end of a JavaScript identifier run.
 *
 * @param text - Source text to scan.
 * @param start - Inclusive UTF-16 index of the possible identifier start.
 * @param end - Exclusive maximum scan index.
 * @returns Exclusive identifier end index, or `undefined` when no run starts.
 */
export const identifierRunEnd = (text: string, start: number, end: number): number | undefined => {
  const firstCharacter = codePointStringAt(text, start);
  if (!isIdentifierStartCharacter(firstCharacter)) {
    return undefined;
  }

  let index = start + firstCharacter.length;
  while (index < end) {
    const character = codePointStringAt(text, index);
    if (!isIdentifierPartCharacter(character)) {
      return index;
    }
    index += character.length;
  }

  return index;
};

/**
 * Finds the end of a forward ASCII identifier-like run.
 *
 * @param text - Source text to scan.
 * @param start - Inclusive UTF-16 index of the first possible run character.
 * @returns Exclusive run end index.
 */
export const asciiIdentifierRunEnd = (text: string, start: number): number => {
  let index = start;

  while (index < text.length && isAsciiIdentifierCharacter(text[index])) {
    index += 1;
  }

  return index;
};

/**
 * Finds the start of a backward ASCII identifier-like run.
 *
 * @param text - Source text to scan.
 * @param end - Exclusive UTF-16 index after the last possible run character.
 * @returns Inclusive run start index.
 */
export const asciiIdentifierRunStart = (text: string, end: number): number => {
  let index = end - 1;

  while (index >= 0 && isAsciiIdentifierCharacter(text[index])) {
    index -= 1;
  }

  return index + 1;
};
