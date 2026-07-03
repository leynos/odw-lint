/**
 * @file Merged static workflow lint entry point.
 *
 * This module owns the first complete static lint pipeline: build an original
 * source file, scan the workflow envelope, classify workflow metadata, and
 * return the canonical diagnostic stream.
 */

import type { Diagnostic } from "../diagnostics/types";
import { createOriginalSourceFile } from "./source-file";
import type {
  OriginalSourceFile,
  WorkflowEnvelope,
  WorkflowEnvelopeScanResult,
  WorkflowSource,
} from "./types";
import { parseNormalizedWorkflowBody } from "./workflow-body-parse";
import { bodySyntaxDiagnosticsForParse } from "./workflow-body-parser";
import { scanDeterministicTimeWarnings } from "./workflow-deterministic-time";
import { scanWorkflowEnvelope } from "./workflow-envelope";
import { classifyWorkflowMetadata, type WorkflowMetadataClassification } from "./workflow-metadata";

export type WorkflowLintResult = {
  readonly sourceFile: OriginalSourceFile;
  readonly scan: WorkflowEnvelopeScanResult;
  readonly classification: WorkflowMetadataClassification;
  readonly bodySyntax: readonly Diagnostic[];
  readonly claudeCompatibility: readonly Diagnostic[];
  readonly diagnostics: readonly Diagnostic[];
};

type WorkflowBodyDiagnostics = {
  readonly bodySyntax: readonly Diagnostic[];
  readonly claudeCompatibility: readonly Diagnostic[];
};

/**
 * Statically lints one workflow source string without evaluating it.
 *
 * Diagnostics are returned in canonical pipeline order: envelope diagnostics
 * first, followed by metadata, body syntax, and Claude compatibility diagnostics.
 *
 * @param source - Workflow source text and its diagnostic file path.
 * @returns Immutable source, scan, classification, and merged diagnostics.
 */
export const lintWorkflowSource = (source: WorkflowSource): WorkflowLintResult => {
  const sourceFile = createOriginalSourceFile(source);
  const scan = scanWorkflowEnvelope(sourceFile);
  const classification = classifyWorkflowMetadata(scan);
  const { bodySyntax, claudeCompatibility } =
    scan.status === "scanned"
      ? lintScannedWorkflowBody(scan.envelope)
      : emptyWorkflowBodyDiagnostics();
  const diagnostics = Object.freeze([
    ...scan.diagnostics,
    ...classification.diagnostics,
    ...bodySyntax,
    ...claudeCompatibility,
  ]);

  return Object.freeze({
    sourceFile,
    scan,
    classification,
    bodySyntax,
    claudeCompatibility,
    diagnostics,
  });
};

/** Returns immutable empty body diagnostics for missing-envelope workflows. */
const emptyWorkflowBodyDiagnostics = (): WorkflowBodyDiagnostics => {
  return Object.freeze({
    bodySyntax: Object.freeze([]),
    claudeCompatibility: Object.freeze([]),
  });
};

/** Lints parser-backed body rules from one shared normalized body parse. */
const lintScannedWorkflowBody = (envelope: WorkflowEnvelope): WorkflowBodyDiagnostics => {
  const bodyParse = parseNormalizedWorkflowBody(envelope);
  const bodySyntax = Object.freeze([...bodySyntaxDiagnosticsForParse(envelope, bodyParse)]);

  if (!bodyParse.ok) {
    return Object.freeze({
      bodySyntax,
      claudeCompatibility: Object.freeze([]),
    });
  }

  return Object.freeze({
    bodySyntax,
    claudeCompatibility: Object.freeze([...scanDeterministicTimeWarnings(envelope, bodyParse)]),
  });
};
