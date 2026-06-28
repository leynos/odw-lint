/**
 * @file Read-only invalid ODW workflow fixture manifest.
 *
 * The copied JavaScript files are deliberately invalid static-analysis inputs.
 * Keep this manifest in sync with their exact byte content when extending the
 * invalid workflow fixture corpus.
 */

import type { DiagnosticSeverity, RuleId, SourceSpan } from "odw-lint";
import { makeRuleId } from "odw-lint";

/**
 * Supported deliberately invalid workflow fixture families.
 */
export type InvalidWorkflowFixtureFamily =
  | "missing-metadata"
  | "malformed-metadata"
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

/** Builds one runtime-frozen invalid workflow fixture manifest entry. */
const invalidWorkflowFixture = (
  fixture: InvalidWorkflowFixtureInput,
): InvalidWorkflowFixtureSnapshot => {
  return Object.freeze({
    ...fixture,
    fixturePath: `${INVALID_WORKFLOW_FIXTURE_ROOT}/${fixture.family}/${fixture.fileName}`,
    expectedDiagnostics: Object.freeze([...fixture.expectedDiagnostics]),
  });
};

/** Creates one expected diagnostic with a validated rule identifier. */
const diagnostic = (
  diagnosticFixture: Omit<InvalidWorkflowFixtureDiagnostic, "rule"> & { readonly rule: string },
): InvalidWorkflowFixtureDiagnostic => {
  const span = Object.freeze({
    start: Object.freeze({ ...diagnosticFixture.span.start }),
    end: Object.freeze({ ...diagnosticFixture.span.end }),
  });

  return Object.freeze({
    ...diagnosticFixture,
    rule: makeRuleId(diagnosticFixture.rule),
    span,
  });
};

/**
 * Read-only manifest for deliberately invalid ODW workflow snapshots.
 */
export const INVALID_WORKFLOW_FIXTURE_SNAPSHOTS = Object.freeze([
  invalidWorkflowFixture({
    family: "missing-metadata",
    fileName: "missing-meta-description.js",
    sha256: "5b2d3ab7c9f7ccb6d91accc13eee1303d1dea390fde3f72598f15ec607343333",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-description",
        severity: "error",
        message: "Workflow metadata must include a non-empty description string.",
        span: {
          start: { offset: 20, line: 1, column: 21 },
          end: { offset: 89, line: 4, column: 2 },
        },
        spanText: '{\n  name: "missing-meta-description",\n  phases: [{ title: "Run" }],\n}',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "missing-metadata",
    fileName: "missing-meta-name.js",
    sha256: "0ce388e912b835bf07cd4ef9fddd48a58b2c0a0cd6fbfd87edd9646d7528469b",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-name",
        severity: "error",
        message: "Workflow metadata must include a non-empty name string.",
        span: {
          start: { offset: 20, line: 1, column: 21 },
          end: { offset: 93, line: 4, column: 2 },
        },
        spanText: '{\n  description: "Missing name fixture.",\n  phases: [{ title: "Run" }],\n}',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "missing-metadata",
    fileName: "missing-meta.js",
    sha256: "c008d2f17ab20b56aff47bbfb7612c1dc050956b00430eb08439c05ba4a3e95b",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-required",
        severity: "error",
        message: "Workflow source must export literal metadata.",
        span: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 0, line: 1, column: 1 },
        },
        spanText: "",
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "malformed-metadata",
    fileName: "computed-meta-expression.js",
    sha256: "a077ff352989bf8eca65b1f66a05c0a4fdcde4e139fd26eccf5c5b03f45a27b1",
    expectedStatus: "warning",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-statically-unprovable",
        severity: "warning",
        message: "Workflow metadata must remain statically provable without evaluation.",
        span: {
          start: { offset: 73, line: 3, column: 16 },
          end: { offset: 101, line: 3, column: 44 },
        },
        spanText: '"Computed " + "description."',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "malformed-metadata",
    fileName: "empty-meta-name.js",
    sha256: "4744707683b7e020481b4b62a87a8b2d1878284867c83e0c67546f424773599d",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-name",
        severity: "error",
        message: "Workflow metadata must include a non-empty name string.",
        span: {
          start: { offset: 30, line: 2, column: 9 },
          end: { offset: 32, line: 2, column: 11 },
        },
        spanText: '""',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "malformed-metadata",
    fileName: "meta-not-object.js",
    sha256: "69fa50cd694336f1eb0eaa6f780eeebabb844ca3d128e2958fb1b240803600fa",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-object",
        severity: "error",
        message: "Workflow metadata must be an object literal.",
        span: {
          start: { offset: 20, line: 1, column: 21 },
          end: { offset: 35, line: 1, column: 36 },
        },
        spanText: '"not an object"',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "malformed-metadata",
    fileName: "numeric-meta-description.js",
    sha256: "2920db7ba1100f7644eb24ae1f9af01fedb3e2d5495a4edf822dd4979765c625",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-description",
        severity: "error",
        message: "Workflow metadata description must be a string.",
        span: {
          start: { offset: 73, line: 3, column: 16 },
          end: { offset: 76, line: 3, column: 19 },
        },
        spanText: "123",
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "malformed-metadata",
    fileName: "unterminated-meta-object.js",
    sha256: "a556fa833e54569262f35f123ff94dc0b62ffd7a12fae135c7e2910a0cb49c5c",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-object",
        severity: "error",
        message: "Workflow metadata object literal must be complete.",
        span: {
          start: { offset: 20, line: 1, column: 21 },
          end: { offset: 137, line: 5, column: 1 },
        },
        spanText:
          '{\n  name: "unterminated-meta-object",\n  description: "Unterminated metadata fixture.",\n  phases: [{ title: "Run" }],\n',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "unsupported-import-export",
    fileName: "extra-export-const.js",
    sha256: "0a04febd19906db4d1156374ff6a772531e8ee7987474ead9daec76f3d5eab54",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/no-import-export",
        severity: "error",
        message: "Workflow body must not add top-level imports or exports.",
        span: {
          start: { offset: 126, line: 7, column: 1 },
          end: { offset: 162, line: 7, column: 37 },
        },
        spanText: 'export const helper = "unsupported";',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "unsupported-import-export",
    fileName: "top-level-import.js",
    sha256: "166feaeb6d91006e31e6c3fb93786b9d2ab2948504fb88d33cc6bac74b2b4a03",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/no-import-export",
        severity: "error",
        message: "Workflow body must not add top-level imports or exports.",
        span: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 37, line: 1, column: 38 },
        },
        spanText: 'import { helper } from "./helper.js";',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "syntax-error",
    fileName: "body-unclosed-block.js",
    sha256: "ce51953f1fd6dad5034ca5fe1c81b2b1b062366f10e1d18454a67610c706064b",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/body-syntax",
        severity: "error",
        message: "Workflow body must be syntactically complete after ODW normalization.",
        span: {
          start: { offset: 145, line: 7, column: 17 },
          end: { offset: 179, line: 9, column: 1 },
        },
        spanText: '{\n  await agent("Draft status.");\n',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "syntax-error",
    fileName: "body-unclosed-call.js",
    sha256: "4890d45d55504f7af77bd1ab4a6b9ec6f67e8e53458a8643185d3e4f7073595c",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/body-syntax",
        severity: "error",
        message: "Workflow body must be syntactically complete after ODW normalization.",
        span: {
          start: { offset: 133, line: 7, column: 7 },
          end: { offset: 147, line: 8, column: 1 },
        },
        spanText: 'agent("draft"\n',
      }),
    ],
  }),
]) satisfies readonly InvalidWorkflowFixtureSnapshot[];
