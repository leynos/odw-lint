/**
 * @file Read-only invalid ODW workflow fixture manifest.
 *
 * The copied JavaScript files are deliberately invalid static-analysis inputs.
 * Keep this aggregate in family order so corpus tests retain a stable contract
 * while each family remains reviewable in its own module.
 */

import type { InvalidWorkflowFixtureSnapshot } from "./invalid-workflows/manifest-types";
import { HOSTILE_METADATA_FIXTURES } from "./invalid-workflows/manifests/hostile-metadata";
import { MALFORMED_METADATA_FIXTURES } from "./invalid-workflows/manifests/malformed-metadata";
import { MISSING_METADATA_FIXTURES } from "./invalid-workflows/manifests/missing-metadata";
import { SYNTAX_ERROR_FIXTURES } from "./invalid-workflows/manifests/syntax-error";
import { UNSUPPORTED_IMPORT_EXPORT_FIXTURES } from "./invalid-workflows/manifests/unsupported-import-export";
import { deepFreezeFixtureManifest } from "./manifest-freeze";

export type {
  InvalidWorkflowFixtureDiagnostic,
  InvalidWorkflowFixtureFamily,
  InvalidWorkflowFixtureSnapshot,
  InvalidWorkflowFixtureStatus,
} from "./invalid-workflows/manifest-types";

/**
 * Read-only manifest for deliberately invalid ODW workflow snapshots.
 */
export const INVALID_WORKFLOW_FIXTURE_SNAPSHOTS = deepFreezeFixtureManifest([
  ...MISSING_METADATA_FIXTURES,
  ...MALFORMED_METADATA_FIXTURES,
  ...HOSTILE_METADATA_FIXTURES,
  ...UNSUPPORTED_IMPORT_EXPORT_FIXTURES,
  ...SYNTAX_ERROR_FIXTURES,
]) satisfies readonly InvalidWorkflowFixtureSnapshot[];
