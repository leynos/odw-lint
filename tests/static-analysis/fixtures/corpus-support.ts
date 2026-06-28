/**
 * @file Shared support helpers for static-analysis fixture corpus tests.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Location metadata for one committed raw fixture corpus.
 */
export interface FixtureCorpusLocation {
  /**
   * Directory containing the copied fixture files.
   */
  readonly fixtureDirectory: URL;

  /**
   * Repository-relative manifest root to strip from manifest fixture paths.
   */
  readonly manifestRoot?: string;

  /**
   * Whether JavaScript fixtures may live below family subdirectories.
   */
  readonly recursive?: boolean;
}

/**
 * Calculates the SHA-256 digest used to pin copied fixture content.
 *
 * @param sourceText - Raw fixture source text.
 * @returns Hex-encoded SHA-256 digest for the fixture source.
 */
export const sha256 = (sourceText: string): string => {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
};

/**
 * Returns committed JavaScript fixture names from a fixture corpus directory.
 *
 * @param corpus - Fixture corpus directory and traversal policy.
 * @returns Sorted JavaScript fixture filenames, including subdirectories when requested.
 */
export const copiedFixtureFileNames = (corpus: FixtureCorpusLocation): readonly string[] => {
  return readdirSync(corpus.fixtureDirectory, { recursive: corpus.recursive === true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".js"))
    .sort();
};

/**
 * Returns the URL for a raw source fixture.
 *
 * @param corpus - Fixture corpus directory and optional manifest root.
 * @param fixturePath - Manifest fixture path or corpus-relative filename.
 * @returns File URL for the requested copied fixture.
 */
export const fixtureSourceUrl = (corpus: FixtureCorpusLocation, fixturePath: string): URL => {
  const relativePath =
    corpus.manifestRoot === undefined ? fixturePath : fixturePath.replace(corpus.manifestRoot, "");

  return new URL(relativePath, corpus.fixtureDirectory);
};

/**
 * Reads a copied raw source fixture as UTF-8 text.
 *
 * @param corpus - Fixture corpus directory and optional manifest root.
 * @param fixturePath - Manifest fixture path or corpus-relative filename.
 * @returns Raw fixture source text.
 */
export const readFixtureSource = (corpus: FixtureCorpusLocation, fixturePath: string): string => {
  return readFileSync(fixtureSourceUrl(corpus, fixturePath), "utf8");
};
