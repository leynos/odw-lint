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
import { createOriginalSourceFile, scanWorkflowEnvelope, sliceSourceSpan } from "odw-lint";

type EnvelopeForBodyOptions = {
  readonly filePath?: string;
  readonly separator?: string;
};

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
 * Builds a scanned workflow envelope for one body snippet.
 *
 * @param body - Workflow body text to place after a valid metadata export.
 * @param options - Optional fixture path and metadata/body separator.
 * @returns A scanned workflow envelope for the generated source text.
 */
export const envelopeForBody = (
  body: string,
  options: EnvelopeForBodyOptions = {},
): WorkflowEnvelope => {
  const filePath = options.filePath ?? "workflows/example.js";
  const separator = options.separator ?? "\n";
  const sourceFile = createOriginalSourceFile({
    filePath,
    sourceText: `export const meta = { name: "example", description: "ok" };${separator}${body}`,
  });

  return expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), filePath);
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
