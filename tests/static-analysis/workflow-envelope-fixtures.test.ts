/**
 * @file Workflow envelope scanner fixture corpus tests.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile } from "odw-lint";
import { scanWorkflowEnvelope } from "../../src/static-analysis/workflow-envelope";
import { readFixtureSource } from "./fixtures/corpus-support";
import type { InvalidWorkflowFixtureSnapshot } from "./fixtures/invalid-workflows";
import { UNSUPPORTED_IMPORT_EXPORT_FIXTURES } from "./fixtures/invalid-workflows/manifests/unsupported-import-export";
import {
  ODW_EXAMPLE_FIXTURE_SNAPSHOTS,
  type OdwExampleFixtureSnapshot,
} from "./fixtures/odw-examples";
import { expectScannedEnvelope, spanTextFor } from "./workflow-envelope-support";

const INVALID_FIXTURE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url),
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/",
  recursive: true,
} as const;
const ODW_EXAMPLE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/odw-examples/", import.meta.url),
} as const;

/** Scans one unsupported import/export fixture from its manifest entry. */
const scanInvalidFixture = (fixture: InvalidWorkflowFixtureSnapshot) => {
  const sourceFile = createOriginalSourceFile({
    filePath: fixture.fixturePath,
    sourceText: readFixtureSource(INVALID_FIXTURE_CORPUS, fixture.fixturePath),
  });

  return { result: scanWorkflowEnvelope(sourceFile), sourceFile };
};

/** Scans one valid ODW example fixture from its manifest entry. */
const scanOdwExampleFixture = (fixture: OdwExampleFixtureSnapshot) => {
  const sourceText = readFixtureSource(ODW_EXAMPLE_CORPUS, fixture.fileName);
  const sourceFile = createOriginalSourceFile({
    filePath: fixture.fixturePath,
    sourceText,
  });

  return { result: scanWorkflowEnvelope(sourceFile), sourceFile };
};

describe("workflow envelope invalid fixture diagnostics", () => {
  it("has unsupported import/export fixtures", () => {
    expect(UNSUPPORTED_IMPORT_EXPORT_FIXTURES.length).toBeGreaterThan(0);
  });

  it.each([
    ...UNSUPPORTED_IMPORT_EXPORT_FIXTURES,
  ])("matches unsupported import/export manifest diagnostics for $fileName", (fixture) => {
    const { result, sourceFile } = scanInvalidFixture(fixture);

    expect(
      result.diagnostics.map((diagnostic) => ({
        rule: diagnostic.rule,
        severity: diagnostic.severity,
        message: diagnostic.message,
        span: diagnostic.span,
        spanText: spanTextFor(sourceFile, diagnostic.span),
      })),
    ).toEqual([...fixture.expectedDiagnostics]);
  });
});

describe("workflow envelope valid example fixtures", () => {
  it("has ODW example fixtures", () => {
    expect(ODW_EXAMPLE_FIXTURE_SNAPSHOTS.length).toBeGreaterThan(0);
  });

  it.each([
    ...ODW_EXAMPLE_FIXTURE_SNAPSHOTS,
  ])("finds metadata declarations in $fileName without envelope diagnostics", (fixture) => {
    const { result, sourceFile } = scanOdwExampleFixture(fixture);
    const envelope = expectScannedEnvelope(result, fixture.fileName);

    expect(result.diagnostics).toEqual(fixture.expectedDiagnostics);
    expect(spanTextFor(sourceFile, envelope.metaDeclarationSpan)).toStartWith(
      "export const meta =",
    );
    expect(envelope.bodySpan.start.offset).toBeGreaterThanOrEqual(0);
    expect(envelope.bodySpan.end.offset).toBeLessThanOrEqual(sourceFile.byteLength);
  });
});
