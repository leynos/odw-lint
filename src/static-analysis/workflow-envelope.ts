/** @file Static, non-executing workflow envelope scanner for ODW source files. */

import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic, SourceSpan } from "../diagnostics/types";
import { maskNonCodeSource } from "./source-mask";
import { spanFromOffsets, spanFromTextIndexes } from "./source-position";
import type { OriginalSourceFile, WorkflowEnvelopeScanResult, WorkflowMetaValue } from "./types";
import {
  isTopLevel,
  nextDepthState,
  topLevelStatementEndIndex,
} from "./workflow-envelope-statement";
import { findUnsupportedDeclarations } from "./workflow-envelope-unsupported";

const META_EXPORT_PATTERN = /export\s+const\s+meta\s*=/y;
const META_REQUIRED_RULE = makeRuleId("odw/meta-required");
const NO_IMPORT_EXPORT_RULE = makeRuleId("odw/no-import-export");
const META_REQUIRED_MESSAGE = "Workflow metadata must declare export const meta.";
const NO_IMPORT_EXPORT_MESSAGE = "Workflow body must not add top-level imports or exports.";

type MetaDeclarationMatch = {
  readonly declarationStartIndex: number;
  readonly declarationEndIndex: number;
  readonly exportStartIndex: number;
  readonly exportEndIndex: number;
  readonly assignmentStartIndex: number;
  readonly assignmentEndIndex: number;
};

/**
 * Scans one original workflow source file for its static ODW envelope.
 *
 * @param sourceFile - Factory-created original workflow source file.
 * @returns Frozen envelope facts and diagnostics for this extraction slice.
 */
export const scanWorkflowEnvelope = (
  sourceFile: OriginalSourceFile,
): WorkflowEnvelopeScanResult => {
  const maskedText = maskNonCodeSource(sourceFile).maskedText;
  const metaDeclaration = findMetaDeclaration(maskedText);

  if (metaDeclaration === undefined) {
    return Object.freeze({
      status: "missing-meta",
      sourceFile,
      diagnostics: Object.freeze([metaRequiredDiagnostic(sourceFile)]),
      envelope: undefined,
    });
  }

  const metaValue = scanMetaValue(sourceFile, maskedText, metaDeclaration.assignmentEndIndex);
  const unsupportedDeclarations = findUnsupportedDeclarations(
    sourceFile,
    maskedText,
    metaDeclaration,
  );
  const diagnostics = Object.freeze(
    unsupportedDeclarations.map((syntax) => noImportExportDiagnostic(sourceFile, syntax.span)),
  );
  const envelope = Object.freeze({
    sourceFile,
    metaDeclarationSpan: spanFromTextIndexes(
      sourceFile,
      metaDeclaration.declarationStartIndex,
      metaDeclaration.declarationEndIndex,
    ),
    metaExportKeywordSpan: spanFromTextIndexes(
      sourceFile,
      metaDeclaration.exportStartIndex,
      metaDeclaration.exportEndIndex,
    ),
    metaAssignmentOperatorSpan: spanFromTextIndexes(
      sourceFile,
      metaDeclaration.assignmentStartIndex,
      metaDeclaration.assignmentEndIndex,
    ),
    metaValue,
    bodySpan: bodySpanForMetaValue(sourceFile, maskedText, metaDeclaration),
    unsupportedDeclarations,
  });

  return Object.freeze({
    status: "scanned",
    sourceFile,
    diagnostics,
    envelope,
  });
};

/** Finds the first real masked `export const meta =` declaration. */
const findMetaDeclaration = (maskedText: string): MetaDeclarationMatch | undefined => {
  let depth = { braceDepth: 0, bracketDepth: 0, parenDepth: 0 };

  for (let index = 0; index < maskedText.length; index += 1) {
    if (isTopLevel(depth)) {
      const metaDeclaration = metaDeclarationAt(maskedText, index);
      if (metaDeclaration !== undefined) {
        return metaDeclaration;
      }
    }
    depth = nextDepthState(depth, maskedText[index] ?? "");
  }

  return undefined;
};

/** Builds metadata declaration facts when a declaration starts at `index`. */
const metaDeclarationAt = (maskedText: string, index: number): MetaDeclarationMatch | undefined => {
  if (isIdentifierPart(previousCharacter(maskedText, index))) {
    return undefined;
  }

  META_EXPORT_PATTERN.lastIndex = index;
  const match = META_EXPORT_PATTERN.exec(maskedText);
  if (match === null) {
    return undefined;
  }

  const matchedText = match[0];
  const assignmentRelativeIndex = matchedText.lastIndexOf("=");
  const exportStartIndex = index;
  const assignmentStartIndex = index + assignmentRelativeIndex;

  return Object.freeze({
    declarationStartIndex: index,
    declarationEndIndex: index + matchedText.length,
    exportStartIndex,
    exportEndIndex: exportStartIndex + "export".length,
    assignmentStartIndex,
    assignmentEndIndex: assignmentStartIndex + 1,
  });
};

/** Returns the source character immediately before `index`, if any. */
const previousCharacter = (text: string, index: number): string | undefined => {
  return index <= 0 ? undefined : text[index - 1];
};

/** Checks whether a character can continue a JavaScript identifier. */
const isIdentifierPart = (character: string | undefined): boolean => {
  return character !== undefined && /[$_\p{ID_Continue}]/u.test(character);
};

/** Scans the metadata value state after the assignment operator. */
const scanMetaValue = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  valueSearchIndex: number,
): WorkflowMetaValue => {
  const valueStartIndex = nextNonWhitespaceIndex(maskedText, valueSearchIndex);
  if (valueStartIndex === undefined) {
    return Object.freeze({
      kind: "missing-value",
      span: spanFromTextIndexes(sourceFile, maskedText.length, maskedText.length),
    });
  }

  if (maskedText[valueStartIndex] === ";") {
    return Object.freeze({
      kind: "missing-value",
      span: spanFromTextIndexes(sourceFile, valueStartIndex, valueStartIndex),
    });
  }

  if (maskedText[valueStartIndex] !== "{") {
    return nonObjectMetaValue(sourceFile, maskedText, valueStartIndex);
  }

  return objectMetaValue(sourceFile, maskedText, valueStartIndex);
};

/** Builds metadata state for computed or otherwise non-object expressions. */
const nonObjectMetaValue = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  startIndex: number,
): WorkflowMetaValue => {
  const statementEndIndex = topLevelStatementEndIndex(maskedText, startIndex);
  const expressionEndIndex = trimStatementTerminator(
    maskedText,
    startIndex,
    trimTrailingWhitespaceIndex(maskedText, startIndex, statementEndIndex),
  );

  return Object.freeze({
    kind: "non-object-expression",
    expressionStartSpan: spanFromTextIndexes(sourceFile, startIndex, startIndex + 1),
    expressionSpan: spanFromTextIndexes(sourceFile, startIndex, expressionEndIndex),
  });
};

/** Builds metadata state for object literals and unterminated objects. */
const objectMetaValue = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  startIndex: number,
): WorkflowMetaValue => {
  const closeBraceIndex = matchingBraceIndex(maskedText, startIndex);
  if (closeBraceIndex === undefined) {
    return Object.freeze({
      kind: "unterminated-object",
      openBraceSpan: spanFromTextIndexes(sourceFile, startIndex, startIndex + 1),
      span: spanFromTextIndexes(sourceFile, startIndex, maskedText.length),
    });
  }

  return Object.freeze({
    kind: "object",
    span: spanFromTextIndexes(sourceFile, startIndex, closeBraceIndex + 1),
    openBraceSpan: spanFromTextIndexes(sourceFile, startIndex, startIndex + 1),
    closeBraceSpan: spanFromTextIndexes(sourceFile, closeBraceIndex, closeBraceIndex + 1),
  });
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

/** Finds a matching `}` for an object that starts at `startIndex`. */
const matchingBraceIndex = (maskedText: string, startIndex: number): number | undefined => {
  let depth = 0;

  for (let index = startIndex; index < maskedText.length; index += 1) {
    const character = maskedText[index];
    if (character === "{") {
      depth += 1;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
};

/** Builds the body span from the end of the extractable metadata prefix. */
const bodySpanForMetaValue = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  metaDeclaration: MetaDeclarationMatch,
): SourceSpan => {
  const startOffset = bodyStartOffset(sourceFile, maskedText, metaDeclaration);
  return spanFromOffsets(sourceFile, startOffset, sourceFile.byteLength);
};

/** Chooses the byte offset where body parsing should later begin. */
const bodyStartOffset = (
  sourceFile: OriginalSourceFile,
  maskedText: string,
  metaDeclaration: MetaDeclarationMatch,
): number => {
  const bodyStartIndex = topLevelStatementEndIndex(maskedText, metaDeclaration.assignmentEndIndex);
  return spanFromTextIndexes(sourceFile, bodyStartIndex, bodyStartIndex).start.offset;
};

/** Removes trailing whitespace from an expression span without crossing start. */
const trimTrailingWhitespaceIndex = (
  text: string,
  startIndex: number,
  endIndex: number,
): number => {
  let trimmedEndIndex = endIndex;
  while (trimmedEndIndex > startIndex && /\s/u.test(text[trimmedEndIndex - 1] ?? "")) {
    trimmedEndIndex -= 1;
  }
  return trimmedEndIndex;
};

/** Removes a trailing statement terminator from a metadata expression span. */
const trimStatementTerminator = (text: string, startIndex: number, endIndex: number): number => {
  if (endIndex <= startIndex) {
    return endIndex;
  }

  return text[endIndex - 1] === ";" ? endIndex - 1 : endIndex;
};

/** Builds a missing-metadata diagnostic at the start of the original source. */
const metaRequiredDiagnostic = (sourceFile: OriginalSourceFile): Diagnostic => {
  return Object.freeze({
    file: sourceFile.filePath,
    rule: META_REQUIRED_RULE,
    severity: "error",
    message: META_REQUIRED_MESSAGE,
    span: spanFromOffsets(sourceFile, 0, 0),
  });
};

/** Builds an unsupported import/export diagnostic for one declaration span. */
const noImportExportDiagnostic = (sourceFile: OriginalSourceFile, span: SourceSpan): Diagnostic => {
  return Object.freeze({
    file: sourceFile.filePath,
    rule: NO_IMPORT_EXPORT_RULE,
    severity: "error",
    message: NO_IMPORT_EXPORT_MESSAGE,
    span,
  });
};
