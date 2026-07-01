/** @file Unsupported import/export scanner for static workflow envelopes. */

import { spanFromTextIndexes } from "./source-position";
import type { OriginalSourceFile, UnsupportedWorkflowSyntax } from "./types";
import type { DepthState } from "./workflow-envelope-statement";
import {
  isTopLevel,
  nextDepthState,
  topLevelStatementEndIndex,
} from "./workflow-envelope-statement";

const IMPORT_EXPORT_PATTERN = /(?:import|export)/y;

type MetaExportBlankRange = {
  readonly exportStartIndex: number;
  readonly exportEndIndex: number;
};

type PreviousCodeBoundary = Readonly<{
  readonly character: string | undefined;
  readonly hasLineBreak: boolean;
}>;

/**
 * Collects unsupported top-level import/export syntax in source order.
 *
 * @param sourceFile - Original workflow source file used for byte spans.
 * @param maskedText - Source text with comments and inert regions blanked.
 * @param metaDeclaration - Metadata export range to ignore during scanning.
 * @returns Frozen unsupported syntax facts.
 */
export const findUnsupportedDeclarations = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  metaDeclaration: MetaExportBlankRange,
): readonly UnsupportedWorkflowSyntax[] => {
  const scannerText = maskedTextWithMetaExportBlanked(maskedText, metaDeclaration);
  const declarations: UnsupportedWorkflowSyntax[] = [];
  let depth = { braceDepth: 0, bracketDepth: 0, parenDepth: 0 };

  for (let index = 0; index < scannerText.length; index += 1) {
    const token = topLevelImportExportAt(scannerText, index, depth);
    if (token !== undefined) {
      const statementEndIndex = topLevelStatementEndIndex(scannerText, index);
      declarations.push(unsupportedSyntax(sourceFile, index, statementEndIndex, token));
      index = statementEndIndex - 1;
      continue;
    }
    depth = nextDepthState(depth, scannerText[index] ?? "");
  }

  return Object.freeze(declarations.map((declaration) => Object.freeze(declaration)));
};

/** Blanks the metadata export keyword so only extra exports remain visible. */
const maskedTextWithMetaExportBlanked = (
  maskedText: string,
  metaDeclaration: MetaExportBlankRange,
): string => {
  const characters = maskedText.split("");
  for (
    let index = metaDeclaration.exportStartIndex;
    index < metaDeclaration.exportEndIndex;
    index += 1
  ) {
    characters[index] = " ";
  }
  return characters.join("");
};

/** Returns a top-level import/export keyword at the current index, if any. */
const topLevelImportExportAt = (
  maskedText: string,
  index: number,
  depth: DepthState,
): "import" | "export" | undefined => {
  if (!isTopLevel(depth)) {
    return undefined;
  }

  IMPORT_EXPORT_PATTERN.lastIndex = index;
  const match = IMPORT_EXPORT_PATTERN.exec(maskedText);
  if (match === null) {
    return undefined;
  }

  const keyword = match[0] as "import" | "export";
  if (!hasKeywordBoundaries(maskedText, index, keyword)) {
    return undefined;
  }
  if (keyword === "import" && isUnsupportedImportAt(maskedText, index)) {
    return keyword;
  }
  if (keyword === "export" && isUnsupportedExportAt(maskedText, index)) {
    return keyword;
  }

  return undefined;
};

/** Checks that a candidate keyword is not embedded in a larger identifier. */
const hasKeywordBoundaries = (maskedText: string, index: number, keyword: string): boolean => {
  return (
    !isIdentifierPart(previousCodePoint(maskedText, index)) &&
    !isIdentifierPart(nextCodePoint(maskedText, index + keyword.length))
  );
};

/** Returns the full source code point immediately before `index`, if any. */
const previousCodePoint = (text: string, index: number): string | undefined => {
  return Array.from(text.slice(0, index)).at(-1);
};

/** Returns the full source code point at `index`, if any. */
const nextCodePoint = (text: string, index: number): string | undefined => {
  return Array.from(text.slice(index)).at(0);
};

/** Checks whether a character can continue a JavaScript identifier. */
const isIdentifierPart = (character: string | undefined): boolean => {
  return character !== undefined && /[$_\p{ID_Continue}]/u.test(character);
};

/** Checks whether an `import` keyword is syntax this scanner owns. */
const isUnsupportedImportAt = (maskedText: string, index: number): boolean => {
  if (previousNonWhitespaceCharacter(maskedText, index) === ".") {
    return false;
  }

  const nextCharacter = nextNonWhitespaceCharacter(maskedText, index + "import".length);
  if (nextCharacter === ".") {
    return false;
  }
  if (nextCharacter === "(") {
    return true;
  }

  return isTopLevelStatementStart(maskedText, index);
};

/** Checks whether an `export` keyword starts a declaration, not a property. */
const isUnsupportedExportAt = (maskedText: string, index: number): boolean => {
  if (previousNonWhitespaceCharacter(maskedText, index) === ".") {
    return false;
  }

  return isTopLevelStatementStart(maskedText, index);
};

/** Finds the previous visible non-whitespace character before `index`. */
const previousNonWhitespaceCharacter = (text: string, index: number): string | undefined => {
  return previousCodeBoundary(text, index).character;
};

/** Finds the next visible non-whitespace character from `index`. */
const nextNonWhitespaceCharacter = (text: string, index: number): string | undefined => {
  const nextIndex = nextNonWhitespaceIndex(text, index);
  return nextIndex === undefined ? undefined : text[nextIndex];
};

/** Finds the next non-whitespace source-text index. */
const nextNonWhitespaceIndex = (text: string, startIndex: number): number | undefined => {
  for (let index = startIndex; index < text.length; index += 1) {
    if (!/\s/u.test(text[index] ?? "")) {
      return index;
    }
  }

  return undefined;
};

/** Checks whether `index` is positioned where a top-level statement may begin. */
const isTopLevelStatementStart = (maskedText: string, index: number): boolean => {
  const previous = previousCodeBoundary(maskedText, index);
  return (
    previous.character === undefined ||
    previous.character === ";" ||
    previous.character === "}" ||
    previous.hasLineBreak
  );
};

/** Finds the previous visible character and whether whitespace crossed a line. */
const previousCodeBoundary = (text: string, index: number): PreviousCodeBoundary => {
  let hasLineBreak = false;

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const character = text[cursor] ?? "";
    if (isLineBreak(character)) {
      hasLineBreak = true;
    }
    if (!/\s/u.test(character)) {
      return { character, hasLineBreak };
    }
  }

  return { character: undefined, hasLineBreak };
};

/** Checks whether one source character is a JavaScript line break. */
const isLineBreak = (character: string): boolean => {
  return (
    character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029"
  );
};

/** Builds one unsupported declaration fact from its keyword index. */
const unsupportedSyntax = (
  sourceFile: OriginalSourceFile,
  startIndex: number,
  endIndex: number,
  keyword: "import" | "export",
): UnsupportedWorkflowSyntax => {
  const span = spanFromTextIndexes(sourceFile, startIndex, endIndex);

  return {
    kind: keyword,
    keyword,
    span,
    sourceText: sourceFile.sourceText.slice(startIndex, endIndex),
  };
};
