/**
 * @file Temporary workspace support for fixture metadata refresh tests.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ODW_EXAMPLE_FIXTURE_SNAPSHOTS } from "./fixtures/odw-examples";

interface TempRefreshWorkspaceOptions {
  readonly omitExample?: string;
  readonly extraExample?: string;
}

export interface TempRefreshWorkspace {
  readonly repositoryRoot: string;
  readonly odwReferenceCheckout: string;
  readonly remove: () => void;
}

const repositoryRootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const inheritedEnvKeys = ["HOME", "PATH", "TEMP", "TMP", "TMPDIR"] as const;

/**
 * Creates a temp repository and ODW checkout with inert fixture source only.
 *
 * @param options - Optional upstream example omissions or additions.
 * @returns Temporary repository paths plus a cleanup callback.
 * @throws Error when the temporary fixture workspace cannot be created.
 */
export const createTempRefreshWorkspace = (
  options: TempRefreshWorkspaceOptions = {},
): TempRefreshWorkspace => {
  const root = mkdtempSync(join(tmpdir(), "odw-lint-refresh-"));
  const tempRepositoryRoot = join(root, "odw-lint");
  const tempOdwReferenceCheckout = join(root, "open-dynamic-workflows");
  const tempFixtureRoot = join(tempRepositoryRoot, "tests/static-analysis/fixtures");

  try {
    mkdirSync(tempFixtureRoot, { recursive: true });
    cpSync(
      join(repositoryRootPath, "tests/static-analysis/fixtures/masking"),
      join(tempFixtureRoot, "masking"),
      {
        recursive: true,
      },
    );
    cpSync(
      join(repositoryRootPath, "tests/static-analysis/fixtures/invalid-workflows"),
      join(tempFixtureRoot, "invalid-workflows"),
      { recursive: true },
    );
    cpSync(
      join(repositoryRootPath, "tests/static-analysis/fixtures/masking.ts"),
      join(tempFixtureRoot, "masking.ts"),
    );
    cpSync(
      join(repositoryRootPath, "tests/static-analysis/fixtures/odw-examples.ts"),
      join(tempFixtureRoot, "odw-examples.ts"),
    );
    mkdirSync(join(tempOdwReferenceCheckout, "examples"), { recursive: true });

    for (const fixture of ODW_EXAMPLE_FIXTURE_SNAPSHOTS) {
      if (fixture.fileName === options.omitExample) {
        continue;
      }

      cpSync(
        join(repositoryRootPath, fixture.fixturePath),
        join(tempOdwReferenceCheckout, "examples", fixture.fileName),
      );
    }

    if (options.extraExample !== undefined) {
      writeFileSync(
        join(tempOdwReferenceCheckout, "examples", options.extraExample),
        "export const meta = { name: 'extra', description: 'Extra example.' };\n",
      );
    }
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }

  return {
    repositoryRoot: tempRepositoryRoot,
    odwReferenceCheckout: tempOdwReferenceCheckout,
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
};

/**
 * Runs the refresh CLI from a temp repository root.
 *
 * @param args - CLI arguments to pass after the refresh script path.
 * @param workspace - Temporary repository and ODW checkout paths.
 * @returns Completed child-process result.
 */
export const runRefreshCli = (
  args: readonly string[],
  workspace: TempRefreshWorkspace,
): ReturnType<typeof spawnSync> => {
  return spawnSync(
    process.execPath,
    [join(repositoryRootPath, "tests/static-analysis/fixtures/refresh-metadata.ts"), ...args],
    {
      cwd: workspace.repositoryRoot,
      encoding: "utf8",
      env: refreshCliEnv(workspace),
      timeout: 5_000,
    },
  );
};

/**
 * Builds a deterministic child environment for refresh CLI tests.
 */
const refreshCliEnv = (workspace: TempRefreshWorkspace): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ODW_REFERENCE_CHECKOUT: workspace.odwReferenceCheckout,
  };

  for (const key of inheritedEnvKeys) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
};
