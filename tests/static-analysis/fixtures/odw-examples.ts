/**
 * @file Read-only ODW example workflow fixture manifest.
 *
 * The copied JavaScript files are static snapshots of upstream ODW examples.
 * Keep this manifest in sync with their exact byte content when refreshing the
 * fixture corpus from the trusted ODW checkout.
 */

import { deepFreezeFixtureManifest } from "./manifest-freeze";

/**
 * Expected lint status for imported ODW example workflow snapshots.
 */
export type OdwExampleFixtureStatus = "no-error";

/**
 * Immutable metadata for one copied ODW example workflow snapshot.
 */
export interface OdwExampleFixtureSnapshot {
  /**
   * Basename of the copied fixture file.
   */
  readonly fileName: string;

  /**
   * Repository-relative path to the copied fixture file.
   */
  readonly fixturePath: string;

  /**
   * Reference path in the upstream ODW checkout.
   */
  readonly upstreamPath: string;

  /**
   * Workflow metadata name observed in the trusted upstream example.
   */
  readonly metaName: string;

  /**
   * SHA-256 digest of the copied fixture source text.
   */
  readonly sha256: string;

  /**
   * Expected diagnostics status for this roadmap slice.
   */
  readonly expectedStatus: OdwExampleFixtureStatus;

  /**
   * Expected diagnostics for this roadmap slice.
   */
  readonly expectedDiagnostics: readonly [];
}

const ODW_EXAMPLES_FIXTURE_ROOT = "tests/static-analysis/fixtures/odw-examples";
const UPSTREAM_ODW_EXAMPLES_ROOT = "open-dynamic-workflows/examples";
const EXPECTED_NO_DIAGNOSTICS = deepFreezeFixtureManifest([]) satisfies readonly [];

type OdwExampleFixtureInput = Omit<
  OdwExampleFixtureSnapshot,
  "fixturePath" | "upstreamPath" | "expectedStatus" | "expectedDiagnostics"
>;

/** Builds one runtime-frozen ODW example fixture manifest entry. */
const odwExampleFixture = (fixture: OdwExampleFixtureInput): OdwExampleFixtureSnapshot => {
  return deepFreezeFixtureManifest({
    ...fixture,
    fixturePath: `${ODW_EXAMPLES_FIXTURE_ROOT}/${fixture.fileName}`,
    upstreamPath: `${UPSTREAM_ODW_EXAMPLES_ROOT}/${fixture.fileName}`,
    expectedStatus: "no-error",
    expectedDiagnostics: EXPECTED_NO_DIAGNOSTICS,
  });
};

/**
 * Read-only manifest for the imported ODW example workflow snapshots.
 */
export const ODW_EXAMPLE_FIXTURE_SNAPSHOTS = deepFreezeFixtureManifest([
  odwExampleFixture({
    fileName: "adversarial-verify.js",
    metaName: "adversarial-verify",
    sha256: "8e00d852e9a621b23a7617b4d4dd4e65de67b27a668e553d925385c923e48fd2",
  }),
  odwExampleFixture({
    fileName: "agent-daily-digest.js",
    metaName: "agent-daily-digest",
    sha256: "0cd3fad023f1f6f68cfd670e93addd550386b40848008d18fa724ed556e9f24e",
  }),
  odwExampleFixture({
    fileName: "codex-claude-loop.js",
    metaName: "codex-claude-loop",
    sha256: "37b6d0b26803d5ab27b650e318b587b60ef49f0b6276923b15763f39e2f026de",
  }),
  odwExampleFixture({
    fileName: "deep-research.js",
    metaName: "deep-research",
    sha256: "c703b2d7708e66136b38556171be799eca121a241343819a6654d1eae865ff84",
  }),
  odwExampleFixture({
    fileName: "fan-out-reduce.js",
    metaName: "fan-out-reduce",
    sha256: "81d8fc5a87d19297afa2c3b72b469562d980b966090b1aafcd76ca39af732fa3",
  }),
  odwExampleFixture({
    fileName: "generate-and-filter.js",
    metaName: "generate-and-filter",
    sha256: "2ee526156d10b4622eec4563baa08ad71904621c97e457ef666997145ee6e5c9",
  }),
  odwExampleFixture({
    fileName: "loop-until-dry.js",
    metaName: "loop-until-dry",
    sha256: "8e856df8d09521ed1810e41e7873ca583a7472b15e0067bacff80dd94a269238",
  }),
  odwExampleFixture({
    fileName: "routing.js",
    metaName: "routing",
    sha256: "0d595872da03aa7e1bfd91bb8da84ba5b1605d4f82f8b522e492d17343645f3c",
  }),
  odwExampleFixture({
    fileName: "tournament.js",
    metaName: "tournament",
    sha256: "6baa807e3bfbe991a83cc923fc6c5b31988f8099bd46091755c509b07f2c7b62",
  }),
]) satisfies readonly OdwExampleFixtureSnapshot[];
