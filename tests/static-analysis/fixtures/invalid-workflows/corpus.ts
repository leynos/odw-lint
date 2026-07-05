/**
 * @file Shared invalid workflow fixture corpus helpers.
 *
 * This module owns the test-only location and lookup contract for deliberately
 * invalid workflow fixtures. Static-analysis tests may read these fixtures as
 * passive text; they must not import, evaluate, execute, or format the raw
 * JavaScript files.
 */

import { type FixtureCorpusLocation, findFixtureSnapshot } from "../corpus-support";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "../invalid-workflows";
import type {
  InvalidWorkflowFixtureFamily,
  InvalidWorkflowFixtureSnapshot,
} from "./manifest-types";

/**
 * Location metadata for the deliberately invalid workflow fixture corpus.
 */
export const INVALID_WORKFLOW_FIXTURE_CORPUS = Object.freeze({
  fixtureDirectory: new URL("./", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/",
  recursive: true,
}) satisfies FixtureCorpusLocation;

/**
 * Finds one invalid workflow fixture snapshot by family and file name.
 *
 * @param query - Fixture family and copied JavaScript basename to locate.
 * @returns The matching invalid workflow fixture snapshot.
 * @throws Error when no fixture exists for the requested family and file name.
 */
export const findInvalidWorkflowFixture = (query: {
  readonly family: InvalidWorkflowFixtureFamily;
  readonly fileName: string;
}): InvalidWorkflowFixtureSnapshot => {
  return findFixtureSnapshot(
    INVALID_WORKFLOW_FIXTURE_SNAPSHOTS,
    `invalid workflow fixture ${query.family}/${query.fileName}`,
    (candidate) => candidate.family === query.family && candidate.fileName === query.fileName,
  );
};
