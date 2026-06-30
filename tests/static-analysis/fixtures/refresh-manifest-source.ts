/**
 * @file Generated TypeScript source for fixture metadata refresh manifests.
 */

import { readFileSync } from "node:fs";
import type { SourceSpan } from "odw-lint";
import { INVALID_WORKFLOW_FIXTURE_SNAPSHOTS } from "./invalid-workflows";
import type {
  InvalidWorkflowFixtureFamily,
  InvalidWorkflowFixtureSnapshot,
} from "./invalid-workflows/manifest-types";
import { MASKING_FIXTURE_SNAPSHOTS } from "./masking";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./odw-examples";
import { deriveAnchoredDiagnosticSpan, deriveSha256 } from "./refresh-derivation";
import type { DiagnosticSpanAnchor, RefreshedDiagnosticSpan } from "./refresh-metadata";

export interface PlannedFixtureFile {
  readonly relativePath: string;
  readonly source: string | Uint8Array;
}

const ODW_EXAMPLES_MANIFEST_PATH = "tests/static-analysis/fixtures/odw-examples.ts";
const MASKING_MANIFEST_PATH = "tests/static-analysis/fixtures/masking.ts";
const HOSTILE_METADATA_MANIFEST_PATH =
  "tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts";
const MALFORMED_METADATA_MANIFEST_PATH =
  "tests/static-analysis/fixtures/invalid-workflows/manifests/malformed-metadata.ts";
const MISSING_METADATA_MANIFEST_PATH =
  "tests/static-analysis/fixtures/invalid-workflows/manifests/missing-metadata.ts";
const SYNTAX_ERROR_MANIFEST_PATH =
  "tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts";
const UNSUPPORTED_IMPORT_EXPORT_MANIFEST_PATH =
  "tests/static-analysis/fixtures/invalid-workflows/manifests/unsupported-import-export.ts";

const INVALID_FAMILY_EXPORTS = {
  "hostile-metadata": "HOSTILE_METADATA_FIXTURES",
  "malformed-metadata": "MALFORMED_METADATA_FIXTURES",
  "missing-metadata": "MISSING_METADATA_FIXTURES",
  "syntax-error": "SYNTAX_ERROR_FIXTURES",
  "unsupported-import-export": "UNSUPPORTED_IMPORT_EXPORT_FIXTURES",
} as const satisfies Record<InvalidWorkflowFixtureFamily, string>;

const INVALID_FAMILY_MANIFESTS = {
  "hostile-metadata": HOSTILE_METADATA_MANIFEST_PATH,
  "malformed-metadata": MALFORMED_METADATA_MANIFEST_PATH,
  "missing-metadata": MISSING_METADATA_MANIFEST_PATH,
  "syntax-error": SYNTAX_ERROR_MANIFEST_PATH,
  "unsupported-import-export": UNSUPPORTED_IMPORT_EXPORT_MANIFEST_PATH,
} as const satisfies Record<InvalidWorkflowFixtureFamily, string>;

export const INVALID_FAMILY_ORDER = [
  "missing-metadata",
  "malformed-metadata",
  "hostile-metadata",
  "unsupported-import-export",
  "syntax-error",
] as const satisfies readonly InvalidWorkflowFixtureFamily[];

/**
 * Builds all generated TypeScript manifest files in stable order.
 *
 * @param repositoryRoot - Repository root containing local fixture sources.
 * @param odwReferenceCheckout - Source-backed ODW checkout for examples.
 * @returns Planned TypeScript manifest file contents.
 */
export const plannedManifestFiles = (
  repositoryRoot: URL,
  odwReferenceCheckout: URL,
): readonly PlannedFixtureFile[] => [
  {
    relativePath: ODW_EXAMPLES_MANIFEST_PATH,
    source: odwExampleManifestSource(odwReferenceCheckout),
  },
  {
    relativePath: MASKING_MANIFEST_PATH,
    source: maskingManifestSource(repositoryRoot),
  },
  ...invalidFamilyManifestSources(repositoryRoot),
];

/**
 * Generates the ODW example manifest source.
 */
const odwExampleManifestSource = (odwReferenceCheckout: URL): string =>
  `${readOnlyHeader("ODW example workflow fixture manifest")}\n` +
  `import { deepFreezeFixtureManifest } from "./manifest-freeze";\n\n` +
  odwExampleTypesSource() +
  `\nexport const ODW_EXAMPLE_FIXTURE_SNAPSHOTS = deepFreezeFixtureManifest([\n` +
  ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((fixture) => {
    const sourceText = readFileSync(
      new URL(`examples/${fixture.fileName}`, odwReferenceCheckout),
      "utf8",
    );
    return `  odwExampleFixture({\n    fileName: ${literal(fixture.fileName)},\n    metaName: ${literal(
      fixture.metaName,
    )},\n    sha256: ${literal(deriveSha256(sourceText))},\n  }),`;
  }).join("\n") +
  `\n]) satisfies readonly OdwExampleFixtureSnapshot[];\n`;

/**
 * Generates shared ODW example manifest declarations.
 */
const odwExampleTypesSource = (): string => `export type OdwExampleFixtureStatus = "no-error";
export interface OdwExampleFixtureSnapshot {
  readonly fileName: string;
  readonly fixturePath: string;
  readonly upstreamPath: string;
  readonly metaName: string;
  readonly sha256: string;
  readonly expectedStatus: OdwExampleFixtureStatus;
  readonly expectedDiagnostics: readonly [];
}
const ODW_EXAMPLES_FIXTURE_ROOT = "tests/static-analysis/fixtures/odw-examples";
const UPSTREAM_ODW_EXAMPLES_ROOT = "open-dynamic-workflows/examples";
const EXPECTED_NO_DIAGNOSTICS = deepFreezeFixtureManifest([]) satisfies readonly [];
type OdwExampleFixtureInput = Omit<
  OdwExampleFixtureSnapshot,
  "fixturePath" | "upstreamPath" | "expectedStatus" | "expectedDiagnostics"
>;
/** Builds one runtime-frozen ODW example fixture manifest entry. */
const odwExampleFixture = (fixture: OdwExampleFixtureInput): OdwExampleFixtureSnapshot =>
  deepFreezeFixtureManifest({
    ...fixture,
    fixturePath: ${templatePath("ODW_EXAMPLES_FIXTURE_ROOT", "fixture.fileName")},
    upstreamPath: ${templatePath("UPSTREAM_ODW_EXAMPLES_ROOT", "fixture.fileName")},
    expectedStatus: "no-error",
    expectedDiagnostics: EXPECTED_NO_DIAGNOSTICS,
  });
`;

/**
 * Generates the masking fixture manifest source.
 */
const maskingManifestSource = (repositoryRoot: URL): string =>
  `${readOnlyHeader("Synthetic masking workflow fixture manifest")}\n` +
  `import { deepFreezeFixtureManifest } from "./manifest-freeze";\n\n` +
  maskingTypesSource() +
  `\nexport const MASKING_FIXTURE_SNAPSHOTS = deepFreezeFixtureManifest([\n` +
  MASKING_FIXTURE_SNAPSHOTS.map((fixture) => {
    const sourceText = readFileSync(new URL(fixture.fixturePath, repositoryRoot), "utf8");
    return `  maskingFixture({\n    fileName: ${literal(fixture.fileName)},\n    context: ${literal(
      fixture.context,
    )},\n    metaName: ${literal(fixture.metaName)},\n    sha256: ${literal(deriveSha256(sourceText))},\n  }),`;
  }).join("\n") +
  `\n]) satisfies readonly MaskingFixtureSnapshot[];\n`;

/**
 * Generates shared masking manifest declarations.
 */
const maskingTypesSource =
  (): string => `export type MaskingFixtureContext = "comment" | "regex" | "string" | "template";
export type MaskingFixtureExpectedStatus = "no-envelope-diagnostics";
export interface MaskingFixtureSnapshot {
  readonly fileName: string;
  readonly fixturePath: string;
  readonly context: MaskingFixtureContext;
  readonly metaName: string;
  readonly sha256: string;
  readonly expectedStatus: MaskingFixtureExpectedStatus;
  readonly expectedDiagnostics: readonly [];
}
export const MASKING_FIXTURE_ROOT = "tests/static-analysis/fixtures/masking";
export const EXPECTED_NO_ENVELOPE_DIAGNOSTICS = deepFreezeFixtureManifest([]) satisfies readonly [];
type MaskingFixtureInput = Omit<
  MaskingFixtureSnapshot,
  "fixturePath" | "expectedStatus" | "expectedDiagnostics"
>;
/** Builds one runtime-frozen synthetic masking fixture manifest entry. */
const maskingFixture = (fixture: MaskingFixtureInput): MaskingFixtureSnapshot =>
  deepFreezeFixtureManifest({
    ...fixture,
    fixturePath: ${templatePath("MASKING_FIXTURE_ROOT", "fixture.fileName")},
    expectedStatus: "no-envelope-diagnostics",
    expectedDiagnostics: EXPECTED_NO_ENVELOPE_DIAGNOSTICS,
  });
`;

/**
 * Generates every invalid-fixture family manifest source.
 */
const invalidFamilyManifestSources = (repositoryRoot: URL): readonly PlannedFixtureFile[] =>
  INVALID_FAMILY_ORDER.map((family) => ({
    relativePath: INVALID_FAMILY_MANIFESTS[family],
    source: invalidFamilyManifestSource(repositoryRoot, family),
  }));

/**
 * Generates one invalid-fixture family manifest source.
 */
const invalidFamilyManifestSource = (
  repositoryRoot: URL,
  family: InvalidWorkflowFixtureFamily,
): string => {
  const fixtures = INVALID_WORKFLOW_FIXTURE_SNAPSHOTS.filter(
    (fixture) => fixture.family === family,
  );
  return (
    `${readOnlyHeader(`${family} invalid workflow fixture manifest entries`)}\n\n` +
    `import { deepFreezeFixtureManifest } from "../../manifest-freeze";\n` +
    `import {\n  diagnostic,\n  type InvalidWorkflowFixtureSnapshot,\n  invalidWorkflowFixture,\n} from "../manifest-types";\n\n` +
    `export const ${INVALID_FAMILY_EXPORTS[family]} = deepFreezeFixtureManifest([\n` +
    fixtures.map((fixture) => invalidFixtureSource(repositoryRoot, fixture)).join("\n") +
    `\n]) satisfies readonly InvalidWorkflowFixtureSnapshot[];\n`
  );
};

/**
 * Generates one invalid fixture manifest entry.
 */
const invalidFixtureSource = (
  repositoryRoot: URL,
  fixture: InvalidWorkflowFixtureSnapshot,
): string => {
  const sourceText = readFileSync(new URL(fixture.fixturePath, repositoryRoot), "utf8");
  return `  invalidWorkflowFixture({\n    family: ${literal(fixture.family)},\n    fileName: ${literal(
    fixture.fileName,
  )},\n    sha256: ${literal(deriveSha256(sourceText))},\n    expectedStatus: ${literal(
    fixture.expectedStatus,
  )},\n    expectedDiagnostics: [\n${fixture.expectedDiagnostics
    .map((diagnostic) => diagnosticSource(sourceText, fixture.fixturePath, diagnostic))
    .join("\n")}\n    ],\n  }),`;
};

/**
 * Generates one invalid fixture diagnostic entry.
 */
const diagnosticSource = (
  sourceText: string,
  fixturePath: string,
  diagnostic: InvalidWorkflowFixtureSnapshot["expectedDiagnostics"][number],
): string => {
  const refreshed = refreshedDiagnosticSpan(sourceText, fixturePath, diagnostic);
  return `      diagnostic({\n        rule: ${literal(String(diagnostic.rule))},\n        severity: ${literal(
    diagnostic.severity,
  )},\n        message: ${literal(diagnostic.message)},\n        span: ${spanSource(refreshed.span)},\n${spanTextProperty(
    refreshed.spanText,
  )}\n      }),`;
};

/**
 * Refreshes a diagnostic span from its stable `spanText` anchor.
 */
const refreshedDiagnosticSpan = (
  sourceText: string,
  fixturePath: string,
  diagnostic: InvalidWorkflowFixtureSnapshot["expectedDiagnostics"][number],
): RefreshedDiagnosticSpan => {
  const anchor = {
    fixturePath,
    rule: String(diagnostic.rule),
    spanText: diagnostic.spanText,
    fallbackByteOffset: diagnostic.span.start.offset,
  } satisfies DiagnosticSpanAnchor;

  return deriveAnchoredDiagnosticSpan({ filePath: fixturePath, sourceText }, anchor);
};

/**
 * Generates a SourceSpan object literal.
 */
const spanSource = (span: SourceSpan): string =>
  `{\n          start: { offset: ${span.start.offset}, line: ${span.start.line}, column: ${span.start.column} },\n          end: { offset: ${span.end.offset}, line: ${span.end.line}, column: ${span.end.column} },\n        }`;

/**
 * Generates a string literal close to Biome's preferred quote style.
 */
const literal = (value: string): string => {
  const jsonLiteral = JSON.stringify(value);
  if (value.includes('"') && !value.includes("'")) {
    return `'${jsonLiteral.slice(1, -1).replaceAll('\\"', '"')}'`;
  }
  return jsonLiteral;
};

/**
 * Generates a spanText property, wrapping long literals like Biome.
 */
const spanTextProperty = (spanText: string): string => {
  const value = literal(spanText);
  return value.length > 92
    ? `        spanText:\n          ${value},`
    : `        spanText: ${value},`;
};
/**
 * Generates a template-literal path expression for emitted manifests.
 */
const templatePath = (rootName: string, fileNameExpression: string): string =>
  `\`\${${rootName}}/\${${fileNameExpression}}\``;

/**
 * Generates the file header for emitted manifests.
 */
const readOnlyHeader = (title: string): string =>
  `/**\n * @file ${title}.\n *\n * This file is generated by tests/static-analysis/fixtures/refresh-metadata.ts.\n */`;
