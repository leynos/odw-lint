/**
 * @file Shared assertions for workflow envelope scanner tests.
 */

import { expect } from "bun:test";
import type {
  OriginalSourceFile,
  SourceSpan,
  WorkflowEnvelope,
  WorkflowEnvelopeScanResult,
} from "odw-lint";
import { sliceSourceSpan } from "odw-lint";

/**
 * Requires a scanned result and returns its envelope.
 *
 * @param result - Workflow envelope scan result to narrow.
 * @param label - Human-readable fixture label for assertion failures.
 * @returns The scanned workflow envelope.
 * @throws Error when the scan did not find metadata.
 */
export const expectScannedEnvelope = (
  result: WorkflowEnvelopeScanResult,
  label = "workflow",
): WorkflowEnvelope => {
  expect(result.status).toBe("scanned");
  if (result.status !== "scanned") {
    throw new Error(`Expected ${label} to expose metadata.`);
  }

  return result.envelope;
};

/**
 * Returns original source text for a source span.
 *
 * @param sourceFile - Original workflow source file that owns the span.
 * @param span - Span to decode from original source bytes.
 * @returns The original source text covered by the span.
 */
export const spanTextFor = (sourceFile: OriginalSourceFile, span: SourceSpan): string => {
  return sliceSourceSpan(sourceFile, span);
};
