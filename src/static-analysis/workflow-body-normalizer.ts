/**
 * @file Static workflow body normalization and span mapping.
 *
 * Wraps an ODW workflow body in an async function so SWC can parse top-level
 * `return` and `await`, then maps normalized byte offsets back to original
 * workflow source spans. This module only builds strings and spans; it never
 * executes workflow source.
 */

import type { SourceSpan } from "../diagnostics/types";
import { spanFromOffsets } from "./source-position";
import { sliceSourceSpan } from "./source-snippet";
import type { OriginalSourceFile, WorkflowEnvelope } from "./types";
import { SourceOffsetError } from "./types";

const TEXT_ENCODER = new TextEncoder();
const WORKFLOW_BODY_WRAP_PREFIX = "async function __odwLintWorkflowBody__() {";
const WORKFLOW_BODY_WRAP_SUFFIX = "\n}";
const WORKFLOW_BODY_WRAP_PREFIX_BYTE_LENGTH =
  TEXT_ENCODER.encode(WORKFLOW_BODY_WRAP_PREFIX).byteLength;

/**
 * SWC-parseable workflow body plus the offsets needed to recover original
 * source spans.
 */
export type NormalizedWorkflowBody = {
  /** SWC-parseable source: async-function wrapper around the body slice. */
  readonly normalizedText: string;
  /** UTF-8 byte length of the injected wrapper prefix. */
  readonly prefixByteLength: number;
  /** Original-source byte offset where the body slice begins. */
  readonly bodyByteOffset: number;
  /** UTF-8 byte length of the original body slice. */
  readonly bodyByteLength: number;
};

/**
 * Builds SWC-parseable source for one scanned workflow body.
 *
 * @param envelope - Workflow envelope whose body should be normalized.
 * @returns Frozen normalized source and offset metadata.
 */
export const normalizeWorkflowBody = (envelope: WorkflowEnvelope): NormalizedWorkflowBody => {
  const bodyText = sliceSourceSpan(envelope.sourceFile, envelope.bodySpan);

  return Object.freeze({
    normalizedText: `${WORKFLOW_BODY_WRAP_PREFIX}${bodyText}${WORKFLOW_BODY_WRAP_SUFFIX}`,
    prefixByteLength: WORKFLOW_BODY_WRAP_PREFIX_BYTE_LENGTH,
    bodyByteOffset: envelope.bodySpan.start.offset,
    bodyByteLength: TEXT_ENCODER.encode(bodyText).byteLength,
  });
};

/**
 * Converts a normalized-source byte range back to a validated original-source
 * span.
 *
 * @param sourceFile - Original workflow source file.
 * @param normalized - Normalized workflow body returned by `normalizeWorkflowBody`.
 * @param normalizedStartByte - Inclusive byte offset in normalized source.
 * @param normalizedEndByte - Exclusive byte offset in normalized source.
 * @returns Original-source span covering the same workflow body text.
 * @throws SourceOffsetError when the byte range touches wrapper text or is reversed.
 */
export const originalSpanFromNormalizedOffsets = (
  sourceFile: OriginalSourceFile,
  normalized: NormalizedWorkflowBody,
  normalizedStartByte: number,
  normalizedEndByte: number,
): SourceSpan => {
  const relativeStart = normalizedStartByte - normalized.prefixByteLength;
  const relativeEnd = normalizedEndByte - normalized.prefixByteLength;

  if (relativeStart < 0) {
    throw new SourceOffsetError(
      `Normalized start offset ${normalizedStartByte} is inside the injected workflow wrapper.`,
    );
  }
  if (relativeEnd > normalized.bodyByteLength) {
    throw new SourceOffsetError(
      `Normalized end offset ${normalizedEndByte} is inside the injected workflow wrapper.`,
    );
  }
  if (relativeEnd < relativeStart) {
    throw new SourceOffsetError(
      `Normalized end offset ${normalizedEndByte} is before start ${normalizedStartByte}.`,
    );
  }

  return spanFromOffsets(
    sourceFile,
    normalized.bodyByteOffset + relativeStart,
    normalized.bodyByteOffset + relativeEnd,
  );
};
