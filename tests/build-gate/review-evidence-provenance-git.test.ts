/**
 * @file Unit tests for reading review-evidence provenance from Git.
 */

import { describe, expect, it } from "bun:test";
import type { CommandResult, GitRunner } from "./git-support";
import { readTreeProvenance } from "./review-evidence-provenance";

const commit = "0123456789abcdef0123456789abcdef01234567";
const tree = "fedcba9876543210fedcba9876543210fedcba98";

/** Build a shared command-result fixture with focused overrides. */
const makeResult = (overrides: Partial<CommandResult> = {}): CommandResult => ({
  status: 0,
  signal: null,
  stdout: "",
  stderr: "",
  ...overrides,
});

/** Create a fake Git runner that returns canned results in call order. */
const createFakeGitRunner = (results: readonly CommandResult[]): GitRunner => {
  let index = 0;

  return {
    run: () => results[index++] ?? makeResult({ status: 1, stderr: "unexpected git call" }),
  };
};

describe("readTreeProvenance", () => {
  it("reads HEAD commit and tree object ids", () => {
    const git = createFakeGitRunner([
      makeResult({ stdout: `${commit}\n` }),
      makeResult({ stdout: `${tree}\n` }),
    ]);

    expect(readTreeProvenance(git)).toEqual({ ok: true, provenance: { commit, tree } });
  });

  it("reports a failed commit lookup", () => {
    const git = createFakeGitRunner([
      makeResult({ status: 128, stderr: "fatal: not a git repository\n" }),
    ]);

    expect(readTreeProvenance(git)).toEqual({
      ok: false,
      message: "git rev-parse HEAD failed with status 128: fatal: not a git repository",
    });
  });

  it("reports a failed tree lookup", () => {
    const git = createFakeGitRunner([
      makeResult({ stdout: `${commit}\n` }),
      makeResult({ status: 128, stderr: "fatal: ambiguous argument 'HEAD^{tree}'\n" }),
    ]);

    expect(readTreeProvenance(git)).toEqual({
      ok: false,
      message:
        "git rev-parse HEAD^{tree} failed with status 128: fatal: ambiguous argument 'HEAD^{tree}'",
    });
  });

  it.each([
    ["commit lookup", [makeResult({ error: new Error("spawn git ENOENT") })]],
    [
      "tree lookup",
      [
        makeResult({ stdout: `${commit}\n` }),
        makeResult({ error: new Error("spawn git ETIMEDOUT\nretry later") }),
      ],
    ],
  ] satisfies readonly [
    string,
    readonly CommandResult[],
  ][])("reports missing Git or timeout errors during %s", (_name, results) => {
    expect(readTreeProvenance(createFakeGitRunner(results))).toEqual({
      ok: false,
      message: expect.stringMatching(/^git rev-parse (?:HEAD|HEAD\^\{tree\}) failed: spawn git E/),
    });
  });

  it("reports empty commit output", () => {
    const git = createFakeGitRunner([makeResult({ stdout: "\n" })]);

    expect(readTreeProvenance(git)).toEqual({
      ok: false,
      message: "git rev-parse HEAD produced empty output",
    });
  });
});
