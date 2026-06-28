/**
 * @file Synthetic masking workflow fixture manifest.
 *
 * These fixtures are owned by odw-lint and exercise inert workflow syntax in
 * source regions that the future envelope scanner must ignore.
 */

import { deepFreezeFixtureManifest } from "./manifest-freeze";

/**
 * Non-code source context containing decoy workflow syntax.
 */
export type MaskingFixtureContext = "comment" | "regex" | "string" | "template";

/**
 * Expected lint status for synthetic masking fixture snapshots.
 */
export type MaskingFixtureExpectedStatus = "no-envelope-diagnostics";

/**
 * Immutable metadata for one synthetic masking workflow fixture.
 */
export interface MaskingFixtureSnapshot {
  /**
   * Basename of the synthetic fixture file.
   */
  readonly fileName: string;

  /**
   * Repository-relative path to the synthetic fixture file.
   */
  readonly fixturePath: string;

  /**
   * Non-code source context exercised by the fixture.
   */
  readonly context: MaskingFixtureContext;

  /**
   * Workflow metadata name declared by the real metadata export.
   */
  readonly metaName: string;

  /**
   * SHA-256 digest of the synthetic fixture source text.
   */
  readonly sha256: string;

  /**
   * Expected diagnostics status for this roadmap slice.
   */
  readonly expectedStatus: MaskingFixtureExpectedStatus;

  /**
   * Expected envelope diagnostics for this roadmap slice.
   */
  readonly expectedDiagnostics: readonly [];
}

export const MASKING_FIXTURE_ROOT = "tests/static-analysis/fixtures/masking";
export const EXPECTED_NO_ENVELOPE_DIAGNOSTICS = deepFreezeFixtureManifest([]) satisfies readonly [];

type MaskingFixtureInput = Omit<
  MaskingFixtureSnapshot,
  "fixturePath" | "expectedStatus" | "expectedDiagnostics"
>;

/** Builds one runtime-frozen synthetic masking fixture manifest entry. */
const maskingFixture = (fixture: MaskingFixtureInput): MaskingFixtureSnapshot => {
  return deepFreezeFixtureManifest({
    ...fixture,
    fixturePath: `${MASKING_FIXTURE_ROOT}/${fixture.fileName}`,
    expectedStatus: "no-envelope-diagnostics",
    expectedDiagnostics: EXPECTED_NO_ENVELOPE_DIAGNOSTICS,
  });
};

/**
 * Synthetic workflow source snapshots for future envelope masking tests.
 */
export const MASKING_FIXTURE_SNAPSHOTS = deepFreezeFixtureManifest([
  maskingFixture({
    fileName: "comment-decoy.js",
    context: "comment",
    metaName: "masking-comment-decoy",
    sha256: "feaa72be7ff8e679e2470ad17b7f4939ce57b41d5036979f91e8f1b9193763bc",
  }),
  maskingFixture({
    fileName: "regex-decoy.js",
    context: "regex",
    metaName: "masking-regex-decoy",
    sha256: "10da7cff94588e9afb9a487e70c3d62c3d89ab20bd13bcf1443a6b2a15b98df3",
  }),
  maskingFixture({
    fileName: "string-decoy.js",
    context: "string",
    metaName: "masking-string-decoy",
    sha256: "9954bd113cffad1176c91edf9d70e6338257fd2b6742e2b54644d31f01616c2e",
  }),
  maskingFixture({
    fileName: "template-literal-decoy.js",
    context: "template",
    metaName: "masking-template-decoy",
    sha256: "96d544cd089b2297bb91e3dc2b7d37790d81c0ae13244c12c455aab1ef11422c",
  }),
]) satisfies readonly MaskingFixtureSnapshot[];
