/** @file Static, non-executing metadata classification for ODW workflow source. */

import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic, SourceSpan } from "../diagnostics/types";
import { textIndexAtOffset } from "./source-indexes";
import { maskNonCodeSource } from "./source-mask";
import type { OriginalSourceFile, WorkflowEnvelopeScanResult, WorkflowMetaValue } from "./types";
import { parseWorkflowMetadataLiteral } from "./workflow-metadata-parser";

const META_OBJECT_RULE = makeRuleId("odw/meta-object");
const META_NAME_RULE = makeRuleId("odw/meta-name");
const META_DESCRIPTION_RULE = makeRuleId("odw/meta-description");
const META_STATICALLY_UNPROVABLE_RULE = makeRuleId("odw/meta-statically-unprovable");
const META_OBJECT_MESSAGE = "Workflow metadata must be an object literal.";
const META_OBJECT_COMPLETE_MESSAGE = "Workflow metadata object literal must be complete.";
const META_NAME_MESSAGE = "Workflow metadata must include a non-empty name string.";
const META_DESCRIPTION_REQUIRED_MESSAGE = "Workflow metadata must include a description string.";
const META_DESCRIPTION_STRING_MESSAGE = "Workflow metadata description must be a string.";
const META_STATICALLY_UNPROVABLE_MESSAGE =
  "Workflow metadata must remain statically provable without evaluation.";

export type WorkflowMetadataPortability = "pure-literal" | "not-statically-provable";

export type ParsedMetadataPrimitive = string | number | boolean | null;

export type ParsedMetadataValue =
  | {
      readonly kind: "array";
      readonly span: SourceSpan;
      readonly items: readonly ParsedMetadataValue[];
    }
  | {
      readonly kind: "object";
      readonly span: SourceSpan;
      readonly properties: readonly ParsedMetadataProperty[];
    }
  | {
      readonly kind: "primitive";
      readonly span: SourceSpan;
      readonly value: ParsedMetadataPrimitive;
    };

export type ParsedMetadataProperty = {
  readonly key: string;
  readonly keySpan: SourceSpan;
  readonly value: ParsedMetadataValue;
  readonly span: SourceSpan;
};

export type WorkflowMetadataFacts = {
  readonly objectSpan: SourceSpan;
  readonly name: ParsedMetadataProperty | undefined;
  readonly description: ParsedMetadataProperty | undefined;
  readonly portability: WorkflowMetadataPortability;
  readonly properties: readonly ParsedMetadataProperty[];
};

export type WorkflowMetadataParseResult =
  | {
      readonly status: "parsed";
      readonly facts: WorkflowMetadataFacts;
    }
  | {
      readonly status: "not-statically-provable";
      readonly span: SourceSpan;
    };

export type WorkflowMetadataClassification =
  | {
      readonly status: "not-applicable";
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "valid";
      readonly facts: WorkflowMetadataFacts;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "runtime-invalid";
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "statically-unprovable";
      readonly diagnostics: readonly Diagnostic[];
    };

/**
 * Classifies workflow metadata into task-owned diagnostics without evaluating
 * workflow source.
 *
 * @param scanResult - Envelope scan result from `scanWorkflowEnvelope`.
 * @returns Frozen metadata classification facts and diagnostics.
 */
export const classifyWorkflowMetadata = (
  scanResult: WorkflowEnvelopeScanResult,
): WorkflowMetadataClassification => {
  if (scanResult.status === "missing-meta") {
    return Object.freeze({ status: "not-applicable", diagnostics: Object.freeze([]) });
  }

  const scannedValueClassification = classifyScannedMetaValue(
    scanResult.sourceFile,
    scanResult.envelope.metaValue,
  );
  if (scannedValueClassification !== undefined) {
    return scannedValueClassification;
  }

  const parseResult = parseWorkflowMetadataLiteral(scanResult);
  if (parseResult.status === "not-statically-provable") {
    return staticallyUnprovable(scanResult.sourceFile, parseResult.span);
  }
  if (parseResult.facts.portability !== "pure-literal") {
    return staticallyUnprovable(scanResult.sourceFile, parseResult.facts.objectSpan);
  }

  const diagnostics = requiredFieldDiagnostics(scanResult.sourceFile, parseResult.facts);
  if (diagnostics.length > 0) {
    return runtimeInvalid(diagnostics);
  }

  return Object.freeze({
    status: "valid",
    facts: parseResult.facts,
    diagnostics: Object.freeze([]),
  });
};

/** Classifies metadata value states already proven by the envelope scanner. */
const classifyScannedMetaValue = (
  sourceFile: OriginalSourceFile,
  metaValue: WorkflowMetaValue,
): WorkflowMetadataClassification | undefined => {
  if (metaValue.kind === "object") {
    return undefined;
  }
  if (metaValue.kind === "missing-value") {
    return runtimeInvalid([
      metadataDiagnostic(
        sourceFile,
        META_OBJECT_RULE,
        "error",
        META_OBJECT_MESSAGE,
        metaValue.span,
      ),
    ]);
  }
  if (metaValue.kind === "unterminated-object") {
    return runtimeInvalid([
      metadataDiagnostic(
        sourceFile,
        META_OBJECT_RULE,
        "error",
        META_OBJECT_COMPLETE_MESSAGE,
        metaValue.span,
      ),
    ]);
  }
  if (metaValue.kind === "non-object-expression") {
    if (expressionContainsObjectLiteralCandidate(sourceFile, metaValue.expressionSpan)) {
      return staticallyUnprovable(sourceFile, metaValue.expressionSpan);
    }
    return runtimeInvalid([
      metadataDiagnostic(
        sourceFile,
        META_OBJECT_RULE,
        "error",
        META_OBJECT_MESSAGE,
        metaValue.expressionSpan,
      ),
    ]);
  }
  return undefined;
};

/** Builds required-field diagnostics from parsed metadata facts. */
const requiredFieldDiagnostics = (
  sourceFile: OriginalSourceFile,
  facts: WorkflowMetadataFacts,
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  if (facts.name === undefined || !isNonEmptyStringProperty(facts.name)) {
    diagnostics.push(
      metadataDiagnostic(
        sourceFile,
        META_NAME_RULE,
        "error",
        META_NAME_MESSAGE,
        facts.name?.value.span ?? facts.objectSpan,
      ),
    );
  }
  if (facts.description === undefined) {
    diagnostics.push(
      metadataDiagnostic(
        sourceFile,
        META_DESCRIPTION_RULE,
        "error",
        META_DESCRIPTION_REQUIRED_MESSAGE,
        facts.objectSpan,
      ),
    );
  } else if (
    facts.description.value.kind !== "primitive" ||
    typeof facts.description.value.value !== "string"
  ) {
    diagnostics.push(
      metadataDiagnostic(
        sourceFile,
        META_DESCRIPTION_RULE,
        "error",
        META_DESCRIPTION_STRING_MESSAGE,
        facts.description.value.span,
      ),
    );
  }

  return Object.freeze(diagnostics);
};

/** Builds a frozen metadata diagnostic for one source span. */
const metadataDiagnostic = (
  sourceFile: OriginalSourceFile,
  rule: Diagnostic["rule"],
  severity: Diagnostic["severity"],
  message: string,
  span: SourceSpan,
): Diagnostic => {
  return Object.freeze({
    file: sourceFile.filePath,
    rule,
    severity,
    message,
    span,
  });
};

/** Builds a runtime-invalid classification result. */
const runtimeInvalid = (diagnostics: readonly Diagnostic[]): WorkflowMetadataClassification => {
  return Object.freeze({
    status: "runtime-invalid",
    diagnostics: Object.freeze([...diagnostics]),
  });
};

/** Builds a statically unprovable classification result. */
const staticallyUnprovable = (
  sourceFile: OriginalSourceFile,
  span: SourceSpan,
): WorkflowMetadataClassification => {
  return Object.freeze({
    status: "statically-unprovable",
    diagnostics: Object.freeze([
      metadataDiagnostic(
        sourceFile,
        META_STATICALLY_UNPROVABLE_RULE,
        "warning",
        META_STATICALLY_UNPROVABLE_MESSAGE,
        span,
      ),
    ]),
  });
};

/** Checks whether a non-object metadata expression may contain an object literal. */
const expressionContainsObjectLiteralCandidate = (
  sourceFile: OriginalSourceFile,
  span: SourceSpan,
): boolean => {
  const maskedText = maskNonCodeSource(sourceFile).maskedText;
  const startIndex = textIndexForOffset(sourceFile, span.start.offset);
  const endIndex = textIndexForOffset(sourceFile, span.end.offset);

  for (let index = startIndex; index < endIndex; index += 1) {
    if (maskedText[index] !== "{") {
      continue;
    }
    if (isObjectLiteralOpening(maskedText, startIndex, index)) {
      return true;
    }
    index = scanMaskedBraceEnd(maskedText, index, endIndex) - 1;
  }

  return false;
};

/** Checks whether a brace appears where JavaScript accepts an expression. */
const isObjectLiteralOpening = (text: string, startIndex: number, braceIndex: number): boolean => {
  const previousIndex = previousNonWhitespaceIndex(text, startIndex, braceIndex);
  if (previousIndex === undefined) {
    return true;
  }
  if (isArrowBodyOpening(text, previousIndex)) {
    return false;
  }
  return "([{,;:?=+-*/%!&|^~<>".includes(text[previousIndex] ?? "");
};

/** Checks whether a brace opens an arrow-function block body. */
const isArrowBodyOpening = (text: string, previousIndex: number): boolean => {
  return text[previousIndex] === ">" && text[previousIndex - 1] === "=";
};

/** Finds the previous non-whitespace text index in a half-open range. */
const previousNonWhitespaceIndex = (
  text: string,
  startIndex: number,
  endIndex: number,
): number | undefined => {
  for (let index = endIndex - 1; index >= startIndex; index -= 1) {
    if (!/\s/u.test(text[index] ?? "")) {
      return index;
    }
  }
  return undefined;
};

/** Skips a brace-delimited block in already masked source text. */
const scanMaskedBraceEnd = (text: string, startIndex: number, endIndex: number): number => {
  let depth = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const character = text[index];
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

/** Checks whether a property value satisfies ODW's runtime `name` contract. */
const isNonEmptyStringProperty = (property: ParsedMetadataProperty): boolean => {
  return (
    property.value.kind === "primitive" &&
    typeof property.value.value === "string" &&
    property.value.value.length > 0
  );
};

/** Converts a UTF-8 byte offset from a source span back to a text index. */
const textIndexForOffset = (file: OriginalSourceFile, offset: number): number =>
  textIndexAtOffset(file, offset);

export { parseWorkflowMetadataLiteral };
