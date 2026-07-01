/**
 * @file Deterministic static-analysis fixture metadata refresh helpers.
 *
 * This module reads workflow fixtures as UTF-8 source text only. It must stay
 * import-safe because hostile metadata fixtures are designed to reveal any
 * accidental evaluation path.
 */

import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SourceSpan } from "odw-lint";
import { normalizeDirectoryUrl } from "./refresh-targets";
import { refreshFixtureFiles } from "./refresh-writers";

export {
  deriveAnchoredDiagnosticSpan,
  deriveSha256,
  FixtureRefreshError,
} from "./refresh-derivation";
export { normalizeDirectoryUrl } from "./refresh-targets";

export type FixtureRefreshMode = "dry-run" | "write";
export type FixtureRefreshFailureCode =
  | "invalid-arguments"
  | "missing-odw-reference-checkout"
  | "missing-upstream-example"
  | "missing-fixture-source"
  | "missing-anchor"
  | "duplicate-anchor"
  | "manifest-write-failed"
  | "unexpected-error";
export interface FixtureRefreshFailure {
  readonly code: FixtureRefreshFailureCode;
  readonly message: string;
  readonly path: string | null;
  readonly rule: string | null;
  readonly anchor: string | null;
  readonly occurrenceCount: number | null;
  readonly remediation: string;
}
export interface FixtureRefreshCounts {
  readonly odwExamples: number;
  readonly masking: number;
  readonly invalidWorkflows: number;
  readonly hostileMetadata: number;
  readonly invalidDiagnostics: number;
  readonly totalFixtures: number;
}
export interface FixtureRefreshReport {
  readonly mode: FixtureRefreshMode;
  readonly repositoryRoot: string;
  readonly odwReferenceCheckout: string;
  readonly counts: FixtureRefreshCounts;
  readonly managedPaths: readonly string[];
  readonly wouldWritePaths: readonly string[];
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
  readonly extraUpstreamExamples: readonly string[];
  readonly failures: readonly FixtureRefreshFailure[];
}
export interface DiagnosticSpanAnchor {
  readonly fixturePath: string;
  readonly rule: string;
  readonly spanText: string;
  readonly fallbackByteOffset: number;
}
export interface RefreshedDiagnosticSpan {
  readonly span: SourceSpan;
  readonly spanText: string;
}
export interface FixtureRefreshOptions {
  readonly repositoryRoot: URL;
  readonly odwReferenceCheckout: URL;
  readonly shouldWrite: boolean;
}

/**
 * Repository-relative TypeScript manifest paths owned by fixture refresh.
 */
export const MANIFEST_PATHS = [
  "tests/static-analysis/fixtures/odw-examples.ts",
  "tests/static-analysis/fixtures/masking.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/malformed-metadata.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/missing-metadata.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/unsupported-import-export.ts",
] as const;

/**
 * Resolves the default sibling ODW checkout for a repository root.
 *
 * @param repositoryRoot - Repository root directory URL.
 * @returns Directory URL for the default ODW reference checkout.
 */
export const defaultOdwReferenceCheckout = (repositoryRoot: URL): URL => {
  const normalizedRepositoryRoot = normalizeDirectoryUrl(repositoryRoot);
  const siblingPath = normalizedRepositoryRoot.pathname.includes(".worktrees/")
    ? "../../open-dynamic-workflows/"
    : "../open-dynamic-workflows/";

  return new URL(siblingPath, normalizedRepositoryRoot);
};

/**
 * Resolves the effective ODW reference checkout from configuration.
 *
 * @param repositoryRoot - Repository root directory URL.
 * @param overridePath - Optional filesystem path from `ODW_REFERENCE_CHECKOUT`.
 * @returns Directory URL for the effective ODW reference checkout.
 */
export const resolveOdwReferenceCheckout = (
  repositoryRoot: URL,
  overridePath: string | undefined,
): URL => {
  if (overridePath === undefined || overridePath.length === 0) {
    return defaultOdwReferenceCheckout(repositoryRoot);
  }

  const normalizedRootPath = fileURLToPath(normalizeDirectoryUrl(repositoryRoot));
  return normalizeDirectoryUrl(pathToFileURL(resolve(normalizedRootPath, overridePath)));
};

/**
 * Refreshes fixture metadata and returns the maintainer report shape.
 *
 * @param options - Repository, reference checkout, and write-mode settings.
 * @returns Refresh report describing managed paths, counts, and failures.
 */
export const refreshFixtureMetadata = (options: FixtureRefreshOptions): FixtureRefreshReport => {
  return refreshFixtureFiles(options);
};

if (import.meta.main) {
  const repositoryRoot = pathToFileURL(resolve(process.cwd(), "."));
  const { ODW_REFERENCE_CHECKOUT: odwReferenceCheckoutOverride } = process.env;
  const invalidArguments = process.argv.slice(2).filter((argument) => argument !== "--dry-run");
  const report =
    invalidArguments.length === 0
      ? refreshFixtureMetadata({
          repositoryRoot,
          odwReferenceCheckout: resolveOdwReferenceCheckout(
            repositoryRoot,
            odwReferenceCheckoutOverride,
          ),
          shouldWrite: !process.argv.includes("--dry-run"),
        })
      : invalidArgumentReport(repositoryRoot, invalidArguments);
  const output = `${JSON.stringify(report, null, 2)}\n`;

  if (report.failures.length === 0) {
    process.stdout.write(output);
    process.exit(0);
  }

  process.stderr.write(output);
  process.exit(1);
}

/**
 * Builds the CLI failure report for unsupported arguments.
 */
function invalidArgumentReport(
  repositoryRoot: URL,
  invalidArguments: readonly string[],
): FixtureRefreshReport {
  return {
    mode: "dry-run",
    repositoryRoot: fileURLToPath(normalizeDirectoryUrl(repositoryRoot)),
    odwReferenceCheckout: fileURLToPath(defaultOdwReferenceCheckout(repositoryRoot)),
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
    failures: [
      {
        code: "invalid-arguments",
        message: `Unsupported fixture refresh arguments: ${invalidArguments.join(", ")}`,
        path: null,
        rule: null,
        anchor: null,
        occurrenceCount: null,
        remediation:
          "Run without arguments for write mode or pass --dry-run for a non-mutating report.",
      },
    ],
  };
}
