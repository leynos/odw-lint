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
 * Selects one fixture snapshot from a corpus manifest.
 */
export type FixtureSnapshotPredicate<TSnapshot> = (snapshot: TSnapshot) => boolean;

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
 * Finds one fixture snapshot or fails with the owner module's reviewed label.
 *
 * @param snapshots - Manifest snapshots to inspect.
 * @param description - Human-readable fixture label for failure diagnostics.
 * @param predicate - Query predicate that identifies the requested fixture.
 * @returns The matching fixture snapshot.
 * @throws Error when no fixture matches the predicate.
 */
export const findFixtureSnapshot = <TSnapshot>(
  snapshots: readonly TSnapshot[],
  description: string,
  predicate: FixtureSnapshotPredicate<TSnapshot>,
): TSnapshot => {
  const fixture = snapshots.find(predicate);

  if (fixture === undefined) {
    throw new Error(`Missing ${description}.`);
  }

  return fixture;
};

/**
 * Resolves a manifest path or corpus-relative path to the copied fixture path.
 */
const corpusRelativeFixturePath = (corpus: FixtureCorpusLocation, fixturePath: string): string => {
  if (corpus.manifestRoot === undefined) {
    return fixturePath;
  }

  if (fixturePath.startsWith(corpus.manifestRoot)) {
    return fixturePath.slice(corpus.manifestRoot.length);
  }

  if (fixturePath.startsWith("tests/")) {
    throw new Error(
      `Fixture path ${fixturePath} must start with manifest root ` +
        `${corpus.manifestRoot} or be corpus-relative.`,
    );
  }

  return fixturePath;
};

/**
 * Returns the URL for a raw source fixture.
 *
 * @param corpus - Fixture corpus directory and optional manifest root.
 * @param fixturePath - Manifest fixture path or corpus-relative path.
 * @returns File URL for the requested copied fixture.
 */
export const fixtureSourceUrl = (corpus: FixtureCorpusLocation, fixturePath: string): URL => {
  return new URL(corpusRelativeFixturePath(corpus, fixturePath), corpus.fixtureDirectory);
};

/**
 * Reads a copied raw source fixture as UTF-8 text.
 *
 * @param corpus - Fixture corpus directory and optional manifest root.
 * @param fixturePath - Manifest fixture path or corpus-relative path.
 * @returns Raw fixture source text.
 */
export const readFixtureSource = (corpus: FixtureCorpusLocation, fixturePath: string): string => {
  return readFileSync(fixtureSourceUrl(corpus, fixturePath), "utf8");
};
