/**
 * @file Branch-freshness guard tests.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import {
  type BranchFreshnessResult,
  type ClassifyBranchFreshnessInput,
  classifyBranchFreshness,
  type GitPathChange,
  isProtectedPath,
  isTaskScopedPath,
  parseRoadmapHunkHeader,
  parseRoadmapTaskBlockRange,
  parseRoadmapTaskFromBranch,
  parseTaskOverride,
  type RoadmapHunk,
} from "./branch-freshness";
import { formatBranchFreshnessResult } from "./branch-freshness-report";

const roadmapText = [
  "# Roadmap",
  "",
  "- [ ] 1.5.2. Add a branch-freshness review guard for roadmap tasks.",
  "  - Requires steps 1.1-1.4.",
  "  - Success: review output flags stale task branches.",
  "- [x] 1.5.3. Add a public API removal guard for package exports.",
  "  - Requires 1.2.3.",
].join("\n");

describe("roadmap task parsing", () => {
  it.each([
    ["roadmap-1-5-2", "1.5.2"],
    ["roadmap-12-3-45", "12.3.45"],
  ])("infers %s as %s", (branchName, expectedTaskId) => {
    expect(parseRoadmapTaskFromBranch(branchName)).toBe(expectedTaskId);
  });

  it.each([
    "main",
    "feature-roadmap-1-5-2",
    "roadmap-1.5.2",
    "roadmap-1",
  ])("rejects non-roadmap branch %s", (branchName) => {
    expect(parseRoadmapTaskFromBranch(branchName)).toBeUndefined();
  });

  it.each([
    ["1.5.2", "1.5.2"],
    ["12.3.45", "12.3.45"],
  ])("accepts explicit task override %s", (taskOverride, expectedTaskId) => {
    expect(parseTaskOverride(taskOverride)).toBe(expectedTaskId);
  });

  it.each(["roadmap-1-5-2", "1", "1.5.x"])("rejects invalid task override %s", (taskOverride) => {
    expect(parseTaskOverride(taskOverride)).toBeUndefined();
  });
});

describe("path scope classification", () => {
  it.each([
    ["docs/execplans/roadmap-1-5-2.md", true],
    ["docs/issues/audit-1.5.2.md", true],
    ["docs/issues/audit-1.5.3.md", false],
    ["docs/developers-guide.md", false],
  ])("classifies task-scoped path %s", (path, expected) => {
    expect(isTaskScopedPath(path, "1.5.2")).toBe(expected);
  });

  it.each([
    ["docs/roadmap.md", true],
    ["tests/build-gate/makefile.test.ts", true],
    ["src/index.ts", false],
  ])("classifies protected path %s", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe("roadmap hunk classification", () => {
  it("parses the declared task block with continuation lines", () => {
    expect(parseRoadmapTaskBlockRange(roadmapText, "1.5.2")).toEqual({
      start: 3,
      end: 5,
    });
  });

  it.each([
    ["@@ -5 +5 @@", { oldStart: 5, oldLength: 1, newStart: 5, newLength: 1 }],
    ["@@ -10,2 +10,3 @@", { oldStart: 10, oldLength: 2, newStart: 10, newLength: 3 }],
  ])("parses hunk header %s", (header, expected) => {
    expect(parseRoadmapHunkHeader(header)).toEqual(expected);
  });

  it("accepts a roadmap hunk inside the declared task block", () => {
    expect(
      classifyWithRoadmapHunks([{ oldStart: 99, oldLength: 0, newStart: 3, newLength: 1 }]),
    ).toEqual({
      status: "fresh",
      taskId: "1.5.2",
    });
  });

  it("rejects a roadmap hunk outside the declared task block", () => {
    const result = classifyWithRoadmapHunks([
      { oldStart: 3, oldLength: 1, newStart: 6, newLength: 1 },
    ]);

    expect(result.status).toBe("stale");
    expect(result).toMatchObject({
      findings: [{ path: "docs/roadmap.md" }],
    });
  });

  it("fails closed when the roadmap changed but no hunks were supplied", () => {
    const result = classifyWithRoadmapHunks([]);

    expect(result.status).toBe("stale");
    expect(result).toMatchObject({
      findings: [
        {
          path: "docs/roadmap.md",
          reason: "origin/main changed the roadmap but no roadmap hunks were found",
        },
      ],
    });
  });

  it("accepts a deletion at the first old-side line of the declared task block", () => {
    const result = classifyBranchFreshness({
      taskId: "1.5.2",
      isOriginMainAncestor: false,
      upstreamChanges: [{ status: "M", path: "docs/roadmap.md" }],
      roadmapText: roadmapText.replace(
        "- [ ] 1.5.2. Add a branch-freshness review guard for roadmap tasks.\n",
        "",
      ),
      oldRoadmapText: roadmapText,
      roadmapHunks: [{ oldStart: 3, oldLength: 1, newStart: 2, newLength: 0 }],
    });

    expect(result).toEqual({ status: "fresh", taskId: "1.5.2" });
  });
});

describe("pure branch-freshness classification", () => {
  it("returns skipped results before classifying branch freshness", () => {
    const result = classifyBranchFreshness({
      taskId: "1.5.2",
      skipReason: "current branch is not a roadmap task branch",
      isOriginMainAncestor: false,
      upstreamChanges: [{ status: "A", path: "docs/new-main-work.md" }],
      roadmapText,
      roadmapHunks: [],
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "current branch is not a roadmap task branch",
    });
  });

  it("returns usage errors before classifying branch freshness", () => {
    const result = classifyBranchFreshness({
      taskId: "1.5.2",
      usageError: "working tree must be clean before checking branch freshness",
      isOriginMainAncestor: false,
      upstreamChanges: [{ status: "A", path: "docs/new-main-work.md" }],
      roadmapText,
      roadmapHunks: [],
    });

    expect(result).toEqual({
      status: "usage-error",
      message: "working tree must be clean before checking branch freshness",
    });
  });

  it("prioritises usage errors over skipped branches", () => {
    const result = classifyBranchFreshness({
      taskId: "1.5.2",
      skipReason: "current branch is not a roadmap task branch",
      usageError: "working tree must be clean before checking branch freshness",
      isOriginMainAncestor: false,
      upstreamChanges: [{ status: "A", path: "docs/new-main-work.md" }],
      roadmapText,
      roadmapHunks: [],
    });

    expect(result).toEqual({
      status: "usage-error",
      message: "working tree must be clean before checking branch freshness",
    });
  });

  it("is fresh when origin/main is already contained by ancestry", () => {
    const result = classifyBranchFreshness({
      taskId: "1.5.2",
      isOriginMainAncestor: true,
      upstreamChanges: [{ status: "A", path: "docs/new-main-work.md" }],
      roadmapText,
      roadmapHunks: [{ oldStart: 6, oldLength: 1, newStart: 6, newLength: 1 }],
    });

    expect(result).toEqual({ status: "fresh", taskId: "1.5.2" });
  });

  it.each([
    ["docs/new-main-work.md"],
    ["tests/new-main-work.test.ts"],
  ])("flags a main-only protected addition outside task scope at %s", (path) => {
    const result = classifyWithProtectedChanges([{ status: "A", path }]);

    expect(result.status).toBe("stale");
    expect(result).toMatchObject({
      findings: [{ path, reason: "protected upstream change is outside the declared task scope" }],
    });
  });

  it("flags different protected paths changed on main and branch as stale", () => {
    const result = classifyWithProtectedChanges([
      { status: "M", path: "docs/developers-guide.md" },
    ]);

    expect(result.status).toBe("stale");
    expect(result).toMatchObject({
      findings: [{ path: "docs/developers-guide.md" }],
    });
  });

  it("flags protected rename and copy destinations outside task scope", () => {
    const result = classifyWithProtectedChanges([
      {
        status: "R100",
        previousPath: "src/old-helper.ts",
        path: "docs/new-main-work.md",
      },
    ]);

    expect(result.status).toBe("stale");
    expect(result).toMatchObject({
      findings: [{ path: "docs/new-main-work.md" }],
    });
  });

  it("accepts behind branches when upstream protected changes are task-scoped", () => {
    expect(
      classifyWithProtectedChanges([
        { status: "M", path: "docs/execplans/roadmap-1-5-2.md" },
        { status: "M", path: "docs/issues/audit-1.5.2.md" },
      ]),
    ).toEqual({ status: "fresh", taskId: "1.5.2" });
  });

  it("formats stale findings with stable recovery wording", () => {
    const result = classifyWithProtectedChanges([{ status: "A", path: "docs/new-main-work.md" }]);

    expect(formatBranchFreshnessResult(result)).toContain(
      "Fetch, then rebase or merge current origin/main before review.",
    );
    expect(formatBranchFreshnessResult(result)).toMatchInlineSnapshot(`
"Branch freshness check failed for roadmap task 1.5.2.
- docs/new-main-work.md: protected upstream change is outside the declared task scope. Fetch, then rebase or merge current origin/main before review.
"
`);
  });

  it("keeps the exported result discriminants type-checkable", () => {
    const result = {
      status: "stale",
      taskId: "1.5.2",
      findings: [
        {
          path: "docs/new-main-work.md",
          reason: "protected upstream change is outside the declared task scope",
          detail: "Fetch, then rebase or merge current origin/main before review.",
        },
      ],
    } satisfies BranchFreshnessResult;

    expect(formatBranchFreshnessResult(result)).toContain("docs/new-main-work.md");
  });

  it("keeps exported input field shapes type-checkable", () => {
    expectTypeOf<GitPathChange>().toEqualTypeOf<{
      readonly path: string;
      readonly previousPath?: string;
      readonly status: string;
    }>();
    expectTypeOf<RoadmapHunk>().toEqualTypeOf<{
      readonly oldStart: number;
      readonly oldLength: number;
      readonly newStart: number;
      readonly newLength: number;
    }>();
    expectTypeOf<ClassifyBranchFreshnessInput>().toMatchTypeOf<{
      readonly taskId: string;
      readonly isOriginMainAncestor: boolean;
      readonly upstreamChanges: readonly GitPathChange[];
      readonly roadmapText: string;
      readonly oldRoadmapText?: string;
      readonly roadmapHunks: readonly RoadmapHunk[];
    }>();
  });
});

/** Classify non-roadmap upstream changes with the standard test task id. */
const classifyWithProtectedChanges = (upstreamChanges: readonly GitPathChange[]) => {
  return classifyBranchFreshness({
    taskId: "1.5.2",
    isOriginMainAncestor: false,
    upstreamChanges,
    roadmapText,
    roadmapHunks: [],
  });
};

/** Classify roadmap upstream hunks with the standard test task id. */
const classifyWithRoadmapHunks = (roadmapHunks: readonly RoadmapHunk[]) => {
  return classifyBranchFreshness({
    taskId: "1.5.2",
    isOriginMainAncestor: false,
    upstreamChanges: [{ status: "M", path: "docs/roadmap.md" }],
    roadmapText,
    roadmapHunks,
  });
};
