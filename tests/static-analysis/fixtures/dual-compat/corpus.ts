/**
 * @file Shared dual-compatibility fixture corpus helpers.
 *
 * This module owns the test-only location and lookup contract for
 * dual-compatibility workflow fixtures. Static-analysis tests may read these
 * fixtures as passive text; they must not import, evaluate, execute, or format
 * the raw JavaScript files.
 */

import type { FixtureCorpusLocation } from "../corpus-support";
import { DUAL_COMPAT_FIXTURE_SNAPSHOTS } from "../dual-compat";
import {
  DUAL_COMPAT_FIXTURE_ROOT,
  type DualCompatFixtureFamily,
  type DualCompatFixtureSnapshot,
} from "./manifest-types";

/**
 * Location metadata for the dual-compatibility workflow fixture corpus.
 */
export const DUAL_COMPAT_FIXTURE_CORPUS = Object.freeze({
  fixtureDirectory: new URL("./", import.meta.url),
  manifestRoot: `${DUAL_COMPAT_FIXTURE_ROOT}/`,
  recursive: true,
}) satisfies FixtureCorpusLocation;

/**
 * Finds one dual-compatibility fixture snapshot by family and file name.
 *
 * @param query - Fixture family and copied JavaScript basename to locate.
 * @returns The matching dual-compatibility fixture snapshot.
 * @throws Error when no fixture exists for the requested family and file name.
 */
export const findDualCompatFixture = (query: {
  readonly family: DualCompatFixtureFamily;
  readonly fileName: string;
}): DualCompatFixtureSnapshot => {
  const fixture = DUAL_COMPAT_FIXTURE_SNAPSHOTS.find(
    (candidate) => candidate.family === query.family && candidate.fileName === query.fileName,
  );
  if (fixture === undefined) {
    throw new Error(`Missing dual-compatibility fixture ${query.family}/${query.fileName}.`);
  }

  return fixture;
};
