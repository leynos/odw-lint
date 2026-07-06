/** @file Result builders for the static metadata literal parser. */

import type { SourceSpan } from "../diagnostics/types";
import { spanFromTextIndexes } from "./source-position";
import type { OriginalSourceFile, WorkflowMetaValue } from "./types";
import type {
  ParsedMetadataProperty,
  ParsedMetadataValue,
  WorkflowMetadataFacts,
} from "./workflow-metadata";

export type ParsedValueResult = {
  readonly status: "parsed";
  readonly impurities: readonly SourceSpan[];
  readonly value: ParsedMetadataValue;
};

export type UnprovableResult = {
  readonly status: "not-statically-provable";
  readonly startIndex: number;
  readonly endIndex: number;
};

export type ParsedPropertyResult = {
  readonly status: "parsed";
  readonly impurities: readonly SourceSpan[];
  readonly property?: ParsedMetadataProperty;
};

type ParserCursorLike = {
  readonly file: OriginalSourceFile;
  index: number;
};

/**
 * Freezes a successfully parsed metadata value result.
 *
 * @param value - Parsed metadata value to freeze.
 * @param impurities - Impurity spans collected while parsing the value.
 * @returns Frozen parsed value result.
 */
export const parsedValue = (
  value: ParsedMetadataValue,
  impurities: readonly SourceSpan[] = [],
): ParsedValueResult => {
  return Object.freeze({
    status: "parsed",
    impurities: freezeArray(impurities),
    value: freezeParsedValue(value),
  });
};

/**
 * Records an unsupported expression as an impure metadata value.
 *
 * @param cursor - Parser cursor to advance to the expression end.
 * @param startIndex - Inclusive text index where the expression starts.
 * @param endIndex - Exclusive text index where the expression ends.
 * @returns Frozen parsed result containing an impure value node.
 */
export const impureValue = (
  cursor: ParserCursorLike,
  startIndex: number,
  endIndex: number,
): ParsedValueResult => {
  cursor.index = endIndex;
  const span = spanFromTextIndexes(cursor.file, startIndex, endIndex);
  return parsedValue({ kind: "impure", span }, [span]);
};

/**
 * Freezes a parsed property result with any object-level impurity spans.
 *
 * @param property - Parsed property, or `undefined` when the property key is
 *   not statically nameable.
 * @param impurities - Object-level impurity spans introduced by the property.
 * @returns Frozen parsed property result.
 */
export const parsedProperty = (
  property: ParsedMetadataProperty | undefined,
  impurities: readonly SourceSpan[],
): ParsedPropertyResult => {
  return Object.freeze({
    status: "parsed",
    impurities: freezeArray(impurities),
    ...(property === undefined ? {} : { property: freezeProperty(property) }),
  });
};

/**
 * Freezes top-level metadata facts before returning them to callers.
 *
 * @param facts - Metadata facts assembled by the parser.
 * @returns Frozen metadata facts with copied readonly arrays.
 */
export const freezeMetadataFacts = (facts: WorkflowMetadataFacts): WorkflowMetadataFacts => {
  return Object.freeze({
    ...facts,
    impurities: freezeArray(facts.impurities),
    properties: freezeArray(facts.properties),
  });
};

/**
 * Freezes a copied readonly array to avoid leaking mutable internals.
 *
 * @param values - Values to copy into a frozen array.
 * @returns Frozen copy of the input values.
 */
export const freezeArray = <Value>(values: readonly Value[]): readonly Value[] => {
  return Object.freeze([...values]);
};

/**
 * Coerces numeric property keys the same way object literals do at runtime.
 *
 * @param rawValue - Raw numeric property key text.
 * @returns Runtime string form of the numeric property key.
 */
export const normalizeNumericPropertyKey = (rawValue: string): string => {
  return String(parseNumericLiteral(rawValue));
};

/**
 * Parses a numeric literal after removing JavaScript numeric separators.
 *
 * @param rawValue - Raw numeric literal text.
 * @returns Parsed JavaScript number value.
 */
export const parseNumericLiteral = (rawValue: string): number =>
  Number(rawValue.replaceAll("_", ""));

/**
 * Advances the cursor to the end of the unprovable expression span.
 *
 * @param cursor - Parser cursor to advance.
 * @param startIndex - Inclusive text index where the expression starts.
 * @param endIndex - Exclusive text index where the expression ends.
 * @returns Frozen unprovable parser result.
 */
export const unprovableFrom = (
  cursor: ParserCursorLike,
  startIndex: number,
  endIndex: number,
): UnprovableResult => {
  cursor.index = endIndex;
  return Object.freeze({ status: "not-statically-provable", startIndex, endIndex });
};

/**
 * Finds the final property with a given key to mirror object literal overwrite.
 *
 * @param properties - Parsed object properties in source order.
 * @param name - Property name to find.
 * @returns Last property with the requested key, when present.
 */
export const lastPropertyNamed = (
  properties: readonly ParsedMetadataProperty[],
  name: string,
): ParsedMetadataProperty | undefined => {
  return [...properties].reverse().find((property) => property.key === name);
};

/**
 * Chooses the best span for metadata values the literal parser cannot parse.
 *
 * @param sourceFile - Source file that owns the metadata value.
 * @param metaValue - Scanned metadata value descriptor.
 * @returns Source span to report for an unparsed metadata value.
 */
export const spanForUnparsedMetaValue = (
  sourceFile: OriginalSourceFile,
  metaValue: WorkflowMetaValue,
): SourceSpan => {
  if (metaValue.kind === "non-object-expression") {
    return metaValue.expressionSpan;
  }
  if ("span" in metaValue) {
    return metaValue.span;
  }
  return spanFromTextIndexes(sourceFile, 0, 0);
};

/** Deep-freezes a parsed value tree. */
const freezeParsedValue = (value: ParsedMetadataValue): ParsedMetadataValue => {
  if (value.kind === "array") {
    return Object.freeze({ ...value, items: freezeArray(value.items.map(freezeParsedValue)) });
  }
  if (value.kind === "object") {
    return Object.freeze({
      ...value,
      properties: freezeArray(value.properties.map(freezeProperty)),
    });
  }
  return Object.freeze(value);
};

/** Deep-freezes a parsed object property. */
const freezeProperty = (property: ParsedMetadataProperty): ParsedMetadataProperty => {
  return Object.freeze({ ...property, value: freezeParsedValue(property.value) });
};
