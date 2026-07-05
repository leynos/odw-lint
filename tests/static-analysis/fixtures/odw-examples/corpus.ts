/**
 * @file Shared ODW example workflow fixture corpus helpers.
 *
 * This module owns the test-only location and lookup contract for trusted ODW
 * example workflow fixtures. Static-analysis tests may read these fixtures as
 * passive text; they must not import, evaluate, execute, or format the copied
 * JavaScript files.
 */

import type { FixtureCorpusLocation } from "../corpus-support";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS, type OdwExampleFixtureSnapshot } from "../odw-examples";

/**
 * Location metadata for the trusted ODW example workflow fixture corpus.
 */
export const ODW_EXAMPLE_FIXTURE_CORPUS = Object.freeze({
  fixtureDirectory: new URL("./", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/odw-examples/",
}) satisfies FixtureCorpusLocation;

/**
 * Repository-relative upstream root used when deriving copied example paths.
 */
export const ODW_EXAMPLE_UPSTREAM_ROOT = "open-dynamic-workflows/examples";

/**
 * Finds one ODW example fixture snapshot by copied JavaScript basename.
 *
 * @param query - Copied JavaScript basename to locate.
 * @returns The matching ODW example fixture snapshot.
 * @throws Error when no fixture exists for the requested file name.
 */
export const findOdwExampleFixture = (query: {
  readonly fileName: string;
}): OdwExampleFixtureSnapshot => {
  const fixture = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.find(
    (candidate) => candidate.fileName === query.fileName,
  );
  if (fixture === undefined) {
    throw new Error(`Missing ODW example fixture ${query.fileName}.`);
  }

  return fixture;
};
