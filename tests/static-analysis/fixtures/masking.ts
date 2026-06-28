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
    fileName: "crlf-decoy.js",
    context: "string",
    metaName: "masking-crlf-decoy",
    sha256: "f078a155ded8fcc6418b4dd35b16509477adda3c5483d8e95d439819b9329a0b",
  }),
  maskingFixture({
    fileName: "escaped-regex-delimiter-decoy.js",
    context: "regex",
    metaName: "masking-escaped-regex-delimiter-decoy",
    sha256: "9b953d62e0139e30ea7406b72e5e0c678f7e8351b80699810ca37ff8f2cdb90a",
  }),
  maskingFixture({
    fileName: "escaped-string-delimiter-decoy.js",
    context: "string",
    metaName: "masking-escaped-string-delimiter-decoy",
    sha256: "2bab011fbb157d466e48dc59e637eb22356614fafe995f26db1c842e5e25ed8b",
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
    fileName: "template-interpolation-boundary-decoy.js",
    context: "template",
    metaName: "masking-template-interpolation-boundary-decoy",
    sha256: "db3bb521320e43c35674ea35db9b5cf5adea5bcda73cbd9fd707e295ec8c05f8",
  }),
  maskingFixture({
    fileName: "template-literal-decoy.js",
    context: "template",
    metaName: "masking-template-decoy",
    sha256: "96d544cd089b2297bb91e3dc2b7d37790d81c0ae13244c12c455aab1ef11422c",
  }),
  maskingFixture({
    fileName: "unicode-decoy.js",
    context: "string",
    metaName: "masking-unicode-decoy",
    sha256: "69f4b97de92bd1cfc1a0a978b494ba60e9bced08a34d68390cb8b027299f72e0",
  }),
]) satisfies readonly MaskingFixtureSnapshot[];
