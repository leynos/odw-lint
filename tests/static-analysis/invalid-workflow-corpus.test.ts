/**
 * @file Tests for shared invalid workflow fixture corpus helpers.
 */

import { describe, expect, it } from "bun:test";
import { readFixtureSource } from "./fixtures/corpus-support";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "./fixtures/invalid-workflows/corpus";

describe("invalid workflow fixture corpus helpers", () => {
  it("returns snapshots by family and file name", () => {
    const fixture = findInvalidWorkflowFixture({
      family: "syntax-error",
      fileName: "body-unclosed-block.js",
    });

    expect(fixture.fixturePath).toBe(
      "tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-block.js",
    );
    expect(readFixtureSource(INVALID_WORKFLOW_FIXTURE_CORPUS, fixture.fixturePath)).toContain(
      'await agent("Draft status.");',
    );
  });

  it("throws a clear error for unknown fixtures", () => {
    expect(() =>
      findInvalidWorkflowFixture({
        family: "hostile-metadata",
        fileName: "missing.js",
      }),
    ).toThrow("Missing invalid workflow fixture hostile-metadata/missing.js.");
  });
});
