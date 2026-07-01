/**
 * @file Unit tests for shared build-gate Git support.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
  createGitRunner,
  type GitCommandResult,
  type GitRunner,
  type GitRunnerOptions,
  lsTrackedFiles,
  parseNulSeparatedPaths,
} from "./git-support";

type Assert<T extends true> = T;
type IsAssignable<Actual, Expected> = Actual extends Expected ? true : false;

type _GitCommandResultContract = Assert<
  IsAssignable<
    {
      readonly status: number | null;
      readonly signal: NodeJS.Signals | null;
      readonly stdout: string;
      readonly stderr: string;
      readonly error?: NodeJS.ErrnoException;
    },
    GitCommandResult
  >
>;
type _GitRunnerContract = Assert<
  IsAssignable<
    {
      readonly run: (args: readonly string[]) => GitCommandResult;
    },
    GitRunner
  >
>;
type _GitRunnerOptionsContract = Assert<
  IsAssignable<
    {
      readonly timeoutMs?: number;
      readonly maxBufferBytes?: number;
    },
    GitRunnerOptions
  >
>;
type _GitRunnerRunArgsContract = Assert<
  IsAssignable<Parameters<GitRunner["run"]>, [readonly string[]]>
>;

const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

/** Create and register one temporary directory for automatic cleanup. */
function createTemporaryDirectory(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  temporaryPaths.push(path);
  return path;
}

/** Create a fake `git` executable that records runner options and args. */
function createCapturingFakeGit(): {
  readonly binPath: string;
  readonly capturePath: string;
} {
  const root = createTemporaryDirectory("odw-lint-git-support-test-");
  const binPath = join(root, "bin");
  const capturePath = join(root, "capture.json");
  const gitPath = join(binPath, "git");

  mkdirSync(binPath, { recursive: true });
  writeFileSync(
    gitPath,
    [
      "#!/bin/sh",
      'printf \'{"args":[\' > "$CAPTURE_PATH"',
      "first=1",
      'for arg in "$@"; do',
      '  if [ "$first" -eq 0 ]; then printf \',\' >> "$CAPTURE_PATH"; fi',
      "  first=0",
      "  escaped=$(printf '%s' \"$arg\" | sed 's/\\\\/\\\\\\\\/g; s/\"/\\\\\"/g')",
      '  printf \'"%s"\' "$escaped" >> "$CAPTURE_PATH"',
      "done",
      'printf \'],"prompt":"%s","pwd":"%s"}\' "$GIT_TERMINAL_PROMPT" "$PWD" >> "$CAPTURE_PATH"',
      "printf 'tracked\\0café\\0'",
    ].join("\n"),
    { mode: 0o755 },
  );

  return { binPath, capturePath };
}

/** Create a fake `git` executable that sleeps until the runner timeout kills it. */
function createSleepingFakeGit(): string {
  const root = createTemporaryDirectory("odw-lint-git-support-sleep-test-");
  const binPath = join(root, "bin");
  const gitPath = join(binPath, "git");

  mkdirSync(binPath, { recursive: true });
  writeFileSync(gitPath, "#!/bin/sh\nwhile :; do :; done\n", { mode: 0o755 });

  return binPath;
}

// These tests rely on Bun running this file sequentially. Concurrent tests
// would race on process-wide `PATH` and `CAPTURE_PATH` mutations.
/** Temporarily override process environment values for one assertion. */
function withEnvironment<T>(values: Record<string, string>, action: () => T): T {
  const previousValues = new Map(
    Object.keys(values).map((name) => [name, process.env[name]] as const),
  );

  try {
    Object.assign(process.env, values);
    return action();
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

/** Capture one thrown error message for stable diagnostic assertions. */
function captureErrorMessage(action: () => void): string {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  throw new Error("expected action to throw");
}

describe("parseNulSeparatedPaths", () => {
  it("parses NUL-separated Git path output", () => {
    expect(parseNulSeparatedPaths("src/index.ts\0tests/example.test.ts\0")).toEqual([
      "src/index.ts",
      "tests/example.test.ts",
    ]);
  });

  it("parses NUL-separated Git path output without a trailing separator", () => {
    expect(parseNulSeparatedPaths("src/index.ts\0tests/example.test.ts")).toEqual([
      "src/index.ts",
      "tests/example.test.ts",
    ]);
  });

  it("removes empty separator segments from Git path streams", () => {
    expect(parseNulSeparatedPaths("src/a.ts\0tests/b.ts\0\0")).toEqual(["src/a.ts", "tests/b.ts"]);
  });
});

describe("lsTrackedFiles", () => {
  it("runs the shared tracked-file query without pathspecs", () => {
    const calls: string[][] = [];
    const git: GitRunner = {
      run: (args) => {
        calls.push([...args]);
        return { status: 0, signal: null, stdout: "src/index.ts\0", stderr: "" };
      },
    };

    expect(lsTrackedFiles({ gitRunner: git })).toEqual(["src/index.ts"]);
    expect(calls).toEqual([["ls-files", "-z", "--full-name"]]);
  });

  it("runs the shared tracked-file query with pathspecs", () => {
    const calls: string[][] = [];
    const git: GitRunner = {
      run: (args) => {
        calls.push([...args]);
        return {
          status: 0,
          signal: null,
          stdout: "src/index.ts\0tests/example.test.ts\0",
          stderr: "",
        };
      },
    };

    expect(lsTrackedFiles({ pathspecs: ["src", "tests"], gitRunner: git })).toEqual([
      "src/index.ts",
      "tests/example.test.ts",
    ]);
    expect(calls).toEqual([["ls-files", "-z", "--full-name", "--", "src", "tests"]]);
  });

  it("converts non-zero Git listings into project-owned errors", () => {
    const git: GitRunner = {
      run: (): GitCommandResult => ({
        status: 128,
        signal: null,
        stdout: "",
        stderr: "fatal: not a git repository",
      }),
    };

    expect(
      captureErrorMessage(() => lsTrackedFiles({ pathspecs: ["src", "tests"], gitRunner: git })),
    ).toMatchInlineSnapshot(
      `"git ls-files -z --full-name -- src tests failed with status 128: fatal: not a git repository"`,
    );
  });

  it("converts failed Git spawns into project-owned errors", () => {
    const git: GitRunner = {
      run: (): GitCommandResult => ({
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        error: new Error("spawn git ENOENT"),
      }),
    };

    expect(captureErrorMessage(() => lsTrackedFiles({ gitRunner: git }))).toMatchInlineSnapshot(
      `"git ls-files -z --full-name failed: spawn git ENOENT"`,
    );
  });

  it("surfaces child process signals in project-owned errors", () => {
    const git: GitRunner = {
      run: (): GitCommandResult => ({
        status: null,
        signal: "SIGTERM",
        stdout: "",
        stderr: "",
      }),
    };

    expect(captureErrorMessage(() => lsTrackedFiles({ gitRunner: git }))).toMatchInlineSnapshot(
      `"git ls-files -z --full-name failed with signal SIGTERM: "`,
    );
  });
});

describe("createGitRunner", () => {
  it("runs Git with prompts disabled, UTF-8 output, and a repository cwd", () => {
    const repositoryPath = createTemporaryDirectory("odw-lint-git-support-repo-");
    const fakeGit = createCapturingFakeGit();
    const { PATH: originalPath = "" } = process.env;
    const result = withEnvironment(
      {
        CAPTURE_PATH: fakeGit.capturePath,
        PATH: `${fakeGit.binPath}${delimiter}${originalPath}`,
      },
      () => createGitRunner(repositoryPath).run(["status", "--short", 'café"\\']),
    );

    expect(result).toEqual({
      status: 0,
      signal: null,
      stdout: "tracked\0café\0",
      stderr: "",
    });
    const payload = JSON.parse(readFileSync(fakeGit.capturePath, "utf8")) as {
      readonly args: unknown;
      readonly prompt: unknown;
      readonly pwd: unknown;
    };

    expect(realpathSync(String(payload.pwd))).toBe(realpathSync(repositoryPath));
    expect({ ...payload, pwd: "<repository>" }).toMatchInlineSnapshot(`
      {
        "args": [
          "status",
          "--short",
          "café"\\",
        ],
        "prompt": "0",
        "pwd": "<repository>",
      }
    `);
  });

  it("normalizes missing executable output to strings while preserving errors", () => {
    const repositoryPath = createTemporaryDirectory("odw-lint-git-support-repo-");
    const emptyBinPath = join(createTemporaryDirectory("odw-lint-git-support-empty-bin-"), "bin");

    mkdirSync(emptyBinPath, { recursive: true });

    const result = withEnvironment({ PATH: emptyBinPath }, () =>
      createGitRunner(repositoryPath).run(["status"]),
    );

    expect(result.status).toBeNull();
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.error).toBeInstanceOf(Error);
  });

  it("allows focused tests to use a short timeout", () => {
    const repositoryPath = createTemporaryDirectory("odw-lint-git-support-repo-");
    const sleepingGitBinPath = createSleepingFakeGit();
    const result = withEnvironment({ PATH: sleepingGitBinPath }, () =>
      createGitRunner(repositoryPath, { timeoutMs: 150 }).run(["status"]),
    );

    expect(result.status).toBeNull();
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.error).toBeInstanceOf(Error);
  });

  it("allows focused tests to override the output buffer", () => {
    const repositoryPath = createTemporaryDirectory("odw-lint-git-support-repo-");
    const fakeGit = createCapturingFakeGit();
    const result = withEnvironment(
      {
        CAPTURE_PATH: fakeGit.capturePath,
        PATH: fakeGit.binPath,
      },
      () => createGitRunner(repositoryPath, { maxBufferBytes: 4 }).run(["status"]),
    );

    expect(result.status).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});
