/**
 * @file Dual-compatibility parity tests for passive workflow fixtures.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import type { Diagnostic, SourceSpan } from "odw-lint";
import { lintWorkflowSource, sliceSourceSpan } from "odw-lint";
import { importArchitectureFactsFromSource } from "../diagnostics/import-edge-extraction";
import { isForbiddenOdwImport } from "../diagnostics/odw-import-policy";
import { copiedFixtureFileNames, readFixtureSource } from "./fixtures/corpus-support";
import { DUAL_COMPAT_FIXTURE_SNAPSHOTS } from "./fixtures/dual-compat";
import { DUAL_COMPAT_FIXTURE_CORPUS } from "./fixtures/dual-compat/corpus";
import type {
  DualCompatFixtureDiagnostic,
  DualCompatFixtureSnapshot,
} from "./fixtures/dual-compat/manifest-types";
import { expectedNoErrorOutcome, loaderParityOutcome } from "./fixtures/loader-parity";
import { deriveAnchoredDiagnosticSpan, deriveSha256 } from "./fixtures/refresh-metadata";
import { expectSpanToMatchSource } from "./source-span-oracle";

type ComparableDiagnostic = {
  readonly rule: string;
  readonly severity: Diagnostic["severity"];
  readonly message: string;
  readonly span: SourceSpan;
  readonly spanText: string;
};

/** Reads one passive dual-compatibility fixture source. */
const readDualCompatFixtureSource = (fixture: DualCompatFixtureSnapshot): string => {
  return readFixtureSource(DUAL_COMPAT_FIXTURE_CORPUS, fixture.fixturePath);
};

/** Runs the live lint pipeline for one dual-compatibility fixture. */
const lintDualCompatFixture = (fixture: DualCompatFixtureSnapshot) => {
  return lintWorkflowSource({
    filePath: fixture.fixturePath,
    sourceText: readDualCompatFixtureSource(fixture),
  });
};

/** Converts live diagnostics into the manifest comparison shape. */
const comparableLiveDiagnostics = (
  fixture: DualCompatFixtureSnapshot,
): readonly ComparableDiagnostic[] => {
  const result = lintDualCompatFixture(fixture);

  return result.diagnostics.map((diagnostic) => ({
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    message: diagnostic.message,
    span: diagnostic.span,
    spanText: sliceSourceSpan(result.sourceFile, diagnostic.span),
  }));
};

/** Converts manifest diagnostics into the same reviewer-facing shape. */
const comparableFixtureDiagnostics = (
  diagnostics: readonly DualCompatFixtureDiagnostic[],
): readonly ComparableDiagnostic[] => {
  return diagnostics.map((diagnostic) => ({
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    message: diagnostic.message,
    span: diagnostic.span,
    spanText: diagnostic.spanText,
  }));
};

/** Returns the expected unique warning rule classes for one manifest entry. */
const expectedRuleClasses = (fixture: DualCompatFixtureSnapshot): readonly string[] => {
  return [
    ...new Set(fixture.expectedDiagnostics.map((diagnostic) => String(diagnostic.rule))),
  ].sort();
};

/** Reads one TypeScript test support source file without importing extra edges. */
const readSupportSource = (fileName: string): string => {
  return readFileSync(new URL(fileName, import.meta.url), "utf8");
};

describe("dual-compat pure-metadata parity", () => {
  it("keeps every copied dual-compat fixture represented in the manifest", () => {
    const manifestedFixtureNames = DUAL_COMPAT_FIXTURE_SNAPSHOTS.map(
      (fixture) => `${fixture.family}/${fixture.fileName}`,
    ).sort();

    expect(copiedFixtureFileNames(DUAL_COMPAT_FIXTURE_CORPUS)).toEqual(manifestedFixtureNames);
  });

  it("accepts pure-literal metadata as portability-clean", () => {
    const fixtures = DUAL_COMPAT_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.family === "pure-metadata",
    );

    expect(fixtures).toHaveLength(2);
    for (const fixture of fixtures) {
      const sourceText = readDualCompatFixtureSource(fixture);
      const source = { filePath: fixture.fixturePath, sourceText };

      expect(fixture.expectedStatus).toBe("no-error");
      expect(fixture.expectedDiagnostics).toEqual([]);
      expect(lintWorkflowSource(source).diagnostics).toEqual([]);
      expect(loaderParityOutcome(source)).toEqual(expectedNoErrorOutcome());
    }
  });
});

describe("dual-compat deterministic-time parity", () => {
  it("matches scanDualCompat warning diagnostics and spans", () => {
    const fixtures = DUAL_COMPAT_FIXTURE_SNAPSHOTS.filter(
      (fixture) => fixture.family === "deterministic-time",
    );

    expect(fixtures).toHaveLength(8);
    for (const fixture of fixtures) {
      const sourceText = readDualCompatFixtureSource(fixture);
      const outcome = loaderParityOutcome({ filePath: fixture.fixturePath, sourceText });
      const expectedDiagnostics = comparableFixtureDiagnostics(fixture.expectedDiagnostics);

      expect(comparableLiveDiagnostics(fixture)).toEqual(expectedDiagnostics);
      expect(outcome.status).toBe(fixture.expectedStatus);
      expect(outcome.dialectErrorRules).toEqual([]);
      expect(outcome.ruleClasses).toEqual(expectedDiagnostics.map((diagnostic) => diagnostic.rule));

      for (const diagnostic of fixture.expectedDiagnostics) {
        expectSpanToMatchSource(sourceText, diagnostic.span, diagnostic.spanText);
      }
    }
  });
});

describe("dual-compat harness integration", () => {
  it("reduces every fixture to the manifest status and rule classes", () => {
    for (const fixture of DUAL_COMPAT_FIXTURE_SNAPSHOTS) {
      const sourceText = readDualCompatFixtureSource(fixture);
      const outcome = loaderParityOutcome({ filePath: fixture.fixturePath, sourceText });

      expect(outcome.status).toBe(fixture.expectedStatus);
      expect(outcome.dialectErrorRules).toEqual([]);
      expect(outcome.ruleClasses).toEqual(expectedRuleClasses(fixture));
    }
  });
});

describe("dual-compat manifest freshness", () => {
  it("matches fixture hashes and anchored diagnostic spans", () => {
    for (const fixture of DUAL_COMPAT_FIXTURE_SNAPSHOTS) {
      const sourceText = readDualCompatFixtureSource(fixture);
      const mutatedSourceText = `${sourceText}\n/* freshness guard mutation */\n`;

      expect(deriveSha256(sourceText)).toBe(fixture.sha256);
      expect(deriveSha256(mutatedSourceText)).not.toBe(fixture.sha256);

      for (const diagnostic of fixture.expectedDiagnostics) {
        const refreshed = deriveAnchoredDiagnosticSpan(
          { filePath: fixture.fixturePath, sourceText },
          {
            fixturePath: fixture.fixturePath,
            rule: String(diagnostic.rule),
            spanText: diagnostic.spanText,
            fallbackByteOffset: diagnostic.span.start.offset,
          },
        );

        expect(refreshed).toEqual({
          span: diagnostic.span,
          spanText: diagnostic.spanText,
        });
      }
    }
  });
});

describe("dual-compat inertness", () => {
  it("keeps suite and corpus imports away from executable ODW runtime paths", () => {
    const sources = [
      {
        filePath: "tests/static-analysis/dual-compat-parity.test.ts",
        sourceText: readSupportSource("dual-compat-parity.test.ts"),
      },
      {
        filePath: "tests/static-analysis/fixtures/dual-compat.ts",
        sourceText: readSupportSource("fixtures/dual-compat.ts"),
      },
      {
        filePath: "tests/static-analysis/fixtures/dual-compat/corpus.ts",
        sourceText: readSupportSource("fixtures/dual-compat/corpus.ts"),
      },
    ];

    expect(isForbiddenOdwImport("odw/src/loader")).toBe(true);
    for (const source of sources) {
      const facts = importArchitectureFactsFromSource(source.filePath, source.sourceText);

      expect(facts.computedCommonJsRequires).toEqual([]);
      expect(facts.computedDynamicImports).toEqual([]);
      expect(
        facts.importLikeEdges.filter((edge) => isForbiddenOdwImport(edge.moduleSpecifier)),
      ).toEqual([]);
    }
  });
});
