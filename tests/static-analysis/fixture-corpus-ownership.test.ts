/**
 * @file Architecture guard for fixture corpus location ownership.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { INVALID_WORKFLOW_FIXTURE_CORPUS } from "./fixtures/invalid-workflows/corpus";
import { MASKING_FIXTURE_CORPUS } from "./fixtures/masking/corpus";
import { ODW_EXAMPLE_FIXTURE_CORPUS } from "./fixtures/odw-examples/corpus";

const STATIC_ANALYSIS_ROOT = "tests/static-analysis";
const GUARD_FILE_PATH = relative(process.cwd(), fileURLToPath(import.meta.url))
  .split(sep)
  .join("/");
const OWNER_MODULE_PATHS = new Set([
  "tests/static-analysis/fixtures/dual-compat/corpus.ts",
  "tests/static-analysis/fixtures/invalid-workflows/corpus.ts",
  "tests/static-analysis/fixtures/masking/corpus.ts",
  "tests/static-analysis/fixtures/odw-examples/corpus.ts",
]);
const DIAGNOSTIC_PROJECTION_PATH = "tests/static-analysis/fixtures/diagnostic-projection.ts";
const COMPARABLE_DIAGNOSTIC_FIELDS = new Set([
  "rule",
  "severity",
  "message",
  "docs",
  "span",
  "spanText",
]);

type InlineCorpusLocation = {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly text: string;
};

type LocalComparableDiagnostic = {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly name: string;
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
  ownedCorpusSegment("masking", MASKING_FIXTURE_CORPUS.manifestRoot),
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

/** Returns the stable property name for simple type members. */
const memberName = (node: ts.TypeElement): string | undefined => {
  if (!("name" in node) || node.name === undefined) {
    return undefined;
  }

  if (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) {
    return node.name.text;
  }

  return undefined;
};

/** Reports whether a type member list rebuilds the shared comparable shape. */
const hasComparableDiagnosticMembers = (members: ts.NodeArray<ts.TypeElement>): boolean => {
  const memberNames = new Set(
    members.map(memberName).filter((name): name is string => name !== undefined),
  );

  return [...COMPARABLE_DIAGNOSTIC_FIELDS].every((field) => memberNames.has(field));
};

/** Reports whether a type alias rebuilds the shared comparable shape. */
const isComparableDiagnosticTypeAlias = (
  node: ts.Node,
): node is ts.TypeAliasDeclaration & { readonly type: ts.TypeLiteralNode } => {
  if (!ts.isTypeAliasDeclaration(node)) {
    return false;
  }

  if (!ts.isTypeLiteralNode(node.type)) {
    return false;
  }

  return hasComparableDiagnosticMembers(node.type.members);
};

/** Reports a local comparable diagnostic type declaration, when present. */
const localComparableDiagnosticDeclaration = (
  sourceFile: ts.SourceFile,
  filePath: string,
  node: ts.Node,
): LocalComparableDiagnostic | undefined => {
  if (ts.isInterfaceDeclaration(node) && hasComparableDiagnosticMembers(node.members)) {
    return {
      filePath,
      ...nodeLocation(sourceFile, node.name),
      name: node.name.text,
    };
  }

  if (isComparableDiagnosticTypeAlias(node)) {
    return {
      filePath,
      ...nodeLocation(sourceFile, node.name),
      name: node.name.text,
    };
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

/** Reports whether a property assignment carries an owned manifest root. */
const ownedManifestRootLiteral = (node: ts.Node): string | undefined => {
  if (!ts.isPropertyAssignment(node)) {
    return undefined;
  }

  if (!ts.isIdentifier(node.name) || node.name.text !== "manifestRoot") {
    return undefined;
  }

  const manifestRootText = literalText(node.initializer);
  if (manifestRootText === undefined || !isOwnedCorpusUrlLiteral(manifestRootText)) {
    return undefined;
  }

  return manifestRootText;
};

/** Reports whether a node reconstructs an owned corpus location outside the owner. */
const ownedCorpusLocationLiteral = (node: ts.Node): string | undefined => {
  return ownedCorpusUrlLiteral(node) ?? ownedManifestRootLiteral(node);
};

/** Finds inline fixture-corpus location literals in one source string. */
const inlineCorpusLocationsInSource = (
  filePath: string,
  sourceText: string,
): readonly InlineCorpusLocation[] => {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const locations: InlineCorpusLocation[] = [];

  const visit = (node: ts.Node): void => {
    if (ownedCorpusLocationLiteral(node) !== undefined) {
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

/** Finds local comparable-diagnostic declarations in one source string. */
const localComparableDiagnosticsInSource = (
  filePath: string,
  sourceText: string,
): readonly LocalComparableDiagnostic[] => {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const declarations: LocalComparableDiagnostic[] = [];

  const visit = (node: ts.Node): void => {
    const declaration = localComparableDiagnosticDeclaration(sourceFile, filePath, node);

    if (declaration !== undefined) {
      declarations.push(declaration);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return declarations;
};

/** Finds local comparable-diagnostic declarations in one file. */
const localComparableDiagnosticsInFile = (
  filePath: string,
): readonly LocalComparableDiagnostic[] => {
  return localComparableDiagnosticsInSource(filePath, readFileSync(filePath, "utf8"));
};

/** Reports whether a test file owns manifest-driven parity comparisons. */
const isManifestParityTestFile = (filePath: string): boolean => {
  return filePath.endsWith("-parity.test.ts") || filePath.endsWith("-fixtures.test.ts");
};

describe("fixture corpus ownership", () => {
  it("detects inline owned fixture corpus location literals", () => {
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
    const reconstructedMaskingLocation = inlineCorpusLocationsInSource(
      "reconstructed.ts",
      "const corpus = {\n" +
        '  fixtureDirectory: new URL("./fixtures/", import.meta.url),\n' +
        '  manifestRoot: "tests/static-analysis/fixtures/masking/",\n' +
        "};\n",
    );

    expect(inlineLiteral).toHaveLength(1);
    expect(inlineLiteral[0]?.text).toContain("fixtures/odw-examples/");
    expect(invalidInlineLiteral).toHaveLength(1);
    expect(invalidInlineLiteral[0]?.text).toContain("fixtures/invalid-workflows/");
    expect(maskingLiteral).toHaveLength(1);
    expect(maskingLiteral[0]?.text).toContain("fixtures/masking/");
    expect(reconstructedMaskingLocation).toHaveLength(1);
    expect(reconstructedMaskingLocation[0]?.text).toContain("fixtures/masking/");
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
  });

  it("keeps hand-written tests free of inline owned corpus locations", () => {
    const inlineLocations = sourceFilesUnder(STATIC_ANALYSIS_ROOT)
      .filter((filePath) => filePath !== GUARD_FILE_PATH && !OWNER_MODULE_PATHS.has(filePath))
      .flatMap((filePath) => inlineCorpusLocationsInFile(filePath));

    expect(inlineLocations).toEqual([]);
  });

  it("detects local comparable diagnostic type declarations", () => {
    const declarations = localComparableDiagnosticsInSource(
      "local-parity.test.ts",
      "type ComparableDiagnostic = {\n" +
        "  readonly rule: string;\n" +
        "  readonly severity: string;\n" +
        "  readonly message: string;\n" +
        "  readonly docs: string;\n" +
        "  readonly span: unknown;\n" +
        "  readonly spanText: string;\n" +
        "};\n",
    );

    expect(declarations).toEqual([
      {
        filePath: "local-parity.test.ts",
        line: 1,
        column: 6,
        name: "ComparableDiagnostic",
      },
    ]);
  });

  it("keeps parity suites on the shared diagnostic projection contract", () => {
    const localDeclarations = sourceFilesUnder(STATIC_ANALYSIS_ROOT)
      .filter((filePath) => filePath !== DIAGNOSTIC_PROJECTION_PATH)
      .filter(isManifestParityTestFile)
      .flatMap((filePath) => localComparableDiagnosticsInFile(filePath));

    expect(localDeclarations).toEqual([]);
  });
});
