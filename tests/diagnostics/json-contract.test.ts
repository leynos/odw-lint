/**
 * @file JSON diagnostic contract fixture parity tests.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { formatJsonReport } from "odw-lint";
import { runCheck } from "../../src/cli/run-check";
import { readFixtureSource } from "../static-analysis/fixtures/corpus-support";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/invalid-workflows/corpus";

const JSON_CONTRACT_FIXTURE = new URL("./json-contract.fixture.json", import.meta.url);
const LOGICAL_FILE_PATH = "workflows/example.js";
const TOOL_VERSION = "0.1.0";

/** Returns the reviewed invalid workflow source used by the JSON contract. */
const reviewedMissingMetadataSource = (): string => {
  const fixture = findInvalidWorkflowFixture({
    family: "missing-metadata",
    fileName: "missing-meta.js",
  });

  return readFixtureSource(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath);
};

/** Produces the live report bound to the golden JSON contract fixture. */
const liveJsonContractReport = (): string => {
  const sourceText = reviewedMissingMetadataSource();
  const outcome = runCheck({
    paths: [LOGICAL_FILE_PATH],
    version: TOOL_VERSION,
    readFileText: () => sourceText,
  });

  return formatJsonReport(outcome.report);
};

/** Reads the reviewed golden JSON contract fixture. */
const goldenJsonContractReport = (): string => {
  return readFileSync(JSON_CONTRACT_FIXTURE, "utf8");
};

describe("JSON diagnostic contract fixture", () => {
  it("matches the live analyser output for the reviewed source fixture", () => {
    expect(JSON.parse(goldenJsonContractReport())).toEqual(JSON.parse(liveJsonContractReport()));
  });

  it("pins the documented envelope invariants", () => {
    const goldenReport = JSON.parse(goldenJsonContractReport());
    const firstDiagnostic = goldenReport.diagnostics[0];

    expect(goldenReport.schemaVersion).toBe(1);
    expect(goldenReport.tool.name).toBe("odw-lint");
    expect(Object.keys(goldenReport.summary)).toEqual([
      "files",
      "errors",
      "warnings",
      "infos",
      "hints",
    ]);
    expect(firstDiagnostic.rule).toBe("odw/meta-required");
    expect(firstDiagnostic.span).toEqual({
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 0, line: 1, column: 1 },
    });
    expect(firstDiagnostic.docs).toStartWith("docs/rules/");
  });

  it("snapshots the live reviewed-source serializer bytes", () => {
    expect(liveJsonContractReport()).toMatchSnapshot();
  });
});
