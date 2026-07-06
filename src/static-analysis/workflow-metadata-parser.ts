/** @file Static literal metadata parser for ODW workflow metadata. */

import type { SourceSpan } from "../diagnostics/types";
import { textIndexAtOffset } from "./source-indexes";
import { spanFromTextIndexes } from "./source-position";
import { isStringLikeDelimiter } from "./source-scanner-primitives";
import type { OriginalSourceFile, WorkflowEnvelopeScanResult } from "./types";
import type {
  ParsedMetadataProperty,
  ParsedMetadataValue,
  WorkflowMetadataParseResult,
} from "./workflow-metadata";
import { collectPropertyImpuritySpans, firstImpureSpan } from "./workflow-metadata-impurity";
import {
  freezeArray,
  freezeMetadataFacts,
  impureValue,
  lastPropertyNamed,
  normalizeNumericPropertyKey,
  type ParsedPropertyResult,
  type ParsedValueResult,
  parsedProperty,
  parsedValue,
  parseNumericLiteral,
  spanForUnparsedMetaValue,
  type UnprovableResult,
  unprovableFrom,
} from "./workflow-metadata-parser-results";
import {
  currentCharacter,
  isArrayTerminator,
  isNumberStart,
  isPropertyTerminator,
  scanBalancedEnd,
  scanExpressionEnd,
  scanIdentifierEnd,
  scanKeyword,
  scanNumberEnd,
  skipTrivia,
} from "./workflow-metadata-parser-scan";
import { scanStringLiteral } from "./workflow-metadata-string-scan";

export type ParserCursor = {
  readonly file: OriginalSourceFile;
  readonly text: string;
  index: number;
  readonly endIndex: number;
};

type ValueParseResult = ParsedValueResult | UnprovableResult;

/**
 * Parses static literal metadata from an already scanned workflow envelope.
 *
 * @param scanResult - Envelope scan result created from the same source file.
 * @returns Parsed metadata facts, or the first expression that cannot be
 *   proven without executing source.
 */
export const parseWorkflowMetadataLiteral = (
  scanResult: WorkflowEnvelopeScanResult,
): WorkflowMetadataParseResult => {
  if (scanResult.status === "missing-meta") {
    return Object.freeze({
      status: "not-statically-provable",
      span: spanFromTextIndexes(scanResult.sourceFile, 0, 0),
    });
  }

  const { metaValue } = scanResult.envelope;
  if (metaValue.kind !== "object") {
    return Object.freeze({
      status: "not-statically-provable",
      span: spanForUnparsedMetaValue(scanResult.sourceFile, metaValue),
    });
  }

  const startIndex = textIndexAtOffset(scanResult.sourceFile, metaValue.span.start.offset);
  const endIndex = textIndexAtOffset(scanResult.sourceFile, metaValue.span.end.offset);
  const cursor: ParserCursor = {
    file: scanResult.sourceFile,
    text: scanResult.sourceFile.sourceText,
    index: startIndex,
    endIndex,
  };
  const parsedObject = parseObject(cursor);
  if (parsedObject.status === "not-statically-provable") {
    return Object.freeze({
      status: "not-statically-provable",
      span: spanFromTextIndexes(
        scanResult.sourceFile,
        parsedObject.startIndex,
        parsedObject.endIndex,
      ),
    });
  }
  if (parsedObject.value.kind !== "object") {
    return Object.freeze({
      status: "not-statically-provable",
      span: parsedObject.value.span,
    });
  }

  const properties = parsedObject.value.properties;
  const impurities = freezeArray([
    ...parsedObject.impurities,
    ...collectPropertyImpuritySpans(properties),
  ]);
  const firstImpure = firstImpureSpan(impurities);
  return Object.freeze({
    status: "parsed",
    facts: freezeMetadataFacts({
      objectSpan: parsedObject.value.span,
      name: lastPropertyNamed(properties, "name"),
      description: lastPropertyNamed(properties, "description"),
      ...(firstImpure === undefined ? {} : { firstImpureSpan: firstImpure }),
      impurities,
      portability: firstImpure === undefined ? "pure-literal" : "not-statically-provable",
      properties,
    }),
  });
};

/** Parses an object literal and records each statically provable property. */
const parseObject = (cursor: ParserCursor): ValueParseResult => {
  const objectStartIndex = cursor.index;
  cursor.index += 1;
  const impurities: SourceSpan[] = [];
  const properties: ParsedMetadataProperty[] = [];
  skipTrivia(cursor);

  while (cursor.index < cursor.endIndex) {
    if (currentCharacter(cursor) === "}") {
      cursor.index += 1;
      return parsedValue(
        {
          kind: "object",
          span: spanFromTextIndexes(cursor.file, objectStartIndex, cursor.index),
          properties: freezeArray(properties),
        },
        impurities,
      );
    }

    const property = parseProperty(cursor);
    if (property.status === "not-statically-provable") {
      return property;
    }
    impurities.push(...property.impurities);
    if (property.property !== undefined) {
      properties.push(property.property);
    }
    skipTrivia(cursor);

    if (currentCharacter(cursor) === ",") {
      cursor.index += 1;
      skipTrivia(cursor);
      continue;
    }
    if (currentCharacter(cursor) !== "}") {
      return unprovableFrom(cursor, cursor.index, scanExpressionEnd(cursor, ["}", ","]));
    }
  }

  return unprovableFrom(cursor, objectStartIndex, cursor.endIndex);
};

/** Parses one object property or returns the first unprovable property span. */
const parseProperty = (cursor: ParserCursor): ParsedPropertyResult | UnprovableResult => {
  skipTrivia(cursor);
  const propertyStartIndex = cursor.index;
  if (cursor.text.startsWith("...", cursor.index)) {
    const endIndex = scanExpressionEnd(cursor, [",", "}"]);
    cursor.index = endIndex;
    return parsedProperty(undefined, [
      spanFromTextIndexes(cursor.file, propertyStartIndex, endIndex),
    ]);
  }
  if (currentCharacter(cursor) === "[") {
    return parseComputedProperty(cursor, propertyStartIndex);
  }

  const key = parsePropertyKey(cursor);
  if (key === undefined) {
    const endIndex = scanExpressionEnd(cursor, [",", "}"]);
    cursor.index = endIndex;
    return parsedProperty(undefined, [
      spanFromTextIndexes(cursor.file, propertyStartIndex, endIndex),
    ]);
  }

  skipTrivia(cursor);
  if (currentCharacter(cursor) !== ":") {
    const endIndex = scanExpressionEnd(cursor, [",", "}"]);
    cursor.index = endIndex;
    return parsedProperty(undefined, [
      spanFromTextIndexes(cursor.file, propertyStartIndex, endIndex),
    ]);
  }
  cursor.index += 1;
  skipTrivia(cursor);

  const valueStartIndex = cursor.index;
  let value = parseValue(cursor);
  if (value.status === "not-statically-provable") {
    return value;
  }
  skipTrivia(cursor);
  if (!isPropertyTerminator(currentCharacter(cursor))) {
    value = impureValue(cursor, valueStartIndex, scanExpressionEnd(cursor, [",", "}"]));
  }

  return parsedProperty(
    Object.freeze({
      key: key.value,
      keySpan: key.span,
      value: value.value,
      span: spanFromTextIndexes(cursor.file, propertyStartIndex, cursor.index),
    }),
    value.impurities,
  );
};

/** Parses a computed property and records its key as object-level impurity. */
const parseComputedProperty = (
  cursor: ParserCursor,
  propertyStartIndex: number,
): ReturnType<typeof parseProperty> => {
  const keyEndIndex = scanBalancedEnd(cursor, "[", "]");
  const keySpan = spanFromTextIndexes(cursor.file, propertyStartIndex, keyEndIndex);
  cursor.index = keyEndIndex;
  skipTrivia(cursor);
  const impurities: SourceSpan[] = [keySpan];
  if (currentCharacter(cursor) !== ":") {
    const endIndex = scanExpressionEnd(cursor, [",", "}"]);
    cursor.index = endIndex;
    return parsedProperty(undefined, [
      ...impurities,
      spanFromTextIndexes(cursor.file, keyEndIndex, endIndex),
    ]);
  }
  cursor.index += 1;
  skipTrivia(cursor);
  const valueStartIndex = cursor.index;
  const value = parseValue(cursor);
  if (value.status === "not-statically-provable") {
    return value;
  }
  impurities.push(...value.impurities);
  skipTrivia(cursor);
  if (!isPropertyTerminator(currentCharacter(cursor))) {
    const valueEndIndex = scanExpressionEnd(cursor, [",", "}"]);
    impurities.push(spanFromTextIndexes(cursor.file, valueStartIndex, valueEndIndex));
    cursor.index = valueEndIndex;
  }
  return parsedProperty(undefined, impurities);
};

/** Parses a literal, numeric, or identifier object-property key. */
const parsePropertyKey = (
  cursor: ParserCursor,
): { readonly value: string; readonly span: SourceSpan } | undefined => {
  const startIndex = cursor.index;
  const character = currentCharacter(cursor);
  if (isStringLikeDelimiter(character)) {
    const literal = scanStringLiteral(cursor, character);
    if (literal === undefined) {
      return undefined;
    }
    return Object.freeze({
      value: literal.value,
      span: spanFromTextIndexes(cursor.file, startIndex, cursor.index),
    });
  }
  const identifierEndIndex = scanIdentifierEnd(cursor);
  if (identifierEndIndex !== undefined) {
    cursor.index = identifierEndIndex;
    return Object.freeze({
      value: cursor.text.slice(startIndex, cursor.index),
      span: spanFromTextIndexes(cursor.file, startIndex, cursor.index),
    });
  }
  if (isNumberStart(character)) {
    const endIndex = scanNumberEnd(cursor.text, startIndex, cursor.endIndex);
    const rawValue = cursor.text.slice(startIndex, endIndex);
    cursor.index = endIndex;
    return Object.freeze({
      value: normalizeNumericPropertyKey(rawValue),
      span: spanFromTextIndexes(cursor.file, startIndex, endIndex),
    });
  }

  return undefined;
};

/** Parses one supported metadata literal value. */
const parseValue = (cursor: ParserCursor): ValueParseResult => {
  const startIndex = cursor.index;
  const character = currentCharacter(cursor);
  if (character === "{") {
    return parseObject(cursor);
  }
  if (character === "[") {
    return parseArray(cursor);
  }
  if (isStringLikeDelimiter(character)) {
    const literal = scanStringLiteral(cursor, character);
    if (literal === undefined) {
      return impureValue(cursor, startIndex, scanExpressionEnd(cursor, [",", "}", "]"]));
    }
    return parsedValue({
      kind: "primitive",
      span: spanFromTextIndexes(cursor.file, startIndex, cursor.index),
      value: literal.value,
    });
  }
  if (isNumberStart(character)) {
    const endIndex = scanNumberEnd(cursor.text, startIndex, cursor.endIndex);
    const rawValue = cursor.text.slice(startIndex, endIndex);
    cursor.index = endIndex;
    return parsedValue({
      kind: "primitive",
      span: spanFromTextIndexes(cursor.file, startIndex, endIndex),
      value: parseNumericLiteral(rawValue),
    });
  }
  const keyword = scanKeyword(cursor);
  if (keyword !== undefined) {
    return parsedValue({
      kind: "primitive",
      span: spanFromTextIndexes(cursor.file, startIndex, cursor.index),
      value: keyword,
    });
  }

  return impureValue(cursor, startIndex, scanExpressionEnd(cursor, [",", "}", "]"]));
};

/** Parses an array literal and each statically provable item. */
const parseArray = (cursor: ParserCursor): ValueParseResult => {
  const arrayStartIndex = cursor.index;
  cursor.index += 1;
  const impurities: SourceSpan[] = [];
  const items: ParsedMetadataValue[] = [];
  skipTrivia(cursor);

  while (cursor.index < cursor.endIndex) {
    if (currentCharacter(cursor) === "]") {
      cursor.index += 1;
      return parsedValue(
        {
          kind: "array",
          span: spanFromTextIndexes(cursor.file, arrayStartIndex, cursor.index),
          items: freezeArray(items),
        },
        impurities,
      );
    }

    const itemStartIndex = cursor.index;
    let item = parseValue(cursor);
    if (item.status === "not-statically-provable") {
      return item;
    }
    skipTrivia(cursor);
    if (!isArrayTerminator(currentCharacter(cursor))) {
      item = impureValue(cursor, itemStartIndex, scanExpressionEnd(cursor, [",", "]"]));
    }
    impurities.push(...item.impurities);
    items.push(item.value);
    if (currentCharacter(cursor) === ",") {
      cursor.index += 1;
      skipTrivia(cursor);
    }
  }

  return unprovableFrom(cursor, arrayStartIndex, cursor.endIndex);
};
