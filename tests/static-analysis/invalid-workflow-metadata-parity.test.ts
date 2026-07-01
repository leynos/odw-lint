/**
 * @file Metadata classifier parity tests for invalid workflow fixtures.
 */

import { describe, expect, it } from "bun:test";
import type { Diagnostic, SourceSpan } from "odw-lint";
import {
  classifyWorkflowMetadata,
  createOriginalSourceFile,
  scanWorkflowEnvelope,
  sliceSourceSpan,
} from "odw-lint";
import { readFixtureSource } from "./fixtures/corpus-support";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./fixtures/invalid-workflows";
import type {
  InvalidWorkflowFixtureDiagnostic,
  InvalidWorkflowFixtureSnapshot,
  InvalidWorkflowFixtureStatus,
} from "./fixtures/invalid-workflows/manifest-types";

const FIXTURE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/",
  recursive: true,
} as const;
const TASK_2_1_3_RULES = new Set([
  "odw/meta-required",
  "odw/meta-object",
  "odw/meta-statically-unprovable",
  "odw/meta-name",
  "odw/meta-description",
  "odw/no-import-export",
]);

type ComparableDiagnostic = {
  readonly rule: string;
  readonly severity: Diagnostic["severity"];
  readonly message: string;
  readonly span: SourceSpan;
  readonly spanText: string;
};
type TaskOwnedFixtureResult = {
  readonly diagnostics: readonly ComparableDiagnostic[];
  readonly status: InvalidWorkflowFixtureStatus | undefined;
};

/** Keeps only diagnostics owned by roadmap task 2.1.3. */
const taskOwnedFixtureDiagnostics = (
  diagnostics: readonly InvalidWorkflowFixtureDiagnostic[],
): readonly InvalidWorkflowFixtureDiagnostic[] => {
  return diagnostics.filter((diagnostic) => TASK_2_1_3_RULES.has(String(diagnostic.rule)));
};

/** Runs the task-owned static metadata checks for one invalid fixture. */
const classifyInvalidFixture = (
  fixture: InvalidWorkflowFixtureSnapshot,
): TaskOwnedFixtureResult => {
  const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fixturePath);
  const sourceFile = createOriginalSourceFile({
    filePath: fixture.fixturePath,
    sourceText,
  });
  const envelope = scanWorkflowEnvelope(sourceFile);
  const diagnostics = [
    ...envelope.diagnostics,
    ...classifyWorkflowMetadata(envelope).diagnostics,
  ].filter((diagnostic) => TASK_2_1_3_RULES.has(String(diagnostic.rule)));

  return {
    diagnostics: diagnostics.map((diagnostic) => ({
      rule: String(diagnostic.rule),
      severity: diagnostic.severity,
      message: diagnostic.message,
      span: diagnostic.span,
      spanText: sliceSourceSpan(sourceFile, diagnostic.span),
    })),
    status: statusFromDiagnostics(diagnostics),
  };
};

/** Converts manifest diagnostics into the same reviewer-facing comparison shape. */
const comparableFixtureDiagnostics = (
  diagnostics: readonly InvalidWorkflowFixtureDiagnostic[],
): TaskOwnedFixtureResult => {
  const taskDiagnostics = taskOwnedFixtureDiagnostics(diagnostics);

  return {
    diagnostics: taskDiagnostics.map((diagnostic) => ({
      rule: String(diagnostic.rule),
      severity: diagnostic.severity,
      message: diagnostic.message,
      span: diagnostic.span,
      spanText: diagnostic.spanText,
    })),
    status: statusFromDiagnostics(taskDiagnostics),
  };
};

/** Maps task-owned diagnostics to the fixture status contract. */
const statusFromDiagnostics = (
  diagnostics: readonly { readonly severity: Diagnostic["severity"] }[],
): InvalidWorkflowFixtureStatus | undefined => {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "error";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "warning";
  }
  return undefined;
};

describe("invalid workflow metadata classifier parity", () => {
  it("matches task-owned metadata and envelope diagnostics for invalid fixtures", () => {
    for (const fixture of INVALID_WORKFLOW_FIXTURE_SNAPSHOTS) {
      const expected = comparableFixtureDiagnostics(fixture.expectedDiagnostics);

      expect(classifyInvalidFixture(fixture)).toEqual(expected);
      if (expected.status !== undefined) {
        expect(expected.status).toBe(fixture.expectedStatus);
      }
    }
  });

  it("preserves deferred body syntax fixture expectations", () => {
    const syntaxFixtures = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.family === "syntax-error",
    );

    expect(syntaxFixtures).toHaveLength(2);
    for (const fixture of syntaxFixtures) {
      expect(fixture.expectedDiagnostics.map((diagnostic) => String(diagnostic.rule))).toContain(
        "odw/body-syntax",
      );
      expect(taskOwnedFixtureDiagnostics(fixture.expectedDiagnostics)).toEqual([]);
    }
  });
});
