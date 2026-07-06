/**
 * @file Internal source coordinate copy helpers for diagnostic payloads.
 *
 * This module owns the small runtime-freezing contract shared by diagnostic
 * construction and static-analysis span helpers without widening the package
 * entry surface.
 */

import type { SourcePosition, SourceSpan } from "./types";

/**
 * Copies a source position into a frozen value object.
 *
 * @param position - Source position metadata to copy.
 * @returns Frozen copy with the same public diagnostic coordinates.
 */
export const copySourcePosition = (position: SourcePosition): SourcePosition => {
  return Object.freeze({ ...position });
};

/**
 * Freezes a source span around caller-owned position references.
 *
 * @param start - Inclusive start position reference for the span.
 * @param end - Exclusive end position reference for the span.
 * @returns Frozen span record preserving the supplied nested references.
 */
export const freezeSourceSpan = (start: SourcePosition, end: SourcePosition): SourceSpan => {
  return Object.freeze({ start, end });
};
