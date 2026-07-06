/** @file Static, non-executing metadata classification for ODW workflow source. */

import {
  firstReviewedRuleMessage,
  type RuleDefinition,
  reviewedRuleMessage,
  ruleDefinitionFor,
} from "../diagnostics/rule-catalogue";
import { createRuleDiagnostic } from "../diagnostics/rule-diagnostic";
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic, SourceSpan } from "../diagnostics/types";
import type { OriginalSourceFile, WorkflowEnvelopeScanResult, WorkflowMetaValue } from "./types";
import { isClosedConstantSpan } from "./workflow-metadata-constant-expr";
import { expressionContainsObjectLiteralCandidate } from "./workflow-metadata-expression";
import { parseWorkflowMetadataLiteral } from "./workflow-metadata-parser";

const META_OBJECT_RULE = makeRuleId("odw/meta-object");
const META_NAME_RULE = makeRuleId("odw/meta-name");
const META_DESCRIPTION_RULE = makeRuleId("odw/meta-description");
const META_STATICALLY_UNPROVABLE_RULE = makeRuleId("odw/meta-statically-unprovable");
const CLAUDE_PURE_META_RULE = makeRuleId("odw/claude-pure-meta");
const META_OBJECT_RULE_DEFINITION = ruleDefinitionFor(META_OBJECT_RULE);
const META_NAME_RULE_DEFINITION = ruleDefinitionFor(META_NAME_RULE);
const META_DESCRIPTION_RULE_DEFINITION = ruleDefinitionFor(META_DESCRIPTION_RULE);
const META_STATICALLY_UNPROVABLE_RULE_DEFINITION = ruleDefinitionFor(
  META_STATICALLY_UNPROVABLE_RULE,
);
const CLAUDE_PURE_META_RULE_DEFINITION = ruleDefinitionFor(CLAUDE_PURE_META_RULE);
const META_OBJECT_MESSAGE = firstReviewedRuleMessage(META_OBJECT_RULE_DEFINITION);
const META_OBJECT_COMPLETE_MESSAGE = reviewedRuleMessage(META_OBJECT_RULE_DEFINITION, 1);
const META_NAME_MESSAGE = firstReviewedRuleMessage(META_NAME_RULE_DEFINITION);
const META_DESCRIPTION_REQUIRED_MESSAGE = firstReviewedRuleMessage(
  META_DESCRIPTION_RULE_DEFINITION,
);
const META_DESCRIPTION_STRING_MESSAGE = reviewedRuleMessage(META_DESCRIPTION_RULE_DEFINITION, 1);
const META_STATICALLY_UNPROVABLE_MESSAGE = firstReviewedRuleMessage(
  META_STATICALLY_UNPROVABLE_RULE_DEFINITION,
);
const CLAUDE_PURE_META_MESSAGE = firstReviewedRuleMessage(CLAUDE_PURE_META_RULE_DEFINITION);

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
    }
  | {
      readonly kind: "impure";
      readonly span: SourceSpan;
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
  readonly firstImpureSpan?: SourceSpan;
  readonly impurities: readonly SourceSpan[];
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
    }
  | {
      readonly status: "claude-incompatible";
      readonly facts: WorkflowMetadataFacts;
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

  return classifyParsedMetadata(scanResult.sourceFile, parseResult.facts);
};

/** Classifies parsed object-literal metadata facts. */
const classifyParsedMetadata = (
  sourceFile: OriginalSourceFile,
  facts: WorkflowMetadataFacts,
): WorkflowMetadataClassification => {
  const requiredFields = classifyRequiredFields(facts);
  if (requiredFields.status === "invalid-literal") {
    return runtimeInvalid(requiredFieldDiagnostics(sourceFile, facts));
  }
  if (requiredFields.status === "unprovable") {
    return staticallyUnprovable(sourceFile, firstUnprovableSpan(facts));
  }

  if (facts.portability !== "pure-literal") {
    const firstImpureSpan = firstUnprovableSpan(facts);
    if (!allImpuritiesAreClosedConstants(sourceFile, facts)) {
      return staticallyUnprovable(sourceFile, firstImpureSpan);
    }
    return claudePureMeta(sourceFile, facts, firstImpureSpan);
  }

  return Object.freeze({
    status: "valid",
    facts,
    diagnostics: Object.freeze([]),
  });
};

type RequiredFieldsClassification =
  | { readonly status: "valid-literal" }
  | { readonly status: "invalid-literal" }
  | { readonly status: "unprovable" };

/** Classifies required metadata fields without folding computed values. */
const classifyRequiredFields = (facts: WorkflowMetadataFacts): RequiredFieldsClassification => {
  if (facts.name?.value.kind === "impure" || facts.description?.value.kind === "impure") {
    return Object.freeze({ status: "unprovable" });
  }
  if (!hasValidNameLiteral(facts) || !hasValidDescriptionLiteral(facts)) {
    return Object.freeze({ status: "invalid-literal" });
  }
  return Object.freeze({ status: "valid-literal" });
};

/** Checks whether `name` is present as a non-empty string literal. */
const hasValidNameLiteral = (facts: WorkflowMetadataFacts): boolean => {
  return facts.name !== undefined && isNonEmptyStringProperty(facts.name);
};

/** Checks whether `description` is present as a string literal. */
const hasValidDescriptionLiteral = (facts: WorkflowMetadataFacts): boolean => {
  return (
    facts.description?.value.kind === "primitive" &&
    typeof facts.description.value.value === "string"
  );
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
        META_OBJECT_RULE_DEFINITION,
        META_OBJECT_MESSAGE,
        metaValue.span,
      ),
    ]);
  }
  if (metaValue.kind === "unterminated-object") {
    return runtimeInvalid([
      metadataDiagnostic(
        sourceFile,
        META_OBJECT_RULE_DEFINITION,
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
        META_OBJECT_RULE_DEFINITION,
        META_OBJECT_MESSAGE,
        metaValue.expressionSpan,
      ),
    ]);
  }
  return undefined;
};

/** Checks that every recorded impure expression is structurally closed. */
const allImpuritiesAreClosedConstants = (
  sourceFile: OriginalSourceFile,
  facts: WorkflowMetadataFacts,
): boolean => {
  return facts.impurities.every((span) => isClosedConstantSpan(sourceFile, span));
};

/** Returns the best unprovable span for impure parsed metadata. */
const firstUnprovableSpan = (facts: WorkflowMetadataFacts): SourceSpan => {
  return facts.firstImpureSpan ?? facts.objectSpan;
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
        META_NAME_RULE_DEFINITION,
        META_NAME_MESSAGE,
        facts.name?.value.span ?? facts.objectSpan,
      ),
    );
  }
  if (facts.description === undefined) {
    diagnostics.push(
      metadataDiagnostic(
        sourceFile,
        META_DESCRIPTION_RULE_DEFINITION,
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
        META_DESCRIPTION_RULE_DEFINITION,
        META_DESCRIPTION_STRING_MESSAGE,
        facts.description.value.span,
      ),
    );
  }

  return Object.freeze(diagnostics);
};

/** Builds a Claude-incompatible classification result. */
const claudePureMeta = (
  sourceFile: OriginalSourceFile,
  facts: WorkflowMetadataFacts,
  span: SourceSpan,
): WorkflowMetadataClassification => {
  return Object.freeze({
    status: "claude-incompatible",
    facts,
    diagnostics: Object.freeze([
      metadataDiagnostic(
        sourceFile,
        CLAUDE_PURE_META_RULE_DEFINITION,
        CLAUDE_PURE_META_MESSAGE,
        span,
      ),
    ]),
  });
};

/** Builds a frozen metadata diagnostic for one source span. */
const metadataDiagnostic = (
  sourceFile: OriginalSourceFile,
  rule: RuleDefinition,
  message: string,
  span: SourceSpan,
): Diagnostic => {
  return createRuleDiagnostic({
    file: sourceFile.filePath,
    rule,
    severity: rule.defaultSeverity,
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
        META_STATICALLY_UNPROVABLE_RULE_DEFINITION,
        META_STATICALLY_UNPROVABLE_MESSAGE,
        span,
      ),
    ]),
  });
};

/** Checks whether a property value satisfies ODW's runtime `name` contract. */
const isNonEmptyStringProperty = (property: ParsedMetadataProperty): boolean => {
  return (
    property.value.kind === "primitive" &&
    typeof property.value.value === "string" &&
    property.value.value.length > 0
  );
};

export { parseWorkflowMetadataLiteral };
