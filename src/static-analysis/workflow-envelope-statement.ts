/** @file Top-level statement scanning helpers for workflow envelope extraction. */

export type DepthState = Readonly<{
  braceDepth: number;
  bracketDepth: number;
  parenDepth: number;
}>;

/**
 * Finds the exclusive end of a top-level statement or declaration.
 *
 * @param maskedText - Source text with inert regions blanked.
 * @param startIndex - Text index where the statement scan should begin.
 * @returns The exclusive statement-end text index.
 */
export const topLevelStatementEndIndex = (maskedText: string, startIndex: number): number => {
  let depth = { braceDepth: 0, bracketDepth: 0, parenDepth: 0 };
  let previousSignificant: string | undefined;
  const nextSignificantAt = nextSignificantCharacters(maskedText);

  for (let index = startIndex; index < maskedText.length; index += 1) {
    const character = maskedText[index] ?? "";
    if (isStatementTerminator(character, depth)) {
      return index + 1;
    }
    if (isLineEndFallback(character, depth, previousSignificant, nextSignificantAt[index + 1])) {
      return index;
    }
    depth = nextDepthState(depth, character);
    if (!/\s/u.test(character)) {
      previousSignificant = character;
    }
  }

  return maskedText.length;
};

/**
 * Updates delimiter depth after one source character.
 *
 * @param depth - Delimiter depth before reading the character.
 * @param character - Current masked source character.
 * @returns Updated delimiter depth.
 */
export const nextDepthState = (depth: DepthState, character: string): DepthState => {
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
 * Checks whether scanner depth is at the workflow top level.
 *
 * @param depth - Current delimiter depth.
 * @returns True when no brace, bracket, or parenthesis is open.
 */
export const isTopLevel = (depth: DepthState): boolean => {
  return depth.braceDepth === 0 && depth.bracketDepth === 0 && depth.parenDepth === 0;
};

/** Checks for a semicolon that ends the current top-level statement. */
const isStatementTerminator = (character: string, depth: DepthState): boolean => {
  return character === ";" && isTopLevel(depth);
};

/** Checks for an ASI-safe line boundary fallback when there is no semicolon. */
const isLineEndFallback = (
  character: string,
  depth: DepthState,
  previousSignificant: string | undefined,
  nextSignificant: string | undefined,
): boolean => {
  if (!isTopLevel(depth) || !isLineBreak(character)) {
    return false;
  }

  return canEndBeforeLineBreak(previousSignificant) && !canContinueAfterLineBreak(nextSignificant);
};

/** Checks whether one source character is a JavaScript line break. */
const isLineBreak = (character: string): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

/** Precomputes the next non-whitespace character at every source index. */
const nextSignificantCharacters = (text: string): readonly (string | undefined)[] => {
  const nextByIndex = new Array<string | undefined>(text.length + 1);
  let nextSignificant: string | undefined;

  for (let cursor = text.length - 1; cursor >= 0; cursor -= 1) {
    const character = text[cursor] ?? "";
    if (!/\s/u.test(character)) {
      nextSignificant = character;
    }
    nextByIndex[cursor] = nextSignificant;
  }
  nextByIndex[text.length] = undefined;

  return nextByIndex;
};

/** Checks whether a line break follows something that can close a statement. */
const canEndBeforeLineBreak = (character: string | undefined): boolean => {
  return character !== undefined && !CONTINUATION_BEFORE_LINE_BREAK.has(character);
};

/** Checks whether the next line starts with a same-statement continuation. */
const canContinueAfterLineBreak = (character: string | undefined): boolean => {
  return character !== undefined && CONTINUATION_AFTER_LINE_BREAK.has(character);
};

const CONTINUATION_BEFORE_LINE_BREAK = new Set([
  ".",
  "=",
  ",",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "?",
  ":",
]);
const CONTINUATION_AFTER_LINE_BREAK = new Set([".", "(", "[", "&", "|", "?", ":"]);
