/**
 * @file Static option tables for the `check` argument parser.
 */

export type StringValueOption = {
  readonly field: "configPath" | "outputFile" | "stdinFilename";
  readonly missingValueError: string;
};

export type BooleanCheckOptionField =
  | "isolated"
  | "strictClaude"
  | "exitZero"
  | "exitNonZeroOnFix"
  | "forceExclude";

export const VALUE_LESS_CHECK_OPTIONS = new Map<string, BooleanCheckOptionField>([
  ["--isolated", "isolated"],
  ["--strict-claude", "strictClaude"],
  ["--exit-zero", "exitZero"],
  ["--exit-non-zero-on-fix", "exitNonZeroOnFix"],
  ["--force-exclude", "forceExclude"],
]);

export const STRING_VALUE_OPTIONS = new Map<string, StringValueOption>([
  ["--config", { field: "configPath", missingValueError: "missing value for --config" }],
  ["--output-file", { field: "outputFile", missingValueError: "missing value for --output-file" }],
  [
    "--stdin-filename",
    { field: "stdinFilename", missingValueError: "missing value for --stdin-filename" },
  ],
]);

export const EQUALS_STRING_VALUE_OPTIONS = new Map<string, StringValueOption>([
  ["--output-file=", { field: "outputFile", missingValueError: "missing value for --output-file" }],
  [
    "--stdin-filename=",
    { field: "stdinFilename", missingValueError: "missing value for --stdin-filename" },
  ],
]);
