/**
 * @file Public inert-region mask data types for static source scans.
 *
 * The source-mask facade re-exports these types so public consumers keep the
 * same import path while internal scanner modules avoid facade import cycles.
 */

import type { OriginalSourceFile } from "./types";

/** Inert source region kind recognised by the source masker. */
export type SourceMaskKind = "comment" | "string" | "template" | "regex";

/**
 * Half-open UTF-16 text-index range masked in an original source file.
 *
 * `startIndex` is inclusive, `endIndex` is exclusive, and a valid range always
 * has `startIndex < endIndex`.
 */
export type SourceMaskRange = Readonly<{
  kind: SourceMaskKind;
  startIndex: number;
  endIndex: number;
}>;

/**
 * Masked source text plus the inert ranges that produced it.
 *
 * Ranges are ordered by ascending `startIndex` and do not overlap, matching the
 * scanner order used to produce `maskedText`.
 */
export type MaskedSource = Readonly<{
  sourceFile: OriginalSourceFile;
  maskedText: string;
  ranges: readonly SourceMaskRange[];
}>;
