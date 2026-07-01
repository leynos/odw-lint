/** @file Static literal metadata parser for ODW workflow metadata. */

import type { SourceSpan } from "../diagnostics/types";
import { textIndexAtOffset } from "./source-indexes";
import { spanFromTextIndexes } from "./source-position";
import type { OriginalSourceFile, WorkflowEnvelopeScanResult, WorkflowMetaValue } from "./types";
import type {
  ParsedMetadataProperty,
  ParsedMetadataValue,
  WorkflowMetadataFacts,
  WorkflowMetadataParseResult,
} from "./workflow-metadata";
import {
  currentCharacter,
  isArrayTerminator,
  isIdentifierPart,
  isIdentifierStart,
  isNumberStart,
  isPropertyTerminator,
  scanBalancedEnd,
  scanExpressionEnd,
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

type ValueParseResult =
  | {
      readonly status: "parsed";
      readonly value: ParsedMetadataValue;
    }
  | {
      readonly status: "not-statically-provable";
      readonly startIndex: number;
      readonly endIndex: number;
    };

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
  return Object.freeze({
    status: "parsed",
    facts: freezeMetadataFacts({
      objectSpan: parsedObject.value.span,
      name: lastPropertyNamed(properties, "name"),
      description: lastPropertyNamed(properties, "description"),
      portability: "pure-literal",
      properties,
    }),
  });
};

/** Parses an object literal and records each statically provable property. */
const parseObject = (cursor: ParserCursor): ValueParseResult => {
  const objectStartIndex = cursor.index;
  cursor.index += 1;
  const properties: ParsedMetadataProperty[] = [];
  skipTrivia(cursor);

  while (cursor.index < cursor.endIndex) {
    if (currentCharacter(cursor) === "}") {
      cursor.index += 1;
      return parsedValue({
        kind: "object",
        span: spanFromTextIndexes(cursor.file, objectStartIndex, cursor.index),
        properties: freezeArray(properties),
      });
    }

    const property = parseProperty(cursor);
    if (property.status === "not-statically-provable") {
      return property;
    }
    properties.push(property.property);
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
const parseProperty = (
  cursor: ParserCursor,
):
  | {
      readonly status: "parsed";
      readonly property: ParsedMetadataProperty;
    }
  | {
      readonly status: "not-statically-provable";
      readonly startIndex: number;
      readonly endIndex: number;
    } => {
  skipTrivia(cursor);
  const propertyStartIndex = cursor.index;
  if (cursor.text.startsWith("...", cursor.index)) {
    return unprovableFrom(cursor, propertyStartIndex, scanExpressionEnd(cursor, [",", "}"]));
  }
  if (currentCharacter(cursor) === "[") {
    return unprovableFrom(cursor, propertyStartIndex, scanBalancedEnd(cursor, "[", "]"));
  }

  const key = parsePropertyKey(cursor);
  if (key === undefined) {
    return unprovableFrom(cursor, propertyStartIndex, scanExpressionEnd(cursor, [",", "}"]));
  }

  skipTrivia(cursor);
  if (currentCharacter(cursor) !== ":") {
    return unprovableFrom(cursor, propertyStartIndex, scanExpressionEnd(cursor, [",", "}"]));
  }
  cursor.index += 1;
  skipTrivia(cursor);

  const valueStartIndex = cursor.index;
  const value = parseValue(cursor);
  if (value.status === "not-statically-provable") {
    return value;
  }
  skipTrivia(cursor);
  if (!isPropertyTerminator(currentCharacter(cursor))) {
    return unprovableFrom(cursor, valueStartIndex, scanExpressionEnd(cursor, [",", "}"]));
  }

  return Object.freeze({
    status: "parsed",
    property: Object.freeze({
      key: key.value,
      keySpan: key.span,
      value: value.value,
      span: spanFromTextIndexes(cursor.file, propertyStartIndex, cursor.index),
    }),
  });
};

/** Parses a literal, numeric, or identifier object-property key. */
const parsePropertyKey = (
  cursor: ParserCursor,
): { readonly value: string; readonly span: SourceSpan } | undefined => {
  const startIndex = cursor.index;
  const character = currentCharacter(cursor);
  if (isStringDelimiter(character)) {
    const literal = scanStringLiteral(cursor, character);
    if (literal === undefined) {
      return undefined;
    }
    return Object.freeze({
      value: literal.value,
      span: spanFromTextIndexes(cursor.file, startIndex, cursor.index),
    });
  }
  if (isIdentifierStart(character)) {
    cursor.index += 1;
    while (isIdentifierPart(currentCharacter(cursor))) {
      cursor.index += 1;
    }
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
  if (isStringDelimiter(character)) {
    const literal = scanStringLiteral(cursor, character);
    if (literal === undefined) {
      return unprovableFrom(cursor, startIndex, scanExpressionEnd(cursor, [",", "}", "]"]));
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

  return unprovableFrom(cursor, startIndex, scanExpressionEnd(cursor, [",", "}", "]"]));
};

/** Parses an array literal and each statically provable item. */
const parseArray = (cursor: ParserCursor): ValueParseResult => {
  const arrayStartIndex = cursor.index;
  cursor.index += 1;
  const items: ParsedMetadataValue[] = [];
  skipTrivia(cursor);

  while (cursor.index < cursor.endIndex) {
    if (currentCharacter(cursor) === "]") {
      cursor.index += 1;
      return parsedValue({
        kind: "array",
        span: spanFromTextIndexes(cursor.file, arrayStartIndex, cursor.index),
        items: freezeArray(items),
      });
    }

    const itemStartIndex = cursor.index;
    const item = parseValue(cursor);
    if (item.status === "not-statically-provable") {
      return item;
    }
    skipTrivia(cursor);
    if (!isArrayTerminator(currentCharacter(cursor))) {
      return unprovableFrom(cursor, itemStartIndex, scanExpressionEnd(cursor, [",", "]"]));
    }
    items.push(item.value);
    if (currentCharacter(cursor) === ",") {
      cursor.index += 1;
      skipTrivia(cursor);
    }
  }

  return unprovableFrom(cursor, arrayStartIndex, cursor.endIndex);
};

/** Freezes a successfully parsed metadata value result. */
const parsedValue = (value: ParsedMetadataValue): ValueParseResult => {
  return Object.freeze({ status: "parsed", value: freezeParsedValue(value) });
};

/** Advances the cursor to the end of the unprovable expression span. */
const unprovableFrom = (
  cursor: ParserCursor,
  startIndex: number,
  endIndex: number,
): ValueParseResult & { readonly status: "not-statically-provable" } => {
  cursor.index = endIndex;
  return Object.freeze({ status: "not-statically-provable", startIndex, endIndex });
};

/** Finds the final property with a given key to mirror object literal overwrite. */
const lastPropertyNamed = (
  properties: readonly ParsedMetadataProperty[],
  name: string,
): ParsedMetadataProperty | undefined => {
  return [...properties].reverse().find((property) => property.key === name);
};

/** Freezes top-level metadata facts before returning them to callers. */
const freezeMetadataFacts = (facts: WorkflowMetadataFacts): WorkflowMetadataFacts => {
  return Object.freeze({
    ...facts,
    properties: freezeArray(facts.properties),
  });
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

/** Freezes a copied readonly array to avoid leaking mutable internals. */
const freezeArray = <Value>(values: readonly Value[]): readonly Value[] => {
  return Object.freeze([...values]);
};

/** Coerces numeric property keys the same way object literals do at runtime. */
const normalizeNumericPropertyKey = (rawValue: string): string => {
  return String(parseNumericLiteral(rawValue));
};

/** Parses a numeric literal after removing JavaScript numeric separators. */
const parseNumericLiteral = (rawValue: string): number => Number(rawValue.replaceAll("_", ""));

/** Chooses the best span for metadata values the literal parser cannot parse. */
const spanForUnparsedMetaValue = (
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
/** Checks for metadata string delimiters and narrows the delimiter type. */
const isStringDelimiter = (character: string): character is "'" | '"' | "`" => {
  return character === "'" || character === '"' || character === "`";
};
