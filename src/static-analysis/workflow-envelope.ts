/** @file Static, non-executing workflow envelope scanner for ODW source files. */

import { RULE_CATALOGUE, type RuleDefinition, ruleDocsPath } from "../diagnostics/rule-catalogue";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic, SourceSpan } from "../diagnostics/types";
import { maskNonCodeSource } from "./source-mask";
import { spanFromOffsets, spanFromTextIndexes } from "./source-position";
import type { OriginalSourceFile, WorkflowEnvelopeScanResult } from "./types";
import { scanMetaValue } from "./workflow-envelope-meta-value";
import {
  isTopLevel,
  nextDepthState,
  topLevelStatementEndIndex,
} from "./workflow-envelope-statement";
import { findUnsupportedDeclarations } from "./workflow-envelope-unsupported";

const META_EXPORT_PATTERN = /export\s+const\s+meta\s*=/y;
const META_REQUIRED_RULE = makeRuleId("odw/meta-required");
const NO_IMPORT_EXPORT_RULE = makeRuleId("odw/no-import-export");
const META_REQUIRED_MESSAGE = "Workflow source must export literal metadata.";
const NO_IMPORT_EXPORT_MESSAGE = "Workflow body must not add top-level imports or exports.";

const META_REQUIRED_RULE_DEFINITION = ruleDefinitionFor(META_REQUIRED_RULE);
type MetaDeclarationMatch = {
  readonly declarationStartIndex: number;
  readonly declarationEndIndex: number;
  readonly exportStartIndex: number;
  readonly exportEndIndex: number;
  readonly assignmentStartIndex: number;
  readonly assignmentEndIndex: number;
};

/** Finds the catalogue definition for a diagnostic emitted by this scanner. */
function ruleDefinitionFor(ruleId: string): RuleDefinition {
  const matchingRule = RULE_CATALOGUE.find((rule) => String(rule.id) === ruleId);

  if (matchingRule === undefined) {
    throw new Error(`Workflow envelope scanner references uncatalogued rule ${ruleId}.`);
  }

  return matchingRule;
}
/**
 * Scans one original workflow source file for its static ODW envelope.
 *
 * @param sourceFile - Factory-created original workflow source file.
 * @returns Frozen envelope facts and diagnostics for this extraction slice.
 */
export const scanWorkflowEnvelope = (
  sourceFile: OriginalSourceFile,
): WorkflowEnvelopeScanResult => {
  const maskedSource = maskNonCodeSource(sourceFile);
  const { maskedText } = maskedSource;
  const metaDeclaration = findMetaDeclaration(maskedText);

  if (metaDeclaration === undefined) {
    return Object.freeze({
      status: "missing-meta",
      sourceFile,
      diagnostics: Object.freeze([metaRequiredDiagnostic(sourceFile)]),
      envelope: undefined,
    });
  }

  const metaValue = scanMetaValue(
    sourceFile,
    maskedText,
    maskedSource.ranges,
    metaDeclaration.assignmentEndIndex,
  );
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

/** Builds a missing-metadata diagnostic at the start of the original source. */
const metaRequiredDiagnostic = (sourceFile: OriginalSourceFile): Diagnostic => {
  return Object.freeze({
    file: sourceFile.filePath,
    rule: META_REQUIRED_RULE,
    severity: "error",
    message: META_REQUIRED_MESSAGE,
    span: spanFromOffsets(sourceFile, 0, 0),
    docs: ruleDocsPath(META_REQUIRED_RULE_DEFINITION),
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
    docs: ruleDocsPath(NO_IMPORT_EXPORT_RULE_DEFINITION),
  });
};

const NO_IMPORT_EXPORT_RULE_DEFINITION = ruleDefinitionFor(NO_IMPORT_EXPORT_RULE);
