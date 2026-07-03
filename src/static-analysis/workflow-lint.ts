/**
 * @file Merged static workflow lint entry point.
 *
 * This module owns the first complete static lint pipeline: build an original
 * source file, scan the workflow envelope, classify workflow metadata, and
 * return the canonical diagnostic stream.
 */

import type { Diagnostic } from "../diagnostics/types";
import { createOriginalSourceFile } from "./source-file";
import type { OriginalSourceFile, WorkflowEnvelopeScanResult, WorkflowSource } from "./types";
import { scanDeterministicTimeWarnings } from "./workflow-deterministic-time";
import { scanWorkflowEnvelope } from "./workflow-envelope";
import { classifyWorkflowMetadata, type WorkflowMetadataClassification } from "./workflow-metadata";

export type WorkflowLintResult = {
  readonly sourceFile: OriginalSourceFile;
  readonly scan: WorkflowEnvelopeScanResult;
  readonly classification: WorkflowMetadataClassification;
  readonly claudeCompatibility: readonly Diagnostic[];
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Statically lints one workflow source string without evaluating it.
 *
 * Diagnostics are returned in canonical pipeline order: envelope diagnostics
 * first, followed by metadata diagnostics and Claude compatibility diagnostics.
 *
 * @param source - Workflow source text and its diagnostic file path.
 * @returns Immutable source, scan, classification, and merged diagnostics.
 */
export const lintWorkflowSource = (source: WorkflowSource): WorkflowLintResult => {
  const sourceFile = createOriginalSourceFile(source);
  const scan = scanWorkflowEnvelope(sourceFile);
  const classification = classifyWorkflowMetadata(scan);
  const claudeCompatibility = Object.freeze(
    scan.status === "scanned" ? [...scanDeterministicTimeWarnings(scan.envelope)] : [],
  );
  const diagnostics = Object.freeze([
    ...scan.diagnostics,
    ...classification.diagnostics,
    ...claudeCompatibility,
  ]);

  return Object.freeze({
    sourceFile,
    scan,
    classification,
    claudeCompatibility,
    diagnostics,
  });
};
