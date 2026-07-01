/**
 * @file Passive boundary constants and types for the static-analysis pipeline.
 */

import type { Diagnostic, SourcePosition, SourceSpan } from "../diagnostics/types";

/**
 * Stable identifier for the owned production static-analysis boundary.
 */
export const STATIC_ANALYSIS_BOUNDARY = "odw-lint/static-analysis";

/**
 * Original workflow source as read from a file or future standard input.
 */
export interface WorkflowSource {
  /**
   * Repository or invocation path used when reporting source locations.
   */
  readonly filePath: string;

  /**
   * Raw workflow source text before any static-analysis normalization.
   */
  readonly sourceText: string;
}

/**
 * Private brand proving that a source record was built by the factory.
 *
 * The symbol is exported only for the implementation module. The package entry
 * does not re-export it, so package consumers cannot structurally construct an
 * `OriginalSourceFile` that helper functions will accept.
 */
export const ORIGINAL_SOURCE_FILE_BRAND: unique symbol = Symbol("OriginalSourceFile");

/**
 * Metadata for one display line in an original workflow source file.
 */
export type SourceLine = {
  /** One-based display line number. */
  readonly line: number;
  /** Zero-based UTF-8 byte offset where this line starts. */
  readonly startOffset: number;
  /** Zero-based UTF-8 byte offset before this line's terminator. */
  readonly contentEndOffset: number;
  /** Zero-based UTF-8 byte offset after this line's terminator. */
  readonly terminatorEndOffset: number;
  /** Original source text for this line, excluding its terminator. */
  readonly text: string;
};

/**
 * Immutable source record used by parser, mapper, and reporter helpers.
 *
 * Create these records with `createOriginalSourceFile`. They are nominally
 * branded because parser, mapper, and reporter helpers depend on private
 * offset indexes built during factory construction.
 */
export type OriginalSourceFile = {
  /** Factory-only brand for private source index ownership. */
  readonly [ORIGINAL_SOURCE_FILE_BRAND]: true;
  /** Repository or invocation path used in diagnostics. */
  readonly filePath: string;
  /** Original source text before static-analysis normalization. */
  readonly sourceText: string;
  /** UTF-8 byte length of the original source text. */
  readonly byteLength: number;
  /** Display lines derived from the original source text. */
  readonly lines: readonly SourceLine[];
};

export type WorkflowEnvelopeScanResult =
  | {
      readonly status: "missing-meta";
      readonly sourceFile: OriginalSourceFile;
      readonly diagnostics: readonly Diagnostic[];
      readonly envelope: undefined;
    }
  | {
      readonly status: "scanned";
      readonly sourceFile: OriginalSourceFile;
      readonly diagnostics: readonly Diagnostic[];
      readonly envelope: WorkflowEnvelope;
    };

export type WorkflowEnvelope = {
  readonly sourceFile: OriginalSourceFile;
  readonly metaDeclarationSpan: SourceSpan;
  readonly metaExportKeywordSpan: SourceSpan;
  readonly metaAssignmentOperatorSpan: SourceSpan;
  readonly metaValue: WorkflowMetaValue;
  readonly bodySpan: SourceSpan;
  readonly unsupportedDeclarations: readonly UnsupportedWorkflowSyntax[];
};

export type WorkflowMetaValue =
  | {
      readonly kind: "object";
      readonly span: SourceSpan;
      readonly openBraceSpan: SourceSpan;
      readonly closeBraceSpan: SourceSpan;
    }
  | {
      readonly kind: "non-object-expression";
      readonly expressionStartSpan: SourceSpan;
      readonly expressionSpan: SourceSpan;
    }
  | {
      readonly kind: "unterminated-object";
      readonly openBraceSpan: SourceSpan;
      readonly span: SourceSpan;
    }
  | {
      readonly kind: "missing-value";
      readonly span: SourceSpan;
    };

export type UnsupportedWorkflowSyntax = {
  readonly kind: "import" | "export";
  readonly keyword: "import" | "export";
  readonly span: SourceSpan;
  readonly sourceText: string;
};

/**
 * Reviewer-useful text slice derived from a validated source span.
 */
export type SourceSnippet = {
  /** Exact original source text covered by the span. */
  readonly text: string;
  /** Validated start position used to produce the snippet. */
  readonly start: SourcePosition;
  /** Validated end position used to produce the snippet. */
  readonly end: SourcePosition;
  /** First source line text covered by the snippet, without terminator. */
  readonly lineText: string;
};

/**
 * Error raised when a source helper receives an invalid original-source offset.
 */
export class SourceOffsetError extends Error {
  /**
   * Creates a source-offset error with a stable class name.
   */
  public constructor(message: string) {
    super(message);
    this.name = "SourceOffsetError";
  }
}

/**
 * Passive labels for the static-analysis components described by the design.
 */
export const STATIC_ANALYSIS_COMPONENTS = [
  "source-reader",
  "envelope-scanner",
  "static-meta-parser",
  "body-normalizer",
  "swc-parser-adapter",
  "span-mapper",
  "rule-engine",
  "reporter",
] as const;

/**
 * Component label for a static-analysis pipeline responsibility.
 */
export type StaticAnalysisComponent = (typeof STATIC_ANALYSIS_COMPONENTS)[number];

/**
 * Passive labels for the source-to-diagnostic analysis stages.
 */
export const STATIC_ANALYSIS_STAGES = [
  "source",
  "envelope",
  "metadata",
  "body",
  "ast",
  "diagnostic",
] as const;

/**
 * Stage label for a static-analysis pipeline checkpoint.
 */
export type StaticAnalysisStage = (typeof STATIC_ANALYSIS_STAGES)[number];
