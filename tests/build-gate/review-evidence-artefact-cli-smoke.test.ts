/**
 * @file Process smoke tests for the recorded review-evidence artefact CLI.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitAll,
  createGitRunner,
  createTemporaryRepository,
  runGit,
  writeRepositoryFile,
} from "./git-support";
import { formatProvenanceTrailer, type TreeProvenance } from "./review-evidence-provenance";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const completeVerifiedReport =
  "Review evidence: verified\n- gate make all: passed\n- dual-review path: scrutineer (primary; scrutineer available)\n";
const mismatchedProvenance = {
  commit: "1111111111111111111111111111111111111111",
  tree: "2222222222222222222222222222222222222222",
} satisfies TreeProvenance;

/** Run the artefact CLI entrypoint as a real Bun child process. */
const runCliProcess = (cwd: string) => {
  return Bun.spawnSync({
    cmd: ["bun", "run", join(repositoryRoot, "tests/build-gate/review-evidence-artefact-cli.ts")],
    cwd,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
};

/** Create a committed repository and return its current provenance. */
const createReviewedRepository = (): {
  readonly path: string;
  readonly provenance: TreeProvenance;
} => {
  const repositoryPath = createTemporaryRepository({
    prefix: "odw-lint-review-evidence-artefact-",
  });
  writeRepositoryFile(repositoryPath, "README.md", "# Smoke fixture\n");
  commitAll(repositoryPath, "Seed smoke fixture");

  return {
    path: repositoryPath,
    provenance: {
      commit: readGitObjectId(repositoryPath, "HEAD"),
      tree: readGitObjectId(repositoryPath, "HEAD^{tree}"),
    },
  };
};

/** Read one object id from Git and fail the smoke fixture if Git misbehaves. */
const readGitObjectId = (repositoryPath: string, revision: string): string => {
  const result = runGit(createGitRunner(repositoryPath), ["rev-parse", revision]);

  if (result.status !== 0 || result.error !== undefined) {
    throw new Error(`git rev-parse ${revision} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
};

/** Assert process output in a stable, reviewable shape. */
const expectProcessResult = (
  result: ReturnType<typeof runCliProcess>,
  expected: {
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
  },
): void => {
  expect({
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }).toEqual(expected);
};

describe("review-evidence artefact CLI process smoke", () => {
  it("rejects a missing default artefact", () => {
    const repository = createReviewedRepository();

    try {
      const result = runCliProcess(repository.path);

      expectProcessResult(result, {
        exitCode: 1,
        stdout: "",
        stderr: `Review evidence artefact: missing
- artefact path: .review-evidence/report.txt
`,
      });
    } finally {
      rmSync(repository.path, { recursive: true, force: true });
    }
  });

  it("accepts a verified default artefact", () => {
    const repository = createReviewedRepository();
    const artefactPath = join(repository.path, ".review-evidence/report.txt");

    try {
      mkdirSync(dirname(artefactPath), { recursive: true });
      writeFileSync(
        artefactPath,
        `${completeVerifiedReport}${formatProvenanceTrailer(repository.provenance)}`,
      );

      const result = runCliProcess(repository.path);

      expectProcessResult(result, {
        exitCode: 0,
        stderr: "",
        stdout: `Review evidence artefact: present
- recorded status: verified
- artefact path: .review-evidence/report.txt
`,
      });
    } finally {
      rmSync(repository.path, { recursive: true, force: true });
    }
  });

  it("rejects a verified artefact from another tree", () => {
    const repository = createReviewedRepository();
    const artefactPath = join(repository.path, ".review-evidence/report.txt");

    try {
      mkdirSync(dirname(artefactPath), { recursive: true });
      writeFileSync(
        artefactPath,
        `${completeVerifiedReport}${formatProvenanceTrailer(mismatchedProvenance)}`,
      );

      const result = runCliProcess(repository.path);

      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toBe("");
      expect(result.stderr.toString()).toContain("Review evidence artefact: mismatched");
      expect(result.stderr.toString()).toContain(`- recorded tree: ${mismatchedProvenance.tree}`);
      expect(result.stderr.toString()).toContain(`- current tree: ${repository.provenance.tree}`);
    } finally {
      rmSync(repository.path, { recursive: true, force: true });
    }
  });
});
