/**
 * @file Original-source slicing and reviewer-facing snippets.
 *
 * This module owns text extraction from validated original source spans. It
 * revalidates caller-supplied spans before slicing so diagnostics cannot point
 * at stale or structurally forged source coordinates.
 */

import type { SourcePosition, SourceSpan } from "../diagnostics/types";
import { textIndexAtOffset } from "./source-indexes";
import { validateSourceSpan } from "./source-position";
import { type OriginalSourceFile, SourceOffsetError, type SourceSnippet } from "./types";

/**
 * Returns the exact original source text covered by a validated span.
 *
 * Caller-supplied spans are revalidated against the source record before
 * slicing so stale line, column, or offset data cannot produce misleading
 * snippets.
 *
 * @example
 * ```ts
 * const file = createOriginalSourceFile({
 *   filePath: "workflows/example.js",
 *   sourceText: "meta\nbody",
 * });
 * sliceSourceSpan(file, spanFromOffsets(file, 5, 9)); // "body"
 * ```
 *
 * @param file - Original source-file record created by
 *   `createOriginalSourceFile`.
 * @param span - Half-open source span to validate and slice.
 * @returns The exact original text covered by the span.
 * @throws SourceOffsetError when the span is reversed, out of bounds, or does
 *   not match the supplied source file.
 */
export const sliceSourceSpan = (file: OriginalSourceFile, span: SourceSpan): string => {
  return sliceValidatedSourceSpan(file, validateSourceSpan(file, span));
};

/**
 * Returns a reviewer-useful snippet for a validated original-source span.
 *
 * @example
 * ```ts
 * const file = createOriginalSourceFile({
 *   filePath: "workflows/example.js",
 *   sourceText: "meta\nbody",
 * });
 * snippetForSpan(file, spanFromOffsets(file, 0, 4)).lineText; // "meta"
 * ```
 *
 * @param file - Original source-file record created by
 *   `createOriginalSourceFile`.
 * @param span - Half-open source span to validate and describe.
 * @returns Exact original text plus the validated positions and first line.
 * @throws SourceOffsetError when the span is invalid for the supplied file.
 */
export const snippetForSpan = (file: OriginalSourceFile, span: SourceSpan): SourceSnippet => {
  const validatedSpan = validateSourceSpan(file, span);

  return Object.freeze({
    text: sliceValidatedSourceSpan(file, validatedSpan),
    start: validatedSpan.start,
    end: validatedSpan.end,
    lineText: lineTextAtPosition(file, validatedSpan.start),
  });
};

/** Slices original source text after span validation has succeeded. */
const sliceValidatedSourceSpan = (file: OriginalSourceFile, span: SourceSpan): string => {
  return file.sourceText.slice(
    textIndexAtOffset(file, span.start.offset),
    textIndexAtOffset(file, span.end.offset),
  );
};

/** Looks up the first line text for a validated snippet position. */
const lineTextAtPosition = (file: OriginalSourceFile, position: SourcePosition): string => {
  const sourceLine = file.lines[position.line - 1];
  if (sourceLine === undefined) {
    throw new SourceOffsetError(`Line ${position.line} does not exist in ${file.filePath}.`);
  }

  return sourceLine.text;
};
