/**
 * @file Deterministic writers for static-analysis fixture metadata refresh.
 *
 * Raw workflow files are handled as bytes or UTF-8 source text only. Manifest
 * source generation lives in `refresh-manifest-source.ts`; this module owns
 * filesystem comparison, writes, and report assembly.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./invalid-workflows";
import { MASKING_FIXTURE_SNAPSHOTS } from "./masking";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./odw-examples";
import { type PlannedFixtureFile, plannedManifestFiles } from "./refresh-manifest-source";
import type {
  FixtureRefreshFailure,
  FixtureRefreshOptions,
  FixtureRefreshReport,
} from "./refresh-metadata";
import {
  filePathForUrl,
  invalidArgumentsFailure,
  managedTargetFailure,
  missingOdwReferenceCheckoutFailure,
  missingUpstreamExampleFailure,
  normalizeDirectoryUrl,
  safeStats,
} from "./refresh-targets";

/**
 * Builds a deterministic refresh report and optionally applies file writes.
 *
 * @param options - Repository, reference checkout and write-mode settings.
 * @returns Refresh report describing changed files and failures.
 */
export const refreshFixtureFiles = (options: FixtureRefreshOptions): FixtureRefreshReport => {
  const urlFailure = firstUrlFailure(options);
  if (urlFailure !== null) {
    return reportFromPlan(options, [], [], [urlFailure]);
  }

  const repositoryRoot = normalizeDirectoryUrl(options.repositoryRoot);
  const odwReferenceCheckout = normalizeDirectoryUrl(options.odwReferenceCheckout);
  const failure = firstBlockingFailure(odwReferenceCheckout);
  if (failure !== null) {
    return reportFromPlan(options, [], [], [failure]);
  }

  const plannedFiles = plannedRefreshFiles(repositoryRoot, odwReferenceCheckout);
  const managedTargetFailure = firstManagedTargetFailure(repositoryRoot, plannedFiles);
  if (managedTargetFailure !== null) {
    return reportFromPlan(options, plannedFiles, [], [managedTargetFailure], {
      shouldClassifyUnchanged: false,
    });
  }

  const extraUpstreamExamples = extraExampleFileNames(odwReferenceCheckout);
  const changedPaths = plannedFiles
    .filter((file) => !matchesCurrentSource(repositoryRoot, file))
    .map((file) => file.relativePath);
  const writtenPaths = options.shouldWrite ? writeChangedFiles(repositoryRoot, plannedFiles) : [];

  return reportFromPlan(options, plannedFiles, extraUpstreamExamples, [], {
    wouldWritePaths: options.shouldWrite ? [] : changedPaths,
    writtenPaths,
  });
};

/**
 * Returns structured failures for unsupported URL inputs.
 */
const firstUrlFailure = (options: FixtureRefreshOptions): FixtureRefreshFailure | null => {
  if (options.repositoryRoot.protocol !== "file:") {
    return invalidArgumentsFailure("repositoryRoot must be a file: directory URL.");
  }

  const repositoryRootFailure = repositoryRootFailureForUrl(options.repositoryRoot);
  if (repositoryRootFailure !== null) {
    return repositoryRootFailure;
  }

  if (options.odwReferenceCheckout.protocol !== "file:") {
    return invalidArgumentsFailure("odwReferenceCheckout must be a file: directory URL.");
  }

  return odwReferenceCheckoutFailureForUrl(options.odwReferenceCheckout);
};

/**
 * Validates repository root file URLs before filesystem refresh work.
 */
const repositoryRootFailureForUrl = (repositoryRoot: URL): FixtureRefreshFailure | null => {
  const repositoryRootPath = filePathForUrl(repositoryRoot);
  if (repositoryRootPath === null) {
    return invalidArgumentsFailure("repositoryRoot must be a valid file: directory URL.");
  }

  const repositoryRootStats = safeStats(repositoryRootPath);
  if (repositoryRootStats === null) {
    return invalidArgumentsFailure(`repositoryRoot does not exist: ${repositoryRootPath}`);
  }

  if (!repositoryRootStats.isDirectory()) {
    return invalidArgumentsFailure(`repositoryRoot is not a directory: ${repositoryRootPath}`);
  }

  return null;
};

/**
 * Validates existing reference checkout file URLs before path normalization.
 */
const odwReferenceCheckoutFailureForUrl = (
  odwReferenceCheckout: URL,
): FixtureRefreshFailure | null => {
  const odwReferenceCheckoutPath = filePathForUrl(odwReferenceCheckout);
  if (odwReferenceCheckoutPath === null) {
    return invalidArgumentsFailure("odwReferenceCheckout must be a valid file: directory URL.");
  }

  const checkoutStats = safeStats(odwReferenceCheckoutPath);
  if (checkoutStats !== null && !checkoutStats.isDirectory()) {
    return missingOdwReferenceCheckoutFailure(
      `ODW_REFERENCE_CHECKOUT is not a directory: ${odwReferenceCheckoutPath}`,
      odwReferenceCheckoutPath,
    );
  }

  return null;
};

/**
 * Returns the first checkout or allow-list failure that prevents refresh.
 */
const firstBlockingFailure = (odwReferenceCheckout: URL): FixtureRefreshFailure | null => {
  const odwReferenceCheckoutPath = filePathForUrl(odwReferenceCheckout);
  if (odwReferenceCheckoutPath === null) {
    return invalidArgumentsFailure("odwReferenceCheckout must be a valid file: directory URL.");
  }

  const checkoutStats = safeStats(odwReferenceCheckoutPath);
  if (checkoutStats === null) {
    return missingOdwReferenceCheckoutFailure(
      `ODW_REFERENCE_CHECKOUT does not exist: ${odwReferenceCheckoutPath}`,
      odwReferenceCheckoutPath,
    );
  }

  if (!checkoutStats.isDirectory()) {
    return missingOdwReferenceCheckoutFailure(
      `ODW_REFERENCE_CHECKOUT is not a directory: ${odwReferenceCheckoutPath}`,
      odwReferenceCheckoutPath,
    );
  }

  for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
    const upstreamSource = new URL(`examples/${fixture.fileName}`, odwReferenceCheckout);
    if (!isExistingFile(upstreamSource)) {
      return missingUpstreamExampleFailure(fixture.fileName, upstreamSource);
    }
  }

  return null;
};

/**
 * Returns the first managed target that cannot be refreshed safely.
 */
const firstManagedTargetFailure = (
  repositoryRoot: URL,
  files: readonly PlannedFixtureFile[],
): FixtureRefreshFailure | null => {
  for (const file of files) {
    const failure = managedTargetFailure(repositoryRoot, file.relativePath);
    if (failure !== null) {
      return failure;
    }
  }
  return null;
};

/**
 * Builds the full ordered file plan for copied examples and manifests.
 */
const plannedRefreshFiles = (
  repositoryRoot: URL,
  odwReferenceCheckout: URL,
): readonly PlannedFixtureFile[] => {
  const copiedExamples = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((fixture) => ({
    relativePath: fixture.fixturePath,
    source: readFileSync(new URL(`examples/${fixture.fileName}`, odwReferenceCheckout)),
  }));

  return [...copiedExamples, ...plannedManifestFiles(repositoryRoot, odwReferenceCheckout)];
};

/**
 * Lists upstream example files outside this roadmap task's allow-list.
 */
const extraExampleFileNames = (odwReferenceCheckout: URL): readonly string[] => {
  const examplesDirectory = new URL("examples/", odwReferenceCheckout);
  const allowList = new Set(ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((fixture) => fixture.fileName));

  return readdirSync(examplesDirectory)
    .filter((entry) => entry.endsWith(".js") && !allowList.has(entry))
    .sort();
};

/**
 * Checks whether a planned file already matches the repository copy.
 */
const matchesCurrentSource = (repositoryRoot: URL, file: PlannedFixtureFile): boolean => {
  const fileUrl = new URL(file.relativePath, repositoryRoot);
  if (!existsSync(fileUrl)) {
    return false;
  }

  const current = readFileSync(fileUrl);
  const planned = typeof file.source === "string" ? Buffer.from(file.source, "utf8") : file.source;
  return current.equals(planned);
};

/**
 * Writes only files whose planned content differs from disk.
 */
const writeChangedFiles = (
  repositoryRoot: URL,
  files: readonly PlannedFixtureFile[],
): readonly string[] => {
  const writtenPaths: string[] = [];
  for (const file of files) {
    if (matchesCurrentSource(repositoryRoot, file)) {
      continue;
    }

    const targetPath = fileURLToPath(new URL(file.relativePath, repositoryRoot));
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.source);
    writtenPaths.push(file.relativePath);
  }
  return writtenPaths;
};

/**
 * Builds the stable maintainer report from a planned refresh.
 */
const reportFromPlan = (
  options: FixtureRefreshOptions,
  plannedFiles: readonly PlannedFixtureFile[],
  extraUpstreamExamples: readonly string[],
  failures: readonly FixtureRefreshFailure[],
  changes: {
    readonly wouldWritePaths?: readonly string[];
    readonly writtenPaths?: readonly string[];
    readonly shouldClassifyUnchanged?: boolean;
  } = {},
): FixtureRefreshReport => {
  const managedPaths = plannedFiles.map((file) => file.relativePath).sort();
  const changedPaths = new Set([
    ...(changes.wouldWritePaths ?? []),
    ...(changes.writtenPaths ?? []),
  ]);
  const unchangedPaths =
    changes.shouldClassifyUnchanged === false
      ? []
      : managedPaths.filter((path) => !changedPaths.has(path));

  return {
    mode: options.shouldWrite ? "write" : "dry-run",
    repositoryRoot: reportPath(options.repositoryRoot),
    odwReferenceCheckout: reportPath(options.odwReferenceCheckout),
    counts: currentCounts(),
    managedPaths,
    wouldWritePaths: [...(changes.wouldWritePaths ?? [])].sort(),
    writtenPaths: [...(changes.writtenPaths ?? [])].sort(),
    unchangedPaths,
    extraUpstreamExamples,
    failures,
  };
};

/**
 * Counts the current committed fixture corpus.
 */
const currentCounts = () => {
  const invalidWorkflows = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.length;
  return {
    odwExamples: ODW_EXAMPLE_FIXTURE_SNAPSHOTS.length,
    masking: MASKING_FIXTURE_SNAPSHOTS.length,
    invalidWorkflows,
    hostileMetadata: INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.family === "hostile-metadata",
    ).length,
    invalidDiagnostics: INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.reduce(
      (count, fixture) => count + fixture.expectedDiagnostics.length,
      0,
    ),
    totalFixtures:
      ODW_EXAMPLE_FIXTURE_SNAPSHOTS.length + MASKING_FIXTURE_SNAPSHOTS.length + invalidWorkflows,
  };
};

/**
 * Converts a URL to a report path without throwing on invalid URL schemes.
 */
const reportPath = (url: URL): string =>
  url.protocol === "file:" ? (filePathForUrl(url) ?? url.href) : url.href;

/**
 * Checks that a refresh source exists and is a regular file.
 */
const isExistingFile = (url: URL): boolean => {
  const path = filePathForUrl(url);
  const stats = path === null ? null : safeStats(path);
  return stats?.isFile() ?? false;
};
