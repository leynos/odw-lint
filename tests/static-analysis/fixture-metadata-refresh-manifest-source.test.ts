/**
 * @file Generated manifest source tests for fixture metadata refresh.
 */

import { describe, expect, it } from "bun:test";
import { pathToFileURL } from "node:url";
import { createTempRefreshWorkspace } from "./fixture-metadata-refresh-workspace";
import { plannedManifestFiles } from "./fixtures/refresh-manifest-source";

const representativeManifestPaths = [
  "tests/static-analysis/fixtures/odw-examples.ts",
  "tests/static-analysis/fixtures/masking.ts",
  "tests/static-analysis/fixtures/invalid-workflows/manifests/missing-metadata.ts",
] as const;

describe("fixture metadata refresh manifest source", () => {
  it("generates stable TypeScript manifest modules", () => {
    const temp = createTempRefreshWorkspace();
    try {
      const files = plannedManifestFiles(
        directoryUrl(temp.repositoryRoot),
        directoryUrl(temp.odwReferenceCheckout),
      );
      const representativeSources = representativeManifestPaths.map((relativePath) =>
        formatRepresentativeSource(relativePath, sourceForPath(files, relativePath)),
      );

      expect(representativeSources.join("\n")).toMatchSnapshot();
    } finally {
      temp.remove();
    }
  });
});

/**
 * Looks up one planned generated file by repository-relative path.
 */
const sourceForPath = (
  files: ReturnType<typeof plannedManifestFiles>,
  relativePath: string,
): string => {
  const matches = files.filter((candidate) => candidate.relativePath === relativePath);
  if (matches.length !== 1) {
    throw new Error(`Expected one generated manifest source for ${relativePath}.`);
  }

  const [file] = matches;
  if (file === undefined || typeof file.source !== "string") {
    throw new Error(`Expected string manifest source for ${relativePath}.`);
  }
  return file.source;
};

/**
 * Renders one generated source with a path heading for stable snapshot review.
 */
const formatRepresentativeSource = (relativePath: string, source: string): string =>
  [`## ${relativePath}`, "", source].join("\n");

/**
 * Converts a temp directory path into a child-resolving file URL.
 */
const directoryUrl = (path: string): URL => new URL(`${pathToFileURL(path).href}/`);
