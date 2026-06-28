/**
 * @file Independent property-test oracle for original source-file positions.
 */

import { expect } from "bun:test";
import type { SourcePosition } from "odw-lint";

type ByteOffsetIndex = {
  /** Valid UTF-8 byte offset in the generated source. */
  readonly offset: number;
  /** UTF-16 string index for the same generated source position. */
  readonly index: number;
};

type PositionScanState = {
  /** Current one-based display line. */
  readonly line: number;
  /** Current one-based display column. */
  readonly column: number;
  /** Current zero-based UTF-8 byte offset. */
  readonly byteOffset: number;
  /** Current UTF-16 string index. */
  readonly index: number;
  /** Positions collected so far. */
  readonly positions: readonly SourcePosition[];
  /** UTF-16 indexes keyed by generated valid byte offsets. */
  readonly textIndexes: readonly ByteOffsetIndex[];
};

/** Deterministic fast-check runner settings for source-span properties. */
export const SOURCE_SPAN_PROPERTY_RUNNER = { seed: 0x1222026, numRuns: 200 } as const;
const TEXT_ENCODER = new TextEncoder();
/** JavaScript line terminators recognised by the independent oracle. */
const LINE_TERMINATORS = new Set(["\n", "\r", "\u2028", "\u2029"]);
/** Generated source fragments used to compose bounded property-test sources. */
export const SOURCE_SEGMENTS = [
  "",
  "a",
  "bc",
  "é",
  "😀",
  "\n",
  "\r\n",
  "\r",
  "\u2028",
  "\u2029",
  "x\n",
  "y\r\n",
] as const;

/**
 * Computes expected source positions independently from production helpers.
 *
 * @param sourceText - Generated source text to scan.
 * @returns Expected display positions, including the beginning and end of file.
 */
export const expectedPositions = (sourceText: string): readonly SourcePosition[] => {
  return expectedScanState(sourceText).positions;
};

/**
 * Computes the complete independent source scan state.
 */
const expectedScanState = (sourceText: string): PositionScanState => {
  let state: PositionScanState = {
    line: 1,
    column: 1,
    byteOffset: 0,
    index: 0,
    positions: [{ offset: 0, line: 1, column: 1 }],
    textIndexes: [{ offset: 0, index: 0 }],
  };

  while (state.index < sourceText.length) {
    state = advanceExpectedPosition(sourceText, state);
  }

  return state;
};

/**
 * Returns the generated EOF position for a source-text fixture.
 *
 * @param sourceText - Generated source text to scan.
 * @returns The final valid display position.
 * @throws Error when the independent scan unexpectedly produces no positions.
 */
export const finalExpectedPosition = (sourceText: string): SourcePosition => {
  const finalPosition = expectedPositions(sourceText).at(-1);
  if (finalPosition === undefined) {
    throw new Error("Generated position scans should always include EOF.");
  }

  return finalPosition;
};

/**
 * Returns the generated first position for a source-text fixture.
 *
 * @param sourceText - Generated source text to scan.
 * @returns The first valid display position.
 * @throws Error when the independent scan unexpectedly produces no positions.
 */
export const firstExpectedPosition = (sourceText: string): SourcePosition => {
  const firstPosition = expectedPositions(sourceText).at(0);
  if (firstPosition === undefined) {
    throw new Error("Generated position scans should always include BOF.");
  }

  return firstPosition;
};

/**
 * Advances the independent test oracle by one source display unit.
 */
const advanceExpectedPosition = (
  sourceText: string,
  state: PositionScanState,
): PositionScanState => {
  const codePoint = sourceText.codePointAt(state.index);
  if (codePoint === undefined) {
    return state;
  }

  const character = String.fromCodePoint(codePoint);
  if (isLineTerminator(character)) {
    return advanceExpectedLineTerminator(sourceText, state);
  }

  const nextState = {
    line: state.line,
    column: state.column + 1,
    byteOffset: state.byteOffset + utf8ByteLength(character),
    index: state.index + character.length,
  };

  return withPosition(state, nextState);
};

/**
 * Advances the independent test oracle over one line terminator.
 */
const advanceExpectedLineTerminator = (
  sourceText: string,
  state: PositionScanState,
): PositionScanState => {
  const character = sourceText[state.index] ?? "";
  const byteLength = isCrLfTerminator(sourceText, state.index) ? 2 : utf8ByteLength(character);
  const indexLength = isCrLfTerminator(sourceText, state.index) ? 2 : character.length;
  const nextState = {
    line: state.line + 1,
    column: 1,
    byteOffset: state.byteOffset + byteLength,
    index: state.index + indexLength,
  };

  return withPosition(state, nextState);
};

/**
 * Appends the current position after one scan step.
 */
const withPosition = (
  previousState: PositionScanState,
  nextState: Omit<PositionScanState, "positions" | "textIndexes">,
): PositionScanState => {
  const position = {
    offset: nextState.byteOffset,
    line: nextState.line,
    column: nextState.column,
  };

  return {
    ...nextState,
    positions: [...previousState.positions, position],
    textIndexes: [
      ...previousState.textIndexes,
      { offset: nextState.byteOffset, index: nextState.index },
    ],
  };
};

/**
 * Computes the generated source's accepted display offsets.
 *
 * @param sourceText - Generated source text to scan.
 * @returns Accepted byte offsets for source-position lookups.
 */
export const validOffsetSet = (sourceText: string): ReadonlySet<number> => {
  return new Set(expectedPositions(sourceText).map((position) => position.offset));
};

/**
 * Slices original source text by independently derived byte-offset indexes.
 *
 * @param sourceText - Generated source text to slice.
 * @param startOffset - Inclusive valid UTF-8 byte offset.
 * @param endOffset - Exclusive valid UTF-8 byte offset.
 * @returns The substring bounded by the supplied byte offsets.
 */
export const originalSubstring = (
  sourceText: string,
  startOffset: number,
  endOffset: number,
): string => {
  return sourceText.slice(
    textIndexAtByteOffset(sourceText, startOffset),
    textIndexAtByteOffset(sourceText, endOffset),
  );
};

/**
 * Looks up an independent UTF-16 string index for a valid byte offset.
 */
const textIndexAtByteOffset = (sourceText: string, offset: number): number => {
  const entry = expectedTextIndexes(sourceText).find((candidate) => candidate.offset === offset);
  if (entry === undefined) {
    throw new Error(`Generated offset ${offset} should have a text index.`);
  }

  return entry.index;
};

/**
 * Computes generated text indexes independently from production helpers.
 */
const expectedTextIndexes = (sourceText: string): readonly ByteOffsetIndex[] => {
  return expectedScanState(sourceText).textIndexes;
};

/**
 * Asserts that generated display positions move forward through the file.
 *
 * @param positions - Generated display positions to compare in order.
 */
export const expectMonotonicPositions = (positions: readonly SourcePosition[]): void => {
  for (let index = 1; index < positions.length; index += 1) {
    expectMonotonicPositionPair(positions[index - 1], positions[index]);
  }
};

/** Asserts ordering between adjacent positions from the generated scan. */
const expectMonotonicPositionPair = (
  previous: SourcePosition | undefined,
  current: SourcePosition | undefined,
): void => {
  if (previous === undefined || current === undefined) {
    throw new Error("Generated position scans should only compare positions.");
  }

  expect(current.offset).toBeGreaterThan(previous.offset);
  expect(current.line).toBeGreaterThanOrEqual(previous.line);
  if (current.line === previous.line) {
    expect(current.column).toBeGreaterThan(previous.column);
  }
};

/**
 * Computes UTF-8 byte length with the platform text encoder.
 */
const utf8ByteLength = (text: string): number => {
  return TEXT_ENCODER.encode(text).length;
};

/**
 * Checks whether a character starts a line terminator.
 */
const isLineTerminator = (character: string): boolean => {
  return LINE_TERMINATORS.has(character);
};

/**
 * Checks whether a string index starts a CRLF terminator.
 */
const isCrLfTerminator = (sourceText: string, index: number): boolean => {
  return sourceText[index] === "\r" && sourceText[index + 1] === "\n";
};
