/**
 * @file Linter configuration file loading tests.
 */

import { describe, expect, it } from "bun:test";
import { type ConfigFileReader, DEFAULT_CONFIG_FILENAME, loadLinterConfig } from "odw-lint";

/** Creates an injected filesystem error without touching the real filesystem. */
const errorWithCode = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(code), { code });

describe("linter configuration loading", () => {
  it("loads an explicit valid config file and surfaces validation warnings", () => {
    const readPaths: string[] = [];
    const result = loadLinterConfig({
      configPath: "config/odw-lint.json",
      readConfigFile: (filePath) => {
        readPaths.push(filePath);
        return JSON.stringify({
          strictClaude: true,
          futureOption: "accepted for now",
        });
      },
    });

    expect(readPaths).toEqual(["config/odw-lint.json"]);
    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected explicit config to load.");
    }
    expect(result.config.strictClaude).toBeTrue();
    expect(result.warnings).toEqual([
      expect.objectContaining({ kind: "unknown-key", key: "futureOption" }),
    ]);
  });

  it("treats a missing explicit config file as a read error", () => {
    const result = loadLinterConfig({
      configPath: "missing.json",
      readConfigFile: () => {
        throw errorWithCode("ENOENT");
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "read-failed",
        filePath: "missing.json",
        reason: "not-found",
      },
    });
  });

  it("reports malformed explicit JSON as a parse error", () => {
    const result = loadLinterConfig({
      configPath: "bad.json",
      readConfigFile: () => "{",
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "parse-failed",
        filePath: "bad.json",
      },
    });
  });

  it("reports configuration validation errors from an explicit file", () => {
    const result = loadLinterConfig({
      configPath: "bad-rules.json",
      readConfigFile: () =>
        JSON.stringify({
          rules: {
            "odw/not-a-real-rule": "warning",
          },
        }),
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected invalid config to fail.");
    }
    expect(result.error.kind).toBe("invalid-config");
    if (result.error.kind !== "invalid-config") {
      throw new Error("Expected invalid-config error.");
    }
    expect(result.error.errors).toContainEqual(
      expect.objectContaining({
        kind: "unknown-rule-id",
        key: "odw/not-a-real-rule",
      }),
    );
  });

  it("treats an absent discovered default config as an empty config", () => {
    const readPaths: string[] = [];
    const result = loadLinterConfig({
      cwd: "/repo",
      readConfigFile: (filePath) => {
        readPaths.push(filePath);
        throw errorWithCode("ENOENT");
      },
    });

    expect(readPaths).toEqual([`/repo/${DEFAULT_CONFIG_FILENAME}`]);
    expect(result).toEqual({ ok: true, config: {}, warnings: [] });
  });

  it("loads a discovered default config from the working directory", () => {
    const result = loadLinterConfig({
      cwd: "/repo",
      readConfigFile: (filePath) => {
        expect(filePath).toBe(`/repo/${DEFAULT_CONFIG_FILENAME}`);
        return JSON.stringify({ include: ["workflows/**/*.js"] });
      },
    });

    expect(result).toEqual({
      ok: true,
      config: {
        include: ["workflows/**/*.js"],
      },
      warnings: [],
    });
  });

  it("reports malformed discovered default JSON as a parse error", () => {
    const result = loadLinterConfig({
      cwd: "/repo",
      readConfigFile: () => "{",
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "parse-failed",
        filePath: `/repo/${DEFAULT_CONFIG_FILENAME}`,
      },
    });
  });

  it("does not read a config file in isolated mode", () => {
    const readConfigFile: ConfigFileReader = () => {
      throw new Error("isolated mode must not read configuration files.");
    };

    expect(
      loadLinterConfig({
        isolated: true,
        readConfigFile,
      }),
    ).toEqual({ ok: true, config: {}, warnings: [] });
  });

  it("rejects isolated mode with an explicit config path", () => {
    expect(
      loadLinterConfig({
        configPath: "odw-lint.json",
        isolated: true,
      }),
    ).toMatchObject({
      ok: false,
      error: {
        kind: "usage-error",
      },
    });
  });
});
