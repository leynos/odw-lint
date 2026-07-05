/**
 * @file Read-only dual-compatibility ODW workflow fixture manifest.
 *
 * The copied JavaScript files are passive static-analysis inputs. Keep this
 * manifest in family order so each dual-compatibility surface remains
 * reviewable.
 */

import type { DualCompatFixtureSnapshot } from "./dual-compat/manifest-types";
import { diagnostic, dualCompatFixture } from "./dual-compat/manifest-types";
import { deepFreezeFixtureManifest } from "./manifest-freeze";

export type {
  DualCompatFixtureDiagnostic,
  DualCompatFixtureFamily,
  DualCompatFixtureSnapshot,
  DualCompatFixtureStatus,
} from "./dual-compat/manifest-types";

/**
 * Read-only manifest for dual-compatibility ODW workflow snapshots.
 */
export const DUAL_COMPAT_FIXTURE_SNAPSHOTS = deepFreezeFixtureManifest([
  dualCompatFixture({
    family: "pure-metadata",
    fileName: "simple-agent.js",
    sha256: "72ce1ee32ddc638b3bcff9282b1b0ac9ef7bcc9f2e8f26b57db96d9da762e1c2",
    expectedStatus: "no-error",
    expectedDiagnostics: [],
  }),
  dualCompatFixture({
    family: "pure-metadata",
    fileName: "string-decoy.js",
    sha256: "2c710fe0430341b56a7c866189a179dff7c7b0de9d8e547d3d8e480f0ad7a3b3",
    expectedStatus: "no-error",
    expectedDiagnostics: [],
  }),
  dualCompatFixture({
    family: "deterministic-time",
    fileName: "date-now.js",
    sha256: "5388a5c09bcb1e4dea2ca481bd62f4a1930501d6ca5711e100872d514253905b",
    expectedStatus: "warning",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/no-date-now",
        severity: "warning",
        message:
          "Workflow calls Date.now(), which Claude Code rejects because it breaks deterministic run resumption.",
        span: {
          start: { offset: 235, line: 10, column: 19 },
          end: { offset: 243, line: 10, column: 27 },
        },
        spanText: "Date.now",
      }),
    ],
  }),
  dualCompatFixture({
    family: "deterministic-time",
    fileName: "math-random.js",
    sha256: "fd02d009c5d874894a1c01f25dfcd9927c98d18218c84a4062a01f88fd8aa330",
    expectedStatus: "warning",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/no-math-random",
        severity: "warning",
        message:
          "Workflow calls Math.random(), which Claude Code rejects because it breaks deterministic run resumption.",
        span: {
          start: { offset: 239, line: 10, column: 16 },
          end: { offset: 250, line: 10, column: 27 },
        },
        spanText: "Math.random",
      }),
    ],
  }),
  dualCompatFixture({
    family: "deterministic-time",
    fileName: "new-date.js",
    sha256: "6f986c3c0c27d7320a25d31d5625439c71ef0b4a10391895e04386b159a91ff4",
    expectedStatus: "warning",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/no-argless-new-date",
        severity: "warning",
        message:
          "Workflow constructs new Date() without arguments, which Claude Code rejects because it breaks deterministic run resumption.",
        span: {
          start: { offset: 247, line: 10, column: 17 },
          end: { offset: 257, line: 10, column: 27 },
        },
        spanText: "new Date()",
      }),
    ],
  }),
  dualCompatFixture({
    family: "deterministic-time",
    fileName: "masked-text.js",
    sha256: "926691a3f1534e8dc9321bb3572bf0dce6ddb0ed83e63a3146fcce887c63a260",
    expectedStatus: "no-error",
    expectedDiagnostics: [],
  }),
]) satisfies readonly DualCompatFixtureSnapshot[];
