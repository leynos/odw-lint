/**
 * @file Shared synthetic masking fixture corpus helpers.
 *
 * This module owns the test-only location contract for synthetic masking
 * workflow fixtures. Static-analysis tests may read these fixtures as passive
 * text; they must not import, evaluate, execute, or format the raw JavaScript
 * files.
 */

import type { FixtureCorpusLocation } from "../corpus-support";
import { MASKING_FIXTURE_ROOT } from "../masking";

/**
 * Location metadata for the synthetic masking workflow fixture corpus.
 */
export const MASKING_FIXTURE_CORPUS = Object.freeze({
  fixtureDirectory: new URL("./", import.meta.url),
  manifestRoot: `${MASKING_FIXTURE_ROOT}/`,
}) satisfies FixtureCorpusLocation;
