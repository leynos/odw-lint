/**
 * @file Shared dual-compatibility fixture manifest types and builders.
 */

import type {
  DiagnosticSeverity,
  RuleDefinition,
  RuleDocumentationPath,
  RuleId,
  SourceSpan,
} from "odw-lint";
import { findRuleDefinition, makeRuleId, ruleDocsPath } from "odw-lint";
import { deepFreezeFixtureManifest } from "../manifest-freeze";

/**
 * Supported dual-compatibility fixture families.
 */
export type DualCompatFixtureFamily = "pure-metadata" | "deterministic-time" | "claude-pure-meta";

/**
 * Expected lint status for dual-compatibility fixtures.
 */
export type DualCompatFixtureStatus = "no-error" | "warning";

/**
 * Expected diagnostic for one dual-compatibility fixture.
 */
export interface DualCompatFixtureDiagnostic {
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
   * Repository-relative documentation path for the diagnostic rule.
   */
  readonly docs: RuleDocumentationPath;

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
 * Immutable metadata for one dual-compatibility fixture.
 */
export interface DualCompatFixtureSnapshot {
  /**
   * Fixture family used for roadmap coverage reporting.
   */
  readonly family: DualCompatFixtureFamily;

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
  readonly expectedStatus: DualCompatFixtureStatus;

  /**
   * Expected diagnostics for this fixture.
   */
  readonly expectedDiagnostics: readonly DualCompatFixtureDiagnostic[];
}

export const DUAL_COMPAT_FIXTURE_ROOT = "tests/static-analysis/fixtures/dual-compat";

type DualCompatFixtureInput = Omit<DualCompatFixtureSnapshot, "fixturePath">;

type DualCompatFixtureDiagnosticInput = Omit<DualCompatFixtureDiagnostic, "rule" | "docs"> & {
  readonly rule: string;
};

/**
 * Builds one runtime-frozen dual-compatibility fixture manifest entry.
 *
 * @param fixture - Fixture metadata without its derived repository path.
 * @returns Frozen fixture metadata with its repository-relative path.
 */
export const dualCompatFixture = (fixture: DualCompatFixtureInput): DualCompatFixtureSnapshot => {
  assertFixtureStatusMatchesDiagnostics(fixture);

  return deepFreezeFixtureManifest({
    ...fixture,
    fixturePath: `${DUAL_COMPAT_FIXTURE_ROOT}/${fixture.family}/${fixture.fileName}`,
    expectedDiagnostics: [...fixture.expectedDiagnostics],
  });
};

/** Guards manifest entries from claiming clean parity while carrying warnings. */
const assertFixtureStatusMatchesDiagnostics = (fixture: DualCompatFixtureInput): void => {
  const hasWarnings = fixture.expectedDiagnostics.some(
    (diagnosticFixture) => diagnosticFixture.severity === "warning",
  );

  if (fixture.expectedStatus === "no-error" && hasWarnings) {
    throw new Error(
      `Dual-compatibility fixture ${fixture.family}/${fixture.fileName} ` +
        "declares no-error status but carries warning diagnostics.",
    );
  }
  if (fixture.expectedStatus === "warning" && !hasWarnings) {
    throw new Error(
      `Dual-compatibility fixture ${fixture.family}/${fixture.fileName} ` +
        "declares warning status without warning diagnostics.",
    );
  }
};

/** Finds the catalogue definition for a fixture diagnostic rule. */
const ruleDefinitionForDiagnostic = (rule: RuleId): RuleDefinition => {
  const matchingRule = findRuleDefinition(rule);

  if (matchingRule === undefined) {
    throw new Error(`Fixture diagnostic references uncatalogued rule ${String(rule)}.`);
  }

  return matchingRule;
};

/**
 * Creates one expected diagnostic with a validated rule identifier.
 *
 * @param diagnosticFixture - Diagnostic metadata before rule branding.
 * @returns Frozen diagnostic metadata with a branded rule identifier.
 */
export const diagnostic = (
  diagnosticFixture: DualCompatFixtureDiagnosticInput,
): DualCompatFixtureDiagnostic => {
  const rule = makeRuleId(diagnosticFixture.rule);
  const ruleDefinition = ruleDefinitionForDiagnostic(rule);
  const span = deepFreezeFixtureManifest({
    start: { ...diagnosticFixture.span.start },
    end: { ...diagnosticFixture.span.end },
  });

  return deepFreezeFixtureManifest({
    ...diagnosticFixture,
    rule,
    docs: ruleDocsPath(ruleDefinition),
    span,
  });
};
