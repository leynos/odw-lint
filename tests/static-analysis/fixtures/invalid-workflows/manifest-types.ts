/**
 * @file Shared invalid workflow fixture manifest types and builders.
 */

import type { DiagnosticSeverity, RuleId, SourceSpan } from "odw-lint";
import { makeRuleId } from "odw-lint";
import { deepFreezeFixtureManifest } from "../manifest-freeze";

/**
 * Supported deliberately invalid workflow fixture families.
 */
export type InvalidWorkflowFixtureFamily =
  | "missing-metadata"
  | "malformed-metadata"
  | "hostile-metadata"
  | "unsupported-import-export"
  | "syntax-error";

/**
 * Expected lint status for deliberately invalid workflow fixtures.
 */
export type InvalidWorkflowFixtureStatus = "error" | "warning";

/**
 * Expected diagnostic for one invalid workflow fixture.
 */
export interface InvalidWorkflowFixtureDiagnostic {
  /**
   * Static-analysis rule expected to report the diagnostic.
   */
  readonly rule: RuleId;

  /**
   * Diagnostic severity expected from the static-analysis rule.
   */
  readonly severity: DiagnosticSeverity;

  /**
   * Reviewer-facing diagnostic message.
   */
  readonly message: string;

  /**
   * Source span in original UTF-8 source coordinates.
   */
  readonly span: SourceSpan;

  /**
   * Source text covered by the UTF-8 byte range in `span`.
   */
  readonly spanText: string;
}

/**
 * Immutable metadata for one deliberately invalid workflow fixture.
 */
export interface InvalidWorkflowFixtureSnapshot {
  /**
   * Fixture family used for roadmap coverage reporting.
   */
  readonly family: InvalidWorkflowFixtureFamily;

  /**
   * Basename of the copied fixture file.
   */
  readonly fileName: string;

  /**
   * Repository-relative path to the copied fixture file.
   */
  readonly fixturePath: string;

  /**
   * SHA-256 digest of the copied fixture source text.
   */
  readonly sha256: string;

  /**
   * Highest expected status for this fixture.
   */
  readonly expectedStatus: InvalidWorkflowFixtureStatus;

  /**
   * Expected diagnostics for this fixture.
   */
  readonly expectedDiagnostics: readonly InvalidWorkflowFixtureDiagnostic[];
}

const INVALID_WORKFLOW_FIXTURE_ROOT = "tests/static-analysis/fixtures/invalid-workflows";

type InvalidWorkflowFixtureInput = Omit<
  InvalidWorkflowFixtureSnapshot,
  "fixturePath" | "expectedDiagnostics"
> & {
  readonly expectedDiagnostics: readonly InvalidWorkflowFixtureDiagnostic[];
};

/**
 * Builds one runtime-frozen invalid workflow fixture manifest entry.
 *
 * @param fixture - Fixture metadata without its derived repository path.
 * @returns Frozen fixture metadata with its repository-relative path.
 */
export const invalidWorkflowFixture = (
  fixture: InvalidWorkflowFixtureInput,
): InvalidWorkflowFixtureSnapshot => {
  return deepFreezeFixtureManifest({
    ...fixture,
    fixturePath: `${INVALID_WORKFLOW_FIXTURE_ROOT}/${fixture.family}/${fixture.fileName}`,
    expectedDiagnostics: [...fixture.expectedDiagnostics],
  });
};

/**
 * Creates one expected diagnostic with a validated rule identifier.
 *
 * @param diagnosticFixture - Diagnostic metadata before rule branding.
 * @returns Frozen diagnostic metadata with a branded rule identifier.
 */
export const diagnostic = (
  diagnosticFixture: Omit<InvalidWorkflowFixtureDiagnostic, "rule"> & { readonly rule: string },
): InvalidWorkflowFixtureDiagnostic => {
  const span = deepFreezeFixtureManifest({
    start: { ...diagnosticFixture.span.start },
    end: { ...diagnosticFixture.span.end },
  });

  return deepFreezeFixtureManifest({
    ...diagnosticFixture,
    rule: makeRuleId(diagnosticFixture.rule),
    span,
  });
};
