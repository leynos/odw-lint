/**
 * @file Explicit-path workflow source reader tests.
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkflowSource } from "../../src/cli/read-workflow-source";
import { fixtureSourceUrl, readFixtureSource } from "../static-analysis/fixtures/corpus-support";
import {
  findOdwExampleFixture,
  ODW_EXAMPLE_FIXTURE_CORPUS,
} from "../static-analysis/fixtures/odw-examples/corpus";

/** Creates an injected filesystem error without touching the real filesystem. */
const errorWithCode = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(code), { code });

describe("explicit workflow source reads", () => {
  it("reads an existing UTF-8 fixture into a workflow source", () => {
    const fixture = findOdwExampleFixture({ fileName: "fan-out-reduce.js" });
    const filePath = fileURLToPath(
      fixtureSourceUrl(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath),
    );

    expect(readWorkflowSource(filePath)).toEqual({
      ok: true,
      source: {
        filePath,
        sourceText: readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath),
      },
    });
  });

  it.each([
    ["ENOENT", "not-found"],
    ["EISDIR", "not-a-file"],
    ["EACCES", "unreadable"],
  ] as const)("classifies %s as %s", (code, reason) => {
    const filePath = "workflows/input.js";

    expect(
      readWorkflowSource(filePath, {
        readFileText: () => {
          throw errorWithCode(code);
        },
      }),
    ).toMatchObject({
      ok: false,
      failure: {
        filePath,
        reason,
      },
    });
  });

  it("converts unknown thrown values to unreadable failures", () => {
    const filePath = "workflows/input.js";

    expect(
      readWorkflowSource(filePath, {
        readFileText: () => {
          throw "read failed";
        },
      }),
    ).toMatchObject({
      ok: false,
      failure: {
        filePath,
        reason: "unreadable",
        message: "read failed",
      },
    });
  });

  it("uses the default UTF-8 filesystem reader", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "odw-lint-read-workflow-source-"));
    const filePath = join(tempDirectory, "workflow.js");

    try {
      writeFileSync(filePath, "export const meta = { name: 'temp' };\n", "utf8");

      expect(readWorkflowSource(filePath)).toEqual({
        ok: true,
        source: {
          filePath,
          sourceText: "export const meta = { name: 'temp' };\n",
        },
      });
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
