/**
 * @file Git-backed tracked-file whitespace hygiene guard tests.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { CliWriters } from "./cli-support";
import { expectSharedCliWriterSeam } from "./cli-support-test-support";
import {
  commitAll,
  createCapturedCliOutput,
  createTemporaryRepository,
  writeRepositoryFile,
} from "./git-support";
import { runWhitespaceHygieneCli } from "./whitespace-hygiene";

/** Read the CLI module source for seam-ownership regression checks. */
const whitespaceHygieneCliSource = () =>
  readFileSync(new URL("./whitespace-hygiene.ts", import.meta.url), "utf8");

describe("runWhitespaceHygieneCli", () => {
  it("uses the shared CLI writer seam", () => {
    expectSharedCliWriterSeam({
      source: whitespaceHygieneCliSource(),
      importPath: "./cli-support",
    });
  });

  it("exits successfully for clean tracked text", () => {
    const repositoryPath = createTemporaryRepository();
    const output = createCapturedCliOutput();
    output satisfies CliWriters;

    try {
      writeRepositoryFile(repositoryPath, "clean.txt", "clean\n");
      commitAll(repositoryPath);

      expect(runWhitespaceHygieneCli(repositoryPath, output)).toBe(0);
      expect(output.stdout).toMatchInlineSnapshot(`
"Whitespace hygiene check passed.
"
`);
      expect(output.stderr).toMatchInlineSnapshot(`""`);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it("fails and reports path and line for tracked trailing whitespace", () => {
    const repositoryPath = createTemporaryRepository();
    const output = createCapturedCliOutput();

    try {
      writeRepositoryFile(repositoryPath, "fixtures/workflow.js", "clean\nbad \n");
      commitAll(repositoryPath);

      expect(runWhitespaceHygieneCli(repositoryPath, output)).toBe(1);
      expect(output.stdout).toMatchInlineSnapshot(`""`);
      expect(output.stderr).toMatchInlineSnapshot(`
"Trailing whitespace found in tracked files:
fixtures/workflow.js:2: trailing space
"
`);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it("ignores untracked files with trailing whitespace", () => {
    const repositoryPath = createTemporaryRepository();
    const output = createCapturedCliOutput();

    try {
      writeRepositoryFile(repositoryPath, "clean.txt", "clean\n");
      commitAll(repositoryPath);
      writeRepositoryFile(repositoryPath, "untracked.txt", "bad \n");

      expect(runWhitespaceHygieneCli(repositoryPath, output)).toBe(0);
      expect(output.stdout).toMatchInlineSnapshot(`
"Whitespace hygiene check passed.
"
`);
      expect(output.stderr).toMatchInlineSnapshot(`""`);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it("ignores tracked binary files containing NUL bytes", () => {
    const repositoryPath = createTemporaryRepository();
    const output = createCapturedCliOutput();

    try {
      writeRepositoryFile(
        repositoryPath,
        "binary.dat",
        Buffer.from([0x62, 0x61, 0x64, 0x20, 0x00]),
      );
      commitAll(repositoryPath);

      expect(runWhitespaceHygieneCli(repositoryPath, output)).toBe(0);
      expect(output.stdout).toMatchInlineSnapshot(`
"Whitespace hygiene check passed.
"
`);
      expect(output.stderr).toMatchInlineSnapshot(`""`);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it("reports a usage failure for a missing tracked working-tree path", () => {
    const repositoryPath = createTemporaryRepository();
    const output = createCapturedCliOutput();

    try {
      writeRepositoryFile(repositoryPath, "missing.txt", "clean\n");
      commitAll(repositoryPath);
      unlinkSync(join(repositoryPath, "missing.txt"));

      expect(runWhitespaceHygieneCli(repositoryPath, output)).toBe(2);
      expect(output.stdout).toMatchInlineSnapshot(`""`);
      expect(output.stderr).toMatchInlineSnapshot(`
"whitespace hygiene check failed: could not read tracked file missing.txt
"
`);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it("does not mutate fixture content while reporting violations", () => {
    const repositoryPath = createTemporaryRepository();
    const output = createCapturedCliOutput();
    const fixtureContent = "clean\nbad \n";

    try {
      writeRepositoryFile(repositoryPath, "fixtures/raw.js", fixtureContent);
      commitAll(repositoryPath);

      expect(runWhitespaceHygieneCli(repositoryPath, output)).toBe(1);
      expect(output.stderr).toMatchInlineSnapshot(`
"Trailing whitespace found in tracked files:
fixtures/raw.js:2: trailing space
"
`);
      expect(readFileSync(join(repositoryPath, "fixtures/raw.js"), "utf8")).toBe(fixtureContent);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
});
