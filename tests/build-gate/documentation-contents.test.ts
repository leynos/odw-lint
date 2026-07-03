/**
 * @file Documentation contents freshness tests.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type DocumentationFamily = {
  readonly directory: "execplans" | "issues";
};

const documentationFamilies: readonly DocumentationFamily[] = [
  { directory: "execplans" },
  { directory: "issues" },
];

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const docsRoot = join(repositoryRoot, "docs");
const contentsPath = join(docsRoot, "contents.md");

/**
 * Extract relative Markdown link targets from `docs/contents.md`.
 */
function contentsLinks(): ReadonlySet<string> {
  const source = readFileSync(contentsPath, "utf8");
  const links = new Set<string>();
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const match of source.matchAll(linkPattern)) {
    const linkTarget = match[1];

    if (linkTarget !== undefined && isLocalDocumentationLink(linkTarget)) {
      links.add(normalizeDocumentationLink(linkTarget));
    }
  }

  return links;
}

/**
 * Return current top-level documentation files for one indexed family.
 */
function currentFamilyFiles(family: DocumentationFamily): readonly string[] {
  return readdirSync(join(docsRoot, family.directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `${family.directory}/${entry.name}`)
    .sort();
}

/**
 * Return current top-level ExecPlan and issue-audit files.
 */
function currentIndexedFiles(): readonly string[] {
  return documentationFamilies.flatMap(currentFamilyFiles).sort();
}

/**
 * Return whether a link points at in-repository documentation.
 */
function isLocalDocumentationLink(linkTarget: string): boolean {
  return (
    !linkTarget.startsWith("#") &&
    !linkTarget.startsWith("/") &&
    !/^[a-z][a-z0-9+.-]*:/iu.test(linkTarget)
  );
}

/**
 * Strip anchors and normalize a `docs/contents.md` relative link target.
 */
function normalizeDocumentationLink(linkTarget: string): string {
  const pathWithoutFragment = linkTarget.split("#", 1)[0] ?? "";

  return posix.normalize(pathWithoutFragment);
}

/**
 * Return whether a link is within a freshness-checked documentation family.
 */
function isFreshnessCheckedLink(link: string): boolean {
  return documentationFamilies.some((family) => link.startsWith(`${family.directory}/`));
}

describe("documentation contents freshness", () => {
  it("lists every current top-level ExecPlan and issue audit", () => {
    const links = contentsLinks();
    const missingLinks = currentIndexedFiles().filter((path) => !links.has(path));

    expect(missingLinks).toEqual([]);
  });

  it("does not retain stale ExecPlan or issue-audit links", () => {
    const currentFiles = new Set(currentIndexedFiles());
    const staleLinks = [...contentsLinks()]
      .filter(isFreshnessCheckedLink)
      .filter((link) => !currentFiles.has(link))
      .sort();

    expect(staleLinks).toEqual([]);
  });
});
