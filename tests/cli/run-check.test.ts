/**
 * @file Explicit-path check aggregator tests.
 */

import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { checkDiagnosticsExitCode, runCheck } from "../../src/cli/run-check";
import { fixtureSourceUrl, readFixtureSource } from "../static-analysis/fixtures/corpus-support";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/invalid-workflows/corpus";
import {
  findOdwExampleFixture,
  ODW_EXAMPLE_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/odw-examples/corpus";

type SourceLabel = "clean" | "error" | "warning";

type SourceFixture = {
  readonly filePath: string;
  readonly sourceText: string;
};

const VERSION = "0.0.0-test";

/** Resolves a reviewed fixture snapshot to the file path used in diagnostics. */
const fixtureFilePath = (corpus: Parameters<typeof fixtureSourceUrl>[0], fixturePath: string) => {
  return fileURLToPath(fixtureSourceUrl(corpus, fixturePath));
};

/** Returns a clean reviewed workflow source fixture. */
const cleanSource = (): SourceFixture => {
  const fixture = findOdwExampleFixture({ fileName: "fan-out-reduce.js" });
  const filePath = fixtureFilePath(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath);

  return {
    filePath,
    sourceText: readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath),
  };
};

/** Returns an error-bearing reviewed workflow source fixture. */
const errorSource = (): SourceFixture => {
  const fixture = findInvalidWorkflowFixture({
    family: "missing-metadata",
    fileName: "missing-meta.js",
  });
  const filePath = fixtureFilePath(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath);

  return {
    filePath,
    sourceText: readFixtureSource(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath),
  };
};

/** Returns a warning-only reviewed workflow source fixture. */
const warningSource = (): SourceFixture => {
  const fixture = findInvalidWorkflowFixture({
    family: "hostile-metadata",
    fileName: "global-marker.js",
  });
  const filePath = fixtureFilePath(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath);

  return {
    filePath,
    sourceText: readFixtureSource(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath),
  };
};

const sourceFixtures = {
  clean: cleanSource(),
  error: errorSource(),
  warning: warningSource(),
} satisfies Record<SourceLabel, SourceFixture>;

/** Returns a source fixture with a unique diagnostic path for aggregation tests. */
const sourceFor = (label: SourceLabel, index = 0): SourceFixture => {
  const source = sourceFixtures[label];

  return {
    filePath: `${source.filePath}#${label}-${index}`,
    sourceText: source.sourceText,
  };
};

/** Builds an injected reader over the supplied in-memory source fixtures. */
const readFrom = (sources: readonly SourceFixture[]) => {
  const sourceByPath = new Map(sources.map((source) => [source.filePath, source.sourceText]));

  return (filePath: string): string => {
    const sourceText = sourceByPath.get(filePath);

    if (sourceText === undefined) {
      const error = Object.assign(new Error("missing test fixture"), { code: "ENOENT" });
      throw error;
    }

    return sourceText;
  };
};

/** Runs the check aggregator over readable in-memory fixture sources. */
const runFixtureCheck = (sources: readonly SourceFixture[]) => {
  return runCheck({
    paths: sources.map((source) => source.filePath),
    version: VERSION,
    readFileText: readFrom(sources),
  });
};

/** Returns whether generated labels should make the check fail. */
const hasFailingCheckInput = (input: {
  readonly labels: readonly SourceLabel[];
  readonly hasReadFailure: boolean;
}): boolean => {
  return input.labels.some((label) => label !== "clean") || input.hasReadFailure;
};

describe("explicit-path check aggregation", () => {
  it.each([
    ["clean", [sourceFor("clean")], 0],
    ["warning-only", [sourceFor("warning")], 1],
    ["error", [sourceFor("error")], 1],
    ["read-failure", [], 1],
    ["mixed error and clean", [sourceFor("error"), sourceFor("clean")], 1],
  ] as const)("uses Ruff-parity exit policy for %s inputs", (_caseName, sources, exitCode) => {
    const paths =
      sources.length === 0 ? ["missing-workflow.js"] : sources.map((source) => source.filePath);

    const outcome = runCheck({
      paths,
      version: VERSION,
      readFileText: readFrom(sources),
    });

    expect(checkDiagnosticsExitCode(outcome)).toBe(exitCode);
  });

  it("counts readable files and concatenates diagnostics in path order", () => {
    const first = sourceFor("error", 1);
    const second = sourceFor("warning", 2);
    const outcome = runFixtureCheck([first, second]);

    expect(outcome.report.summary.files).toBe(2);
    expect(outcome.readFailures).toEqual([]);
    expect(outcome.report.diagnostics.map((diagnostic) => diagnostic.file)).toEqual([
      first.filePath,
      second.filePath,
    ]);
    expect(outcome.report.diagnostics.map((diagnostic) => String(diagnostic.rule))).toEqual([
      "odw/meta-required",
      "odw/meta-statically-unprovable",
    ]);
  });

  it("exits 1 exactly when diagnostics or read failures remain", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<SourceLabel>("clean", "error", "warning"), {
          minLength: 0,
          maxLength: 8,
        }),
        fc.boolean(),
        (labels, hasReadFailure) => {
          const sources = labels.map((label, index) => sourceFor(label, index));
          const paths = [
            ...sources.map((source) => source.filePath),
            ...(hasReadFailure ? ["missing-workflow.js"] : []),
          ];
          const outcome = runCheck({
            paths,
            version: VERSION,
            readFileText: readFrom(sources),
          });

          expect(checkDiagnosticsExitCode(outcome)).toBe(
            hasFailingCheckInput({ labels, hasReadFailure }) ? 1 : 0,
          );
        },
      ),
    );
  });
});
