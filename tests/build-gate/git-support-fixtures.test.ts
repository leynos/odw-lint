/**
 * @file Unit tests for shared build-gate Git fixture support.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  commitAll,
  createCapturedCliOutput,
  createGitRunner,
  createTemporaryRepository,
  runFixtureGit,
  writeRepositoryFile,
} from "./git-support";

const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

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

describe("temporary repository support", () => {
  it("initializes a repository with deterministic commit identity", () => {
    const repositoryPath = createTemporaryRepository({
      prefix: "odw-lint-git-support-test-repo-",
      initialBranch: "main",
      userName: "Git Support Test",
      userEmail: "git-support@example.test",
    });
    temporaryPaths.push(repositoryPath);

    const branchName = createGitRunner(repositoryPath).run(["branch", "--show-current"]);
    const userName = createGitRunner(repositoryPath).run(["config", "user.name"]);
    const userEmail = createGitRunner(repositoryPath).run(["config", "user.email"]);

    expect(branchName.stdout.trim()).toBe("main");
    expect(userName.stdout.trim()).toBe("Git Support Test");
    expect(userEmail.stdout.trim()).toBe("git-support@example.test");
  });

  it("writes string and Buffer content under repository-relative paths", () => {
    const repositoryPath = createTemporaryRepository();
    temporaryPaths.push(repositoryPath);

    writeRepositoryFile(repositoryPath, "nested/text.txt", "hello\n");
    writeRepositoryFile(repositoryPath, "nested/binary.dat", Buffer.from([0x62, 0x00]));

    expect(readFileSync(join(repositoryPath, "nested/text.txt"), "utf8")).toBe("hello\n");
    expect(readFileSync(join(repositoryPath, "nested/binary.dat"))).toEqual(
      Buffer.from([0x62, 0x00]),
    );
  });

  it("stages and commits all fixture changes", () => {
    const repositoryPath = createTemporaryRepository();
    temporaryPaths.push(repositoryPath);

    writeRepositoryFile(repositoryPath, "tracked.txt", "tracked\n");
    commitAll(repositoryPath, "Track file");

    const log = createGitRunner(repositoryPath).run(["log", "--oneline", "-1"]);
    const status = createGitRunner(repositoryPath).run(["status", "--porcelain=v1"]);

    expect(log.stdout).toContain("Track file");
    expect(status.stdout).toBe("");
  });

  it("reports fixture Git failures with command, cwd, stdout, and stderr", () => {
    const repositoryPath = createTemporaryRepository();
    temporaryPaths.push(repositoryPath);

    const message = captureErrorMessage(() => runFixtureGit(repositoryPath, ["not-a-command"]));

    expect(message.replace(repositoryPath, "<repository>")).toMatchInlineSnapshot(`
"git not-a-command failed in <repository>
status: 1
signal: null
stdout: <empty>
stderr: git: 'not-a-command' is not a git command. See 'git --help'.

error: <empty>"
`);
  });
});

describe("createCapturedCliOutput", () => {
  it("captures stdout and stderr independently", () => {
    const output = createCapturedCliOutput();

    output.writeOut("one");
    output.writeErr("two");
    output.writeOut(" three");

    expect(output.stdout).toBe("one three");
    expect(output.stderr).toBe("two");
  });
});
