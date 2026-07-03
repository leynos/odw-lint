/**
 * @file Internal SWC parser helper for normalized workflow bodies.
 *
 * Keeps the normalize-and-parse path shared by syntax diagnostics and later
 * fact producers without exposing parser-specific types through the package
 * entry point.
 */

import { type Module, type ParseOptions, parseSync } from "@swc/core";
import type { SourceSpan } from "../diagnostics/types";
import type { WorkflowEnvelope } from "./types";
import { type NormalizedWorkflowBody, normalizeWorkflowBody } from "./workflow-body-normalizer";

export type NormalizedBodyParseResult =
  | {
      readonly ok: true;
      readonly sourceFile: WorkflowEnvelope["sourceFile"];
      readonly bodySpan: SourceSpan;
      readonly normalized: NormalizedWorkflowBody;
      readonly module: Module;
    }
  | {
      readonly ok: false;
      readonly sourceFile: WorkflowEnvelope["sourceFile"];
      readonly bodySpan: SourceSpan;
      readonly normalized: NormalizedWorkflowBody;
      readonly error: unknown;
    };

// SWC returns `Script` when options contain `isModule: false`; forbid that
// drift at this internal boundary so callers keep receiving `Module`.
type ModuleParseOptions = ParseOptions & { readonly isModule?: true };

const WORKFLOW_BODY_PARSE_OPTIONS: ModuleParseOptions = {
  // ADR 0002 records why workflow bodies stay ECMAScript-only for ODW parity.
  syntax: "ecmascript",
  jsx: false,
};

/** Parses normalized source with the module-returning SWC overload. */
const parseNormalizedModule = (sourceText: string): Module => {
  return parseSync(sourceText, WORKFLOW_BODY_PARSE_OPTIONS);
};

/**
 * Normalizes and parses one workflow body without executing source.
 *
 * @param envelope - Scanned workflow envelope with an original-source body span.
 * @returns A frozen parsed module result, or a frozen parser-failure marker.
 */
export const parseNormalizedWorkflowBody = (
  envelope: WorkflowEnvelope,
): NormalizedBodyParseResult => {
  const normalized = normalizeWorkflowBody(envelope);

  try {
    return Object.freeze({
      ok: true,
      sourceFile: envelope.sourceFile,
      bodySpan: envelope.bodySpan,
      normalized,
      module: parseNormalizedModule(normalized.normalizedText),
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      sourceFile: envelope.sourceFile,
      bodySpan: envelope.bodySpan,
      normalized,
      error,
    });
  }
};
