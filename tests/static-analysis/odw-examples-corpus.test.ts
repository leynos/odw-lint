/**
 * @file Tests for shared ODW example workflow fixture corpus helpers.
 */

import { describe, expect, it } from "bun:test";
import { readFixtureSource } from "./fixtures/corpus-support";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./fixtures/odw-examples";
import {
  findOdwExampleFixture,
  ODW_EXAMPLE_FIXTURE_CORPUS,
  ODW_EXAMPLE_UPSTREAM_ROOT,
} from "./fixtures/odw-examples/corpus";

describe("ODW example workflow fixture corpus helpers", () => {
  it("binds the copied manifest paths to the owner roots", () => {
    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      expect(fixture.fixturePath.startsWith(ODW_EXAMPLE_FIXTURE_CORPUS.manifestRoot ?? "")).toBe(
        true,
      );
      expect(fixture.upstreamPath.startsWith(`${ODW_EXAMPLE_UPSTREAM_ROOT}/`)).toBe(true);
    }
  });

  it("keeps copied fixture file names unique", () => {
    const fileNames = ODW_EXAMPLE_FIXTURE_SNAPSHOTS.map((fixture) => fixture.fileName);

    expect(new Set(fileNames).size).toBe(fileNames.length);
  });

  it("returns snapshots by file name", () => {
    const fixture = findOdwExampleFixture({ fileName: "routing.js" });

    expect(fixture.fixturePath).toBe("tests/static-analysis/fixtures/odw-examples/routing.js");
    expect(fixture.metaName).toBe("routing");
  });

  it("throws a clear error for unknown fixtures", () => {
    expect(() => findOdwExampleFixture({ fileName: "missing.js" })).toThrow(
      "Missing ODW example fixture missing.js.",
    );
  });

  it("reads the same source through manifest paths and fixture basenames", () => {
    const fixture = findOdwExampleFixture({ fileName: "routing.js" });

    expect(readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath)).toBe(
      readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fileName),
    );
  });

  it("freezes the owner corpus at runtime", () => {
    expect(Object.isFrozen(ODW_EXAMPLE_FIXTURE_CORPUS)).toBe(true);
  });
});
