/** @file Shared delimiter and comment scanners for metadata parsing. */

/**
 * Checks for JavaScript line terminators.
 *
 * @param character - Character to test.
 * @returns `true` when the character is a JavaScript line terminator.
 */
export const isLineTerminator = (character: string): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

/**
 * Scans one quoted or template-delimited region.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive text index of the opening delimiter.
 * @param delimiter - String or template delimiter to match.
 * @param endIndex - Exclusive maximum scan index.
 * @returns The index just after the closing delimiter, or `endIndex`.
 */
export const scanDelimitedEnd = (
  text: string,
  startIndex: number,
  delimiter: string,
  endIndex: number,
): number => {
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const character = text[index] ?? "";
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (delimiter === "`" && text.startsWith("${", index)) {
      index = scanTemplateExpressionEnd(text, index + 2, endIndex) - 1;
      continue;
    }
    if (character === delimiter) {
      return index + 1;
    }
  }
  return endIndex;
};

/**
 * Scans a line comment body and preserves line terminator ownership.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive text index after the opening `//`.
 * @param endIndex - Exclusive maximum scan index.
 * @returns The line terminator index, or `endIndex`.
 */
export const scanLineCommentEnd = (text: string, startIndex: number, endIndex: number): number => {
  for (let index = startIndex; index < endIndex; index += 1) {
    const character = text[index] ?? "";
    if (isLineTerminator(character)) {
      return index;
    }
  }
  return endIndex;
};

/**
 * Scans a block comment and falls back to EOF when unterminated or out of range.
 *
 * @param text - Source text to scan.
 * @param startIndex - Inclusive text index after the opening block marker.
 * @param endIndex - Exclusive maximum scan index.
 * @returns The index just after the closing block marker, or `endIndex`.
 */
export const scanBlockCommentEnd = (text: string, startIndex: number, endIndex: number): number => {
  for (let index = startIndex; index + 1 < endIndex; index += 1) {
    if (text[index] === "*" && text[index + 1] === "/") {
      return index + 2;
    }
  }
  return endIndex;
};

/** Scans a template interpolation expression while respecting nested delimiters. */
const scanTemplateExpressionEnd = (text: string, startIndex: number, endIndex: number): number => {
  let depth = 1;
  for (let index = startIndex; index < endIndex; index += 1) {
    const character = text[index] ?? "";
    if (isStringDelimiter(character)) {
      index = scanDelimitedEnd(text, index, character, endIndex) - 1;
      continue;
    }
    const commentEndIndex = scanCommentEnd(text, index, endIndex);
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

/** Scans a comment from the current index when present. */
const scanCommentEnd = (text: string, startIndex: number, endIndex: number): number | undefined => {
  if (text.startsWith("//", startIndex)) {
    return scanLineCommentEnd(text, startIndex + 2, endIndex);
  }
  if (text.startsWith("/*", startIndex)) {
    return scanBlockCommentEnd(text, startIndex + 2, endIndex);
  }
  return undefined;
};

/** Checks whether a character is a string or template delimiter. */
const isStringDelimiter = (character: string): character is "'" | '"' | "`" => {
  return character === "'" || character === '"' || character === "`";
};
