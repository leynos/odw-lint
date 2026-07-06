/**
 * @file Shared parsed-argument types for the `check` command.
 */

import type { CheckOutputFormat } from "./check-output-format";

export type ParsedCheckOptions = {
  readonly outputFormat: CheckOutputFormat;
  readonly configPath?: string;
  readonly maxWarnings?: number;
  readonly outputFile?: string;
  readonly stdinFilename?: string;
  readonly isolated: boolean;
  readonly strictClaude: boolean;
  readonly exitZero: boolean;
  readonly exitNonZeroOnFix: boolean;
  readonly forceExclude: boolean;
  readonly respectGitignore: boolean;
};

export type ParsedCheckRunArgs = ParsedCheckOptions & {
  readonly ok: true;
  readonly paths: readonly string[];
};
