/**
 * @file Roadmap branch-freshness classification helpers.
 */

/** Git path changed on current `origin/main`. */
export type GitPathChange = {
  readonly path: string;
  readonly previousPath?: string;
  readonly status: string;
};

/** Roadmap hunk from a zero-context Git diff. */
export type RoadmapHunk = {
  readonly oldStart: number;
  readonly oldLength: number;
  readonly newStart: number;
  readonly newLength: number;
};

/** Reviewer-facing branch-freshness finding. */
export type BranchFreshnessFinding = {
  readonly path: string;
  readonly reason: string;
  readonly detail: string;
};

/** Pure branch-freshness classification result. */
export type BranchFreshnessResult =
  | { readonly status: "fresh"; readonly taskId: string }
  | { readonly status: "skipped"; readonly reason: string }
  | {
      readonly status: "stale";
      readonly taskId: string;
      readonly findings: readonly BranchFreshnessFinding[];
    }
  | { readonly status: "usage-error"; readonly message: string };

/** Inputs for pure branch-freshness classification. */
export type ClassifyBranchFreshnessInput = {
  readonly taskId: string;
  readonly skipReason?: string;
  readonly usageError?: string;
  readonly isOriginMainAncestor: boolean;
  readonly upstreamChanges: readonly GitPathChange[];
  readonly roadmapText: string;
  readonly oldRoadmapText?: string;
  readonly roadmapHunks: readonly RoadmapHunk[];
};

type TaskScope = {
  readonly taskId: string;
  readonly taskSlug: string;
};

type LineRange = {
  readonly start: number;
  readonly end: number;
};

type RoadmapTaskMatchGroups = {
  readonly taskId: string;
};

type RoadmapBranchMatchGroups = {
  readonly slug: string;
};

type HunkMatchGroups = {
  readonly oldStart: string;
  readonly oldLength?: string;
  readonly newStart: string;
  readonly newLength?: string;
};

const roadmapTaskPattern = /^- \[[ xX]\] (?<taskId>\d+(?:\.\d+)+)\. /;
const hunkPattern =
  /^@@ -(?<oldStart>\d+)(?:,(?<oldLength>\d+))? \+(?<newStart>\d+)(?:,(?<newLength>\d+))? @@/;

/**
 * Infer a roadmap task id from the branch naming convention.
 *
 * @param branchName Branch name reported by Git.
 * @returns Dotted task id when the branch follows the roadmap convention.
 */
export function parseRoadmapTaskFromBranch(branchName: string): string | undefined {
  const match = /^roadmap-(?<slug>\d+(?:-\d+)+)$/.exec(branchName);
  const groups = match?.groups as RoadmapBranchMatchGroups | undefined;

  return groups?.slug.replaceAll("-", ".");
}

/**
 * Validate an explicit roadmap task override.
 *
 * @param taskOverride User-supplied dotted task id.
 * @returns Dotted task id when the override is valid.
 */
export function parseTaskOverride(taskOverride: string): string | undefined {
  if (/^\d+(?:\.\d+)+$/.test(taskOverride)) {
    return taskOverride;
  }

  return undefined;
}

/**
 * Decide whether a path is covered by the declared roadmap task scope.
 *
 * @param path Repository-relative path from Git.
 * @param taskId Dotted roadmap task id.
 * @returns True when the path belongs to the declared task.
 */
export function isTaskScopedPath(path: string, taskId: string): boolean {
  const scope = makeTaskScope(taskId);

  return (
    path === `docs/execplans/roadmap-${scope.taskSlug}.md` ||
    path === `docs/issues/audit-${scope.taskId}.md`
  );
}

/**
 * Decide whether the freshness guard protects a repository path.
 *
 * @param path Repository-relative path from Git.
 * @returns True when the path is inside a protected review surface.
 */
export function isProtectedPath(path: string): boolean {
  return (
    path === "docs" || path.startsWith("docs/") || path === "tests" || path.startsWith("tests/")
  );
}

/**
 * Parse the line range occupied by a roadmap task block.
 *
 * @param roadmapText Roadmap content from current `origin/main`.
 * @param taskId Dotted roadmap task id.
 * @returns One-indexed inclusive line range for the task block.
 */
export function parseRoadmapTaskBlockRange(
  roadmapText: string,
  taskId: string,
): LineRange | undefined {
  const lines = roadmapText.split("\n");
  const startIndex = lines.findIndex((line) => parseRoadmapTaskLine(line) === taskId);

  if (startIndex < 0) {
    return undefined;
  }

  return {
    start: startIndex + 1,
    end: findTaskBlockEnd(lines, startIndex),
  };
}

/**
 * Parse a zero-context Git diff hunk header.
 *
 * @param header Hunk header emitted by `git diff --unified=0`.
 * @returns Parsed old and new ranges when the header is supported.
 */
export function parseRoadmapHunkHeader(header: string): RoadmapHunk | undefined {
  const match = hunkPattern.exec(header);

  if (match?.groups === undefined) {
    return undefined;
  }
  const groups = match.groups as HunkMatchGroups;

  return {
    oldStart: Number(groups.oldStart),
    oldLength: parseLength(groups.oldLength),
    newStart: Number(groups.newStart),
    newLength: parseLength(groups.newLength),
  };
}

/**
 * Classify upstream protected changes for a roadmap task branch.
 *
 * @param input Pure branch and upstream-change facts.
 * @returns Freshness result for reviewer-facing output.
 */
export function classifyBranchFreshness(
  input: ClassifyBranchFreshnessInput,
): BranchFreshnessResult {
  if (input.usageError !== undefined) {
    return { status: "usage-error", message: input.usageError };
  }

  if (input.skipReason !== undefined) {
    return { status: "skipped", reason: input.skipReason };
  }

  if (input.isOriginMainAncestor) {
    return { status: "fresh", taskId: input.taskId };
  }

  const findings = input.upstreamChanges.flatMap((change) =>
    classifyProtectedChange(
      change,
      input.taskId,
      input.roadmapText,
      input.oldRoadmapText ?? input.roadmapText,
      input.roadmapHunks,
    ),
  );

  if (findings.length === 0) {
    return { status: "fresh", taskId: input.taskId };
  }

  return {
    status: "stale",
    taskId: input.taskId,
    findings,
  };
}

/** Build reusable dotted and slugged task identifiers. */
const makeTaskScope = (taskId: string): TaskScope => {
  return {
    taskId,
    taskSlug: taskId.replaceAll(".", "-"),
  };
};

/** Parse the task id from one roadmap checkbox line. */
const parseRoadmapTaskLine = (line: string): string | undefined => {
  const groups = roadmapTaskPattern.exec(line)?.groups as RoadmapTaskMatchGroups | undefined;

  return groups?.taskId;
};

/** Find the last line owned by a roadmap task block. */
const findTaskBlockEnd = (lines: readonly string[], startIndex: number): number => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (roadmapTaskPattern.test(lines[index] ?? "")) {
      return index;
    }
  }

  return lines.length;
};

/** Parse Git's omitted hunk length as the default single-line range. */
const parseLength = (rawLength: string | undefined): number => {
  return rawLength === undefined ? 1 : Number(rawLength);
};

/** Classify one upstream path change after ancestry has shown the branch is behind. */
const classifyProtectedChange = (
  change: GitPathChange,
  taskId: string,
  roadmapText: string,
  oldRoadmapText: string,
  roadmapHunks: readonly RoadmapHunk[],
): readonly BranchFreshnessFinding[] => {
  if (!isProtectedPath(change.path) || isTaskScopedPath(change.path, taskId)) {
    return [];
  }

  if (change.path === "docs/roadmap.md") {
    return classifyRoadmapChange(taskId, roadmapText, oldRoadmapText, roadmapHunks);
  }

  return protectedChangedPaths(change)
    .filter((path) => !isTaskScopedPath(path, taskId))
    .map(createProtectedPathFinding);
};

/** Return all protected source and destination paths from one Git change. */
const protectedChangedPaths = (change: GitPathChange): readonly string[] => {
  const paths = [change.previousPath, change.path].filter(
    (path): path is string => path !== undefined && isProtectedPath(path),
  );

  return [...new Set(paths)];
};

/** Classify roadmap hunks using the declared task block as the only accepted range. */
const classifyRoadmapChange = (
  taskId: string,
  roadmapText: string,
  oldRoadmapText: string,
  roadmapHunks: readonly RoadmapHunk[],
): readonly BranchFreshnessFinding[] => {
  const taskRange = parseRoadmapTaskBlockRange(roadmapText, taskId);
  const oldTaskRange = parseRoadmapTaskBlockRange(oldRoadmapText, taskId);

  if (isRequiredRangeMissing(roadmapHunks, taskRange, oldTaskRange)) {
    return [createRoadmapFinding("declared task block was not found on origin/main")];
  }

  if (roadmapHunks.length === 0) {
    return [
      createRoadmapFinding("origin/main changed the roadmap but no roadmap hunks were found"),
    ];
  }

  if (roadmapHunks.every((hunk) => isHunkInsideTaskRanges(hunk, taskRange, oldTaskRange))) {
    return [];
  }

  return [
    createRoadmapFinding("origin/main changed a roadmap task outside the declared task block"),
  ];
};

/** Decide whether a roadmap diff hunk is fully inside the declared task block. */
const isHunkInsideTaskRanges = (
  hunk: RoadmapHunk,
  newRange: LineRange | undefined,
  oldRange: LineRange | undefined,
): boolean => {
  return (
    isChangedRangeInside(hunk.newStart, hunk.newLength, newRange) &&
    isChangedRangeInside(hunk.oldStart, hunk.oldLength, oldRange)
  );
};

/** Decide whether a changed hunk side needs a task block range that is missing. */
const isRequiredRangeMissing = (
  hunks: readonly RoadmapHunk[],
  newRange: LineRange | undefined,
  oldRange: LineRange | undefined,
): boolean => {
  return (
    (newRange === undefined && hunks.some((hunk) => hunk.newLength > 0)) ||
    (oldRange === undefined && hunks.some((hunk) => hunk.oldLength > 0))
  );
};

/** Decide whether a changed hunk side is inside the matching task block. */
const isChangedRangeInside = (
  start: number,
  length: number,
  range: LineRange | undefined,
): boolean => {
  if (length === 0) {
    return true;
  }

  if (range === undefined) {
    return false;
  }

  const end = start + length - 1;

  return start >= range.start && end <= range.end;
};

/** Create a consistent finding for a protected non-roadmap path. */
const createProtectedPathFinding = (path: string): BranchFreshnessFinding => {
  return {
    path,
    reason: "protected upstream change is outside the declared task scope",
    detail: "Fetch, then rebase or merge current origin/main before review.",
  };
};

/** Create a consistent finding for `docs/roadmap.md`. */
const createRoadmapFinding = (reason: string): BranchFreshnessFinding => {
  return {
    path: "docs/roadmap.md",
    reason,
    detail: "Fetch, then rebase or merge current origin/main before review.",
  };
};
