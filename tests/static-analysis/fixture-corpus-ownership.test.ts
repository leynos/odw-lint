/**
 * @file Architecture guard for fixture corpus location ownership.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { INVALID_WORKFLOW_FIXTURE_CORPUS } from "./fixtures/invalid-workflows/corpus";
import { ODW_EXAMPLE_FIXTURE_CORPUS } from "./fixtures/odw-examples/corpus";

const STATIC_ANALYSIS_ROOT = "tests/static-analysis";
const GUARD_FILE_PATH = relative(process.cwd(), fileURLToPath(import.meta.url))
  .split(sep)
  .join("/");

type InlineCorpusLocation = {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly text: string;
};

/** Normalizes repository-relative paths for stable reports and comparisons. */
const repositoryPath = (filePath: string): string => {
  return filePath.split(sep).join("/");
};

/** Requires the owner module to publish a repository-relative manifest root. */
const ownedCorpusSegment = (label: string, manifestRoot: string | undefined): string => {
  if (manifestRoot === undefined) {
    throw new Error(`${label} fixture corpus must expose a manifest root.`);
  }

  const fixturesSegmentStart = manifestRoot.indexOf("fixtures/");
  if (fixturesSegmentStart < 0) {
    throw new Error(`${label} fixture corpus manifest root must include fixtures/.`);
  }

  return manifestRoot.slice(fixturesSegmentStart);
};

const OWNED_CORPUS_SEGMENTS = [
  ownedCorpusSegment("ODW example", ODW_EXAMPLE_FIXTURE_CORPUS.manifestRoot),
  ownedCorpusSegment("invalid workflow", INVALID_WORKFLOW_FIXTURE_CORPUS.manifestRoot),
] as const;

/** Returns TypeScript source files beneath one repository-relative directory. */
const sourceFilesUnder = (directory: string): readonly string[] => {
  const filePaths: string[] = [];

  const visit = (currentDirectory: string): void => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".ts")) {
        filePaths.push(repositoryPath(entryPath));
      }
    }
  };

  visit(directory);
  return filePaths.sort();
};

/** Returns a stable display location for one source node. */
const nodeLocation = (sourceFile: ts.SourceFile, node: ts.Node) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return {
    line: position.line + 1,
    column: position.character + 1,
  };
};

/** Extracts text from deliberately narrow literal `new URL` arguments. */
const literalText = (node: ts.Expression | undefined): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  if (ts.isStringLiteralLike(node)) {
    return node.text;
  }

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  return undefined;
};

/** Reports whether a URL literal points at an owned ODW parity corpus. */
const isOwnedCorpusUrlLiteral = (text: string): boolean => {
  return OWNED_CORPUS_SEGMENTS.some((segment) => text.includes(segment));
};

/** Reports whether a node constructs a URL with an owned corpus literal. */
const ownedCorpusUrlLiteral = (node: ts.Node): string | undefined => {
  if (!ts.isNewExpression(node) || !ts.isIdentifier(node.expression)) {
    return undefined;
  }

  if (node.expression.text !== "URL") {
    return undefined;
  }

  const urlText = literalText(node.arguments?.[0]);

  if (urlText === undefined) {
    return undefined;
  }

  if (!isOwnedCorpusUrlLiteral(urlText)) {
    return undefined;
  }

  return urlText;
};

/** Finds inline fixture-corpus location literals in one source string. */
const inlineCorpusLocationsInSource = (
  filePath: string,
  sourceText: string,
): readonly InlineCorpusLocation[] => {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const locations: InlineCorpusLocation[] = [];

  const visit = (node: ts.Node): void => {
    if (ownedCorpusUrlLiteral(node) !== undefined) {
      locations.push({
        filePath,
        ...nodeLocation(sourceFile, node),
        text: node.getText(sourceFile),
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return locations;
};

/** Finds inline fixture-corpus location literals in one file. */
const inlineCorpusLocationsInFile = (filePath: string): readonly InlineCorpusLocation[] => {
  return inlineCorpusLocationsInSource(filePath, readFileSync(filePath, "utf8"));
};

describe("fixture corpus ownership", () => {
  it("detects only inline ODW parity corpus URL literals", () => {
    const inlineLiteral = inlineCorpusLocationsInSource(
      "sample.ts",
      'const corpus = { fixtureDirectory: new URL("./fixtures/odw-examples/", import.meta.url) };',
    );
    const invalidInlineLiteral = inlineCorpusLocationsInSource(
      "invalid.ts",
      'const corpus = { fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url) };',
    );
    const ownerStyleLiteral = inlineCorpusLocationsInSource(
      "owner.ts",
      'const fixtureDirectory = new URL("./", import.meta.url);\n' +
        'const manifestRoot = "tests/static-analysis/fixtures/odw-examples/";\n',
    );
    const maskingLiteral = inlineCorpusLocationsInSource(
      "masking.ts",
      'const corpus = { fixtureDirectory: new URL("./fixtures/masking/", import.meta.url) };',
    );

    expect(inlineLiteral).toHaveLength(1);
    expect(inlineLiteral[0]?.text).toContain("fixtures/odw-examples/");
    expect(invalidInlineLiteral).toHaveLength(1);
    expect(invalidInlineLiteral[0]?.text).toContain("fixtures/invalid-workflows/");
    expect(inlineLiteral).toMatchInlineSnapshot(`
      [
        {
          "column": 36,
          "filePath": "sample.ts",
          "line": 1,
          "text": "new URL("./fixtures/odw-examples/", import.meta.url)",
        },
      ]
    `);
    expect(ownerStyleLiteral).toEqual([]);
    expect(maskingLiteral).toEqual([]);
  });

  it("keeps hand-written tests free of inline ODW parity corpus locations", () => {
    const inlineLocations = sourceFilesUnder(STATIC_ANALYSIS_ROOT)
      .filter((filePath) => filePath !== GUARD_FILE_PATH)
      .flatMap((filePath) => inlineCorpusLocationsInFile(filePath));

    expect(inlineLocations).toEqual([]);
  });
});
