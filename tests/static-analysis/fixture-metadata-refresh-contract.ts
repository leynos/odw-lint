/**
 * @file Compile-time contracts for fixture metadata refresh exports.
 */

import type {
  DiagnosticSpanAnchor,
  FixtureRefreshFailure,
  FixtureRefreshFailureCode,
  FixtureRefreshOptions,
  FixtureRefreshReport,
} from "./fixtures/refresh-metadata";
import { FixtureRefreshError } from "./fixtures/refresh-metadata";

if (import.meta.url === "") {
  // This branch is never executed; it only makes `tsc` enforce the exported
  // refresh metadata API contract used by tests and maintainer tooling.
  const failureCode = "missing-anchor" satisfies FixtureRefreshFailureCode;
  const failure = {
    code: failureCode,
    message: "fixtures/example.js diagnostic anchor is missing.",
    path: "fixtures/example.js",
    rule: "odw/meta-name",
    anchor: "name",
    occurrenceCount: 0,
    remediation: "Update the manifest spanText anchor.",
  } satisfies FixtureRefreshFailure;
  const options = {
    repositoryRoot: new URL("file:///tmp/project/"),
    odwReferenceCheckout: new URL("file:///tmp/open-dynamic-workflows/"),
    shouldWrite: false,
  } satisfies FixtureRefreshOptions;
  const report = {
    mode: "dry-run",
    repositoryRoot: "/tmp/project",
    odwReferenceCheckout: "/tmp/open-dynamic-workflows",
    counts: {
      odwExamples: 0,
      masking: 0,
      invalidWorkflows: 0,
      hostileMetadata: 0,
      invalidDiagnostics: 0,
      totalFixtures: 0,
    },
    managedPaths: [],
    wouldWritePaths: [],
    writtenPaths: [],
    unchangedPaths: [],
    extraUpstreamExamples: [],
    failures: [failure],
  } satisfies FixtureRefreshReport;
  const anchor = {
    fixturePath: "fixtures/example.js",
    rule: "odw/meta-name",
    spanText: "",
    fallbackByteOffset: 0,
  } satisfies DiagnosticSpanAnchor;
  const error = new FixtureRefreshError(failure);

  report.failures satisfies readonly FixtureRefreshFailure[];
  error.failure satisfies FixtureRefreshFailure;
  options.shouldWrite satisfies boolean;
  anchor.fallbackByteOffset satisfies number;

  // @ts-expect-error Failure codes must come from the reviewed report contract.
  const invalidFailureCode: FixtureRefreshFailureCode = "missing-fixture";

  const invalidAnchor = {
    fixturePath: "fixtures/example.js",
    rule: "odw/meta-name",
    spanText: "",
    // @ts-expect-error Empty-anchor fallbacks must be named as UTF-8 byte offsets.
    fallbackOffset: 0,
  } satisfies DiagnosticSpanAnchor;

  // @ts-expect-error Reports must include the full path ownership lists.
  const incompleteReport = { ...report, managedPaths: undefined } satisfies FixtureRefreshReport;

  [invalidFailureCode, invalidAnchor, incompleteReport];
}
