/**
 * @file Pure helpers for binding recorded review evidence to a Git tree.
 */

import type { GitCommandResult, GitRunner } from "./git-support";
import { runGit } from "./git-support";
import { singleLine } from "./report-format-helpers";

/** Git commit and tree object identities for a reviewed repository state. */
export type TreeProvenance = {
  readonly commit: string;
  readonly tree: string;
};

export type ReadTreeProvenanceResult =
  | { readonly ok: true; readonly provenance: TreeProvenance }
  | { readonly ok: false; readonly message: string };

export const REVIEWED_COMMIT_LINE_PREFIX = "- reviewed commit: ";
export const REVIEWED_TREE_LINE_PREFIX = "- reviewed tree: ";

const gitObjectIdPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/**
 * Format reviewed tree provenance as a report trailer.
 *
 * @param provenance - Commit and tree identities to record.
 * @returns Two one-fact-per-line trailer entries with a trailing newline.
 * @example
 * formatProvenanceTrailer({
 *   commit: "0123456789abcdef0123456789abcdef01234567",
 *   tree: "fedcba9876543210fedcba9876543210fedcba98",
 * })
 * // => "- reviewed commit: 0123456789abcdef0123456789abcdef01234567\n- reviewed tree: fedcba9876543210fedcba9876543210fedcba98\n"
 */
export function formatProvenanceTrailer(provenance: TreeProvenance): string {
  assertGitObjectId("commit", provenance.commit);
  assertGitObjectId("tree", provenance.tree);

  return [
    `${REVIEWED_COMMIT_LINE_PREFIX}${provenance.commit}`,
    `${REVIEWED_TREE_LINE_PREFIX}${provenance.tree}`,
    "",
  ].join("\n");
}

/**
 * Parse the reviewed tree provenance marker in recorded report content.
 *
 * @param content - Recorded review-evidence artefact content.
 * @returns Parsed provenance, or undefined when either marker is absent.
 */
export function parseTreeProvenance(content: string): TreeProvenance | undefined {
  const lines = content.split(/\r?\n/);
  const commit = findUniqueLineValue(lines, REVIEWED_COMMIT_LINE_PREFIX);
  const tree = findUniqueLineValue(lines, REVIEWED_TREE_LINE_PREFIX);

  if (commit === undefined) {
    return undefined;
  }
  if (tree === undefined) {
    return undefined;
  }
  if (!isGitObjectId(commit) || !isGitObjectId(tree)) {
    return undefined;
  }

  return { commit, tree };
}

/**
 * Compare embedded provenance with the current reviewed tree state.
 *
 * @param embedded - Provenance recorded in the artefact.
 * @param current - Provenance observed for the current repository state.
 * @returns match when the tree object is identical; otherwise mismatch.
 */
export function compareTreeProvenance(
  embedded: Pick<TreeProvenance, "tree">,
  current: Pick<TreeProvenance, "tree">,
): "match" | "mismatch" {
  return embedded.tree === current.tree ? "match" : "mismatch";
}

/**
 * Read the current reviewed commit and tree through the shared Git runner.
 *
 * @param git - Git runner scoped to the repository under review.
 * @returns Current provenance or a deterministic failure message.
 */
export function readTreeProvenance(git: GitRunner): ReadTreeProvenanceResult {
  const commit = readGitObjectId(git, ["rev-parse", "HEAD"]);
  if (!commit.ok) {
    return commit;
  }

  const tree = readGitObjectId(git, ["rev-parse", "HEAD^{tree}"]);
  if (!tree.ok) {
    return tree;
  }

  return { ok: true, provenance: { commit: commit.value, tree: tree.value } };
}

/** Return the value when exactly one line carries a provenance prefix. */
const findUniqueLineValue = (lines: readonly string[], prefix: string): string | undefined => {
  const matchingLines = lines.filter((candidate) => candidate.startsWith(prefix));

  const [line] = matchingLines;

  if (line === undefined || matchingLines.length !== 1) {
    return undefined;
  }

  return line.slice(prefix.length);
};

/** Recognize object IDs emitted by SHA-1 and SHA-256 Git repositories. */
const isGitObjectId = (value: string): boolean => gitObjectIdPattern.test(value);

/** Reject malformed object names before they can shape report lines. */
const assertGitObjectId = (field: "commit" | "tree", value: string): void => {
  if (isGitObjectId(value)) {
    return;
  }

  throw new Error(
    `review evidence ${field} provenance must be a 40- or 64-character lowercase hex object id`,
  );
};

/** Read and validate one Git object id command. */
const readGitObjectId = (
  git: GitRunner,
  args: readonly string[],
):
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string } => {
  const result = runGit(git, args);
  const command = renderGitCommand(args);
  const failure = gitCommandFailureMessage(command, result);
  if (failure !== undefined) {
    return { ok: false, message: failure };
  }

  const value = result.stdout.trim();
  if (value === "") {
    return { ok: false, message: `${command} produced empty output` };
  }
  if (!isGitObjectId(value)) {
    return { ok: false, message: `${command} produced invalid object id: ${singleLine(value)}` };
  }

  return { ok: true, value };
};

/** Render Git commands for stable diagnostic messages. */
const renderGitCommand = (args: readonly string[]): string => ["git", ...args].join(" ");

/** Convert failed Git results to one-line diagnostics. */
const gitCommandFailureMessage = (
  command: string,
  result: GitCommandResult,
): string | undefined => {
  if (result.error !== undefined) {
    return `${command} failed: ${singleLine(result.error.message)}`;
  }
  if (result.status !== 0) {
    return `${command} failed with status ${String(result.status)}: ${singleLine(result.stderr)}`;
  }
  if (result.signal !== null) {
    return `${command} failed with signal ${result.signal}: ${singleLine(result.stderr)}`;
  }

  return undefined;
};
