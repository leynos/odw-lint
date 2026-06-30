/**
 * @file Git output parsers for the branch-freshness review guard.
 */

import type { GitPathChange, RoadmapHunk } from "./branch-freshness";
import { parseRoadmapHunkHeader } from "./branch-freshness";

/**
 * Parse a NUL-delimited `git diff --name-status -z` payload.
 *
 * @param payload Raw NUL-delimited name-status output.
 * @returns Parsed Git path changes, including rename and copy source paths.
 */
export function parseNameStatusZ(payload: string): readonly GitPathChange[] {
  const fields = payload.split("\0").filter((field) => field.length > 0);
  const changes: GitPathChange[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index];

    if (status === undefined) {
      break;
    }

    if (status.startsWith("R") || status.startsWith("C")) {
      const previousPath = fields[index + 1];
      const path = fields[index + 2];

      if (previousPath !== undefined && path !== undefined) {
        changes.push({ path, previousPath, status });
      }
      index += 2;
      continue;
    }

    const path = fields[index + 1];

    if (path !== undefined) {
      changes.push({ path, status });
    }
    index += 1;
  }

  return changes;
}

/**
 * Parse zero-context diff hunk headers from a Git patch.
 *
 * @param patch Patch text from `git diff --unified=0`.
 * @returns Parsed roadmap hunk ranges.
 */
export function parseRoadmapDiffHunks(patch: string): readonly RoadmapHunk[] {
  return patch
    .split("\n")
    .filter((line) => line.startsWith("@@ "))
    .map(parseRoadmapHunkHeader)
    .filter((hunk): hunk is RoadmapHunk => hunk !== undefined);
}
