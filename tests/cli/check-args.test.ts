/**
 * @file Isolated argument-parser tests for the `check` command.
 */

import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCheckArgs } from "../../src/cli/check-args";

const DEFAULT_EXIT_POLICY = {
  exitZero: false,
  exitNonZeroOnFix: false,
  forceExclude: false,
  respectGitignore: true,
} as const;

describe("check argument parser", () => {
  it("parses paths with default options", () => {
    expect(parseCheckArgs(["check", "one.js", "two.js"])).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["one.js", "two.js"]),
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["unknown option", ["check", "--flag"], "unknown option: --flag"],
    ["unknown command", ["lint", "workflow.js"], "unknown command: lint"],
    ["no command", [], "usage: odw-lint check <workflow.js ...>"],
    ["no paths", ["check"], "usage: odw-lint check <workflow.js ...>"],
  ] as const)("rejects %s", (_caseName, args, usageError) => {
    expect(parseCheckArgs(args)).toEqual({ ok: false, usageError });
  });

  it.each([
    ["separate value", ["check", "--output-format", "json", "workflow.js"]],
    ["equals value", ["check", "--output-format=json", "workflow.js"]],
  ] as const)("parses output format from %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: true,
      outputFormat: "json",
      paths: Object.freeze(["workflow.js"]),
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["output format", ["check", "--output-format", "--help", "workflow.js"]],
    ["max warnings", ["check", "--max-warnings", "-h", "workflow.js"]],
  ] as const)("treats informational-looking %s values as option values", (_caseName, args) => {
    const result = parseCheckArgs(args);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.usageError).not.toStartWith("usage:");
    }
  });

  it.each([
    ["separate value", ["check", "--max-warnings", "3", "workflow.js"]],
    ["equals value", ["check", "--max-warnings=3", "workflow.js"]],
  ] as const)("parses max warnings from %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      maxWarnings: 3,
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["missing value", ["check", "--max-warnings"], "missing value for --max-warnings"],
    ["text value", ["check", "--max-warnings", "abc"], "invalid value for --max-warnings: abc"],
    ["negative value", ["check", "--max-warnings", "-1"], "invalid value for --max-warnings: -1"],
    [
      "fractional value",
      ["check", "--max-warnings", "1.5"],
      "invalid value for --max-warnings: 1.5",
    ],
  ] as const)("rejects max warnings with %s", (_caseName, args, usageError) => {
    expect(parseCheckArgs(args)).toEqual({ ok: false, usageError });
  });

  it.each([
    [
      "separate unsupported value",
      ["check", "--output-format", "json-lines", "workflow.js"],
      "unsupported output format: json-lines",
    ],
    [
      "equals unsupported value",
      ["check", "--output-format=json-lines", "workflow.js"],
      "unsupported output format: json-lines",
    ],
    ["missing value", ["check", "--output-format"], "missing value for --output-format"],
  ] as const)("rejects output format with %s", (_caseName, args, usageError) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: false,
      usageError,
    });
  });

  it.each([
    ["separate value", ["check", "--config", "odw-lint.json", "workflow.js"]],
    ["equals value", ["check", "--config=odw-lint.json", "workflow.js"]],
  ] as const)("parses --config from %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      configPath: "odw-lint.json",
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["config", ["check", "--config", "--help", "workflow.js"], { configPath: "--help" }],
    ["output file", ["check", "--output-file", "-h", "workflow.js"], { outputFile: "-h" }],
  ] as const)("parses informational-looking %s values as strings", (_caseName, args, value) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      ...value,
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["separate value", ["check", "--output-file", "out.txt", "workflow.js"]],
    ["equals value", ["check", "--output-file=out.txt", "workflow.js"]],
  ] as const)("parses output file from %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      outputFile: "out.txt",
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["separate form", ["check", "--output-file"]],
    ["equals form", ["check", "--output-file="]],
  ] as const)("rejects --output-file without a value in %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: false,
      usageError: "missing value for --output-file",
    });
  });

  it.each([
    ["separate value", ["check", "--stdin-filename", "workflows/stdin.js"]],
    ["equals value", ["check", "--stdin-filename=workflows/stdin.js"]],
  ] as const)("parses stdin filename from %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze([]),
      stdinFilename: "workflows/stdin.js",
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["separate form", ["check", "--stdin-filename"]],
    ["equals form", ["check", "--stdin-filename="]],
  ] as const)("rejects --stdin-filename without a value in %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({
      ok: false,
      usageError: "missing value for --stdin-filename",
    });
  });

  it("rejects --stdin-filename combined with path operands", () => {
    expect(parseCheckArgs(["check", "--stdin-filename", "workflows/stdin.js", "extra.js"])).toEqual(
      {
        ok: false,
        usageError: "--stdin-filename cannot be combined with path operands",
      },
    );
  });

  it("parses an informational-looking stdin filename as the stdin operand", () => {
    expect(parseCheckArgs(["check", "--stdin-filename", "--version"])).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze([]),
      stdinFilename: "--version",
      isolated: false,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it.each([
    ["separate form", ["check", "--config"]],
    ["equals form", ["check", "--config="]],
    ["known option token", ["check", "--config", "--isolated", "workflow.js"]],
  ] as const)("rejects --config without a value in %s", (_caseName, args) => {
    expect(parseCheckArgs(args)).toEqual({ ok: false, usageError: "missing value for --config" });
  });

  it.each([
    [
      "output format",
      ["check", "--output-format", "--config", "workflow.js"],
      "missing value for --output-format",
    ],
    [
      "max warnings",
      ["check", "--max-warnings", "--config", "workflow.js"],
      "missing value for --max-warnings",
    ],
    [
      "output file",
      ["check", "--output-file", "--config", "workflow.js"],
      "missing value for --output-file",
    ],
    [
      "stdin filename",
      ["check", "--stdin-filename", "--config"],
      "missing value for --stdin-filename",
    ],
  ] as const)("rejects known option tokens as %s values", (_caseName, args, usageError) => {
    expect(parseCheckArgs(args)).toEqual({ ok: false, usageError });
  });

  it("parses --isolated", () => {
    expect(parseCheckArgs(["check", "--isolated", "workflow.js"])).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      isolated: true,
      strictClaude: false,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it("parses --strict-claude", () => {
    expect(parseCheckArgs(["check", "--strict-claude", "workflow.js"])).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      isolated: false,
      strictClaude: true,
      ...DEFAULT_EXIT_POLICY,
    });
  });

  it("parses --exit-zero", () => {
    expect(parseCheckArgs(["check", "--exit-zero", "workflow.js"])).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      isolated: false,
      strictClaude: false,
      exitZero: true,
      exitNonZeroOnFix: false,
      forceExclude: false,
      respectGitignore: true,
    });
  });

  it("parses --exit-non-zero-on-fix", () => {
    expect(parseCheckArgs(["check", "--exit-non-zero-on-fix", "workflow.js"])).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      isolated: false,
      strictClaude: false,
      exitZero: false,
      exitNonZeroOnFix: true,
      forceExclude: false,
      respectGitignore: true,
    });
  });

  it("parses --force-exclude", () => {
    expect(parseCheckArgs(["check", "--force-exclude", "workflow.js"])).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      isolated: false,
      strictClaude: false,
      exitZero: false,
      exitNonZeroOnFix: false,
      forceExclude: true,
      respectGitignore: true,
    });
  });

  it("does not treat informational flags after path operands as actions", () => {
    expect(parseCheckArgs(["check", "workflow.js", "--version"])).toEqual({
      ok: false,
      usageError: "unknown option: --version",
    });
  });

  it("parses gitignore posture flags with last-wins semantics", () => {
    expect(
      parseCheckArgs(["check", "--no-respect-gitignore", "--respect-gitignore", "workflow.js"]),
    ).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      isolated: false,
      strictClaude: false,
      exitZero: false,
      exitNonZeroOnFix: false,
      forceExclude: false,
      respectGitignore: true,
    });

    expect(
      parseCheckArgs(["check", "--respect-gitignore", "--no-respect-gitignore", "workflow.js"]),
    ).toEqual({
      ok: true,
      outputFormat: "full",
      paths: Object.freeze(["workflow.js"]),
      isolated: false,
      strictClaude: false,
      exitZero: false,
      exitNonZeroOnFix: false,
      forceExclude: false,
      respectGitignore: false,
    });
  });

  it("keeps check-args as the only check parser module", () => {
    expect(existsSync(ORPHANED_CHECK_ARGS_MODULE)).toBe(false);
  });
});

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

const ORPHANED_CHECK_ARGS_MODULE = join(repositoryRoot, "src/cli/check-cli-args.ts");
