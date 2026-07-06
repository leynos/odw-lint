/** @file Impurity helpers for total metadata object-literal parsing. */

import type { SourceSpan } from "../diagnostics/types";
import type { ParsedMetadataProperty, ParsedMetadataValue } from "./workflow-metadata";

/**
 * Collects all value-level impurity spans from a parsed metadata value tree.
 *
 * @param value - Parsed metadata value to inspect.
 * @returns Frozen list of impurity spans inside the value tree.
 */
export const collectValueImpuritySpans = (value: ParsedMetadataValue): readonly SourceSpan[] => {
  if (value.kind === "impure") {
    return Object.freeze([value.span]);
  }
  if (value.kind === "array") {
    return collectNestedImpurities(value.items);
  }
  if (value.kind === "object") {
    return collectPropertyImpuritySpans(value.properties);
  }
  return Object.freeze([]);
};

/**
 * Collects all value-level impurity spans from parsed object properties.
 *
 * @param properties - Parsed object properties to inspect.
 * @returns Frozen list of impurity spans inside property values.
 */
export const collectPropertyImpuritySpans = (
  properties: readonly ParsedMetadataProperty[],
): readonly SourceSpan[] => {
  return collectNestedImpurities(properties.map((property) => property.value));
};

/**
 * Returns the earliest impurity span in original-source order.
 *
 * @param spans - Impurity spans to compare.
 * @returns Earliest span by UTF-8 start offset, or `undefined` when empty.
 */
export const firstImpureSpan = (spans: readonly SourceSpan[]): SourceSpan | undefined => {
  return [...spans].sort((left, right) => left.start.offset - right.start.offset)[0];
};

/** Collects nested value impurities from an ordered value list. */
const collectNestedImpurities = (values: readonly ParsedMetadataValue[]): readonly SourceSpan[] => {
  return Object.freeze(values.flatMap((value) => [...collectValueImpuritySpans(value)]));
};
