/**
 * @file Git-backed branch-freshness guard tests.
 */

import { describe, expect, it } from "bun:test";
import {
  checkBranchFreshness,
  exitCodeForBranchFreshness,
  runBranchFreshnessCli,
} from "./branch-freshness-git";
import {
  checkoutTaskBranch,
  commitMainChange,
  commitRoadmapChange,
  createCapturedCliOutput,
  createGitFixture,
  deleteMainRoadmap,
  mergeMainIntoTask,
  renameMainPath,
  writeRepositoryFile,
} from "./branch-freshness-git-fixtures";
import { parseNameStatusZ, parseRoadmapDiffHunks } from "./branch-freshness-git-parsing";

describe("Git branch-freshness parsing", () => {
  it("parses normal, rename, and copy name-status records", () => {
    expect(
      parseNameStatusZ("M\0docs/a.md\0R100\0docs/a.md\0docs/b.md\0C80\0tests/a.ts\0tests/b.ts\0"),
    ).toEqual([
      { status: "M", path: "docs/a.md" },
      { status: "R100", previousPath: "docs/a.md", path: "docs/b.md" },
      { status: "C80", previousPath: "tests/a.ts", path: "tests/b.ts" },
    ]);
  });

  it("parses roadmap hunks from zero-context patches", () => {
    expect(
      parseRoadmapDiffHunks(
        [
          "diff --git a/docs/roadmap.md b/docs/roadmap.md",
          "@@ -4,0 +5,2 @@",
          "+new line",
          "@@ -12 +14 @@",
          "-old line",
        ].join("\n"),
      ),
    ).toEqual([
      { oldStart: 4, oldLength: 0, newStart: 5, newLength: 2 },
      { oldStart: 12, oldLength: 1, newStart: 14, newLength: 1 },
    ]);
  });
});

describe("Git-backed branch-freshness guard", () => {
  it("passes a fresh roadmap branch that already contains origin/main", () => {
    withFixture((fixture) => {
      commitMainChange(
        fixture,
        "docs/technical-design.md",
        "# Technical Design\n\nCurrent design.\n",
      );
      mergeMainIntoTask(fixture);

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result).toEqual({ status: "fresh", taskId: "1.5.2" });
      expect(exitCodeForBranchFreshness(result)).toBe(0);
    });
  });

  it("fails when origin/main changed another roadmap task block", () => {
    withFixture((fixture) => {
      commitRoadmapChange(fixture, (roadmap) =>
        roadmap.replace(
          "- [ ] 1.5.3. Follow-up task.",
          "- [ ] 1.5.3. Follow-up task.\n  - Upstream follow-up changed.",
        ),
      );

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result.status).toBe("stale");
      expect(result).toMatchObject({
        taskId: "1.5.2",
        findings: [{ path: "docs/roadmap.md" }],
      });
      expect(exitCodeForBranchFreshness(result)).toBe(1);
    });
  });

  it("fails when origin/main changed a main-only protected docs path", () => {
    withFixture((fixture) => {
      commitMainChange(fixture, "docs/developers-guide.md", "# Developers Guide\n\nUpdated.\n");

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result.status).toBe("stale");
      expect(result).toMatchObject({
        findings: [{ path: "docs/developers-guide.md" }],
      });
    });
  });

  it("fails when origin/main changed a main-only protected tests path", () => {
    withFixture((fixture) => {
      commitMainChange(
        fixture,
        "tests/new-behaviour.test.ts",
        "import { it } from 'bun:test';\n\nit('passes', () => {});\n",
      );

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result.status).toBe("stale");
      expect(result).toMatchObject({
        findings: [{ path: "tests/new-behaviour.test.ts" }],
      });
    });
  });

  it("fails with all unrelated protected upstream paths", () => {
    withFixture((fixture) => {
      commitMainChange(fixture, "docs/developers-guide.md", "# Developers Guide\n\nUpdated.\n");
      commitMainChange(
        fixture,
        "tests/new-behaviour.test.ts",
        "import { it } from 'bun:test';\n\nit('passes', () => {});\n",
      );

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result.status).toBe("stale");
      expect(result).toMatchObject({
        findings: [{ path: "docs/developers-guide.md" }, { path: "tests/new-behaviour.test.ts" }],
      });
    });
  });

  it("fails when origin/main renames a protected path", () => {
    withFixture((fixture) => {
      renameMainPath(fixture, "docs/technical-design.md", "docs/architecture.md");

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result.status).toBe("stale");
      expect(result).toMatchObject({
        findings: [{ path: "docs/technical-design.md" }, { path: "docs/architecture.md" }],
      });
    });
  });

  it("passes behind branches when upstream changed only the declared task scope", () => {
    withFixture((fixture) => {
      commitMainChange(
        fixture,
        "docs/execplans/roadmap-1-5-2.md",
        "# ExecPlan\n\nUpstream task notes.\n",
      );

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result).toEqual({ status: "fresh", taskId: "1.5.2" });
    });
  });

  it("passes behind branches when upstream changed only the declared roadmap block", () => {
    withFixture((fixture) => {
      commitRoadmapChange(fixture, (roadmap) =>
        roadmap.replace(
          "  - Implement the declared guard.",
          "  - Implement the declared guard.\n  - Upstream task note.",
        ),
      );

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result).toEqual({ status: "fresh", taskId: "1.5.2" });
    });
  });

  it("treats upstream roadmap deletion as a stale roadmap change", () => {
    withFixture((fixture) => {
      deleteMainRoadmap(fixture);

      const result = checkBranchFreshness({ cwd: fixture.task });

      expect(result.status).toBe("stale");
      expect(result).toMatchObject({
        findings: [{ path: "docs/roadmap.md" }],
      });
    });
  });

  it("returns usage errors for dirty task worktrees", () => {
    withFixture((fixture) => {
      writeRepositoryFile(fixture.task, "docs/execplans/roadmap-1-5-2.md", "# Dirty\n");

      const output = createCapturedCliOutput();
      const exitCode = runBranchFreshnessCli([], fixture.task, output);

      expect(exitCode).toBe(2);
      expect(output.stderr).toContain("working tree must be clean");
      expect(output.stdout).toBe("");
    });
  });

  it("skips non-roadmap branches without an explicit task override", () => {
    withFixture((fixture) => {
      checkoutTaskBranch(fixture, "feature/build-gate");

      const output = createCapturedCliOutput();
      const exitCode = runBranchFreshnessCli([], fixture.task, output);

      expect(exitCode).toBe(0);
      expect(output.stdout).toContain("Branch freshness check skipped");
      expect(output.stderr).toBe("");
    });
  });

  it("uses explicit task overrides on non-roadmap branches", () => {
    withFixture((fixture) => {
      checkoutTaskBranch(fixture, "feature/build-gate");
      commitMainChange(fixture, "docs/developers-guide.md", "# Developers Guide\n\nUpdated.\n");

      const output = createCapturedCliOutput();
      const exitCode = runBranchFreshnessCli(["--task", "1.5.2"], fixture.task, output);

      expect(exitCode).toBe(1);
      expect(output.stdout).toContain("docs/developers-guide.md");
      expect(output.stderr).toBe("");
    });
  });

  it("maps malformed CLI arguments to usage errors", () => {
    withFixture((fixture) => {
      const output = createCapturedCliOutput();
      const exitCode = runBranchFreshnessCli(["--unknown"], fixture.task, output);

      expect(exitCode).toBe(2);
      expect(output.stderr).toContain("usage: branch-freshness-git.ts");
      expect(output.stdout).toBe("");
    });
  });

  it("maps bare task flags to a missing-value usage error", () => {
    withFixture((fixture) => {
      const output = createCapturedCliOutput();
      const exitCode = runBranchFreshnessCli(["--task"], fixture.task, output);

      expect(exitCode).toBe(2);
      expect(output.stderr).toContain("missing --task value");
      expect(output.stdout).toBe("");
    });
  });
});

/** Run one test body with a disposable Git fixture. */
const withFixture = (
  testBody: (fixture: ReturnType<typeof createGitFixture>) => Promise<void> | void,
): Promise<void> | void => {
  const fixture = createGitFixture();
  let shouldDispose = true;

  try {
    const result = testBody(fixture);

    if (result instanceof Promise) {
      shouldDispose = false;
      return result.finally(() => fixture.dispose());
    }
  } finally {
    if (shouldDispose) {
      fixture.dispose();
    }
  }
};
