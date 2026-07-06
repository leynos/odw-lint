/**
 * @file Configuration file discovery, reading, parsing, and validation.
 *
 * This module keeps configuration loading inert: it reads JSON text through an
 * injectable seam, parses data, and delegates schema checks to the config
 * validator. It must not import workflow-source readers or runtime helpers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ConfigValidationError,
  type ConfigValidationWarning,
  type LinterConfig,
  validateLinterConfig,
} from "./linter-config";

/**
 * Default configuration filename discovered in the current working directory.
 */
export const DEFAULT_CONFIG_FILENAME = "odw-lint.json";

/**
 * UTF-8 configuration file reader seam.
 */
export type ConfigFileReader = (path: string) => string;

/**
 * Loader options for `odw-lint` configuration files.
 */
export type LoadLinterConfigOptions = {
  /** Explicit configuration path supplied by a caller. */
  readonly configPath?: string;
  /** Whether configuration discovery and loading are disabled. */
  readonly isolated?: boolean;
  /** Current working directory used for default discovery. */
  readonly cwd?: string;
  /** Injected file reader for deterministic tests. */
  readonly readConfigFile?: ConfigFileReader;
};

/**
 * Stable read-failure reason for configuration files.
 */
export type ConfigReadFailureReason = "not-found" | "not-a-file" | "unreadable";

/**
 * Project-owned configuration load error.
 */
export type ConfigLoadError =
  | {
      readonly kind: "read-failed";
      readonly filePath: string;
      readonly reason: ConfigReadFailureReason;
      readonly message: string;
    }
  | {
      readonly kind: "parse-failed";
      readonly filePath: string;
      readonly message: string;
    }
  | {
      readonly kind: "invalid-config";
      readonly filePath: string;
      readonly message: string;
      readonly errors: readonly ConfigValidationError[];
      readonly warnings: readonly ConfigValidationWarning[];
    }
  | {
      readonly kind: "usage-error";
      readonly message: string;
    };

/**
 * Discriminated result for optional configuration loading.
 */
export type ConfigLoadResult =
  | {
      readonly ok: true;
      readonly config: LinterConfig;
      readonly warnings: readonly ConfigValidationWarning[];
    }
  | {
      readonly ok: false;
      readonly error: ConfigLoadError;
    };

type ConfigReadResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly error: Extract<ConfigLoadError, { readonly kind: "read-failed" }>;
    };

const EMPTY_CONFIG_RESULT: ConfigLoadResult = Object.freeze({
  ok: true,
  config: Object.freeze({}),
  warnings: Object.freeze([]),
});

/** Default UTF-8 filesystem reader used outside tests. */
const defaultReadConfigFile: ConfigFileReader = (filePath) => readFileSync(filePath, "utf8");

/** Converts unknown thrown values to user-visible text at the filesystem boundary. */
const messageForThrownValue = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

/** Extracts the POSIX-style error code surfaced by Node filesystem errors. */
const errnoCodeFor = (error: unknown): string | undefined => {
  if (error === null || typeof error !== "object") {
    return undefined;
  }

  const code = (error as NodeJS.ErrnoException).code;

  return typeof code === "string" ? code : undefined;
};

/** Maps known filesystem error codes to stable configuration read reasons. */
const reasonForErrnoCode = (code: string | undefined): ConfigReadFailureReason => {
  switch (code) {
    case "ENOENT":
      return "not-found";
    case "EISDIR":
      return "not-a-file";
    default:
      return "unreadable";
  }
};

/** Reads one configuration file path and converts throws to project-owned errors. */
const readConfigText = (filePath: string, readConfigFile: ConfigFileReader): ConfigReadResult => {
  try {
    return Object.freeze({ ok: true, text: readConfigFile(filePath) });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        kind: "read-failed",
        filePath,
        reason: reasonForErrnoCode(errnoCodeFor(error)),
        message: messageForThrownValue(error),
      }),
    });
  }
};

/** Parses JSON text and preserves the file path that produced parse failures. */
const parseConfigJson = (
  filePath: string,
  text: string,
):
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: ConfigLoadError } => {
  try {
    return Object.freeze({ ok: true, value: JSON.parse(text) as unknown });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        kind: "parse-failed",
        filePath,
        message: `Failed to parse configuration JSON at ${filePath}: ${messageForThrownValue(error)}`,
      }),
    });
  }
};

/** Builds the load error for parsed JSON that fails schema validation. */
const invalidConfigError = (
  filePath: string,
  errors: readonly ConfigValidationError[],
  warnings: readonly ConfigValidationWarning[],
): ConfigLoadError =>
  Object.freeze({
    kind: "invalid-config",
    filePath,
    message: `Invalid linter configuration at ${filePath}.`,
    errors,
    warnings,
  });

/** Validates parsed JSON as a loaded linter configuration. */
const validateParsedConfig = (filePath: string, value: unknown): ConfigLoadResult => {
  const validation = validateLinterConfig(value);
  if (!validation.ok) {
    return {
      ok: false,
      error: invalidConfigError(filePath, validation.errors, validation.warnings),
    };
  }

  return { ok: true, config: validation.config, warnings: validation.warnings };
};

/** Parses and validates text from a successfully read configuration file. */
const finalizeConfigText = (filePath: string, text: string): ConfigLoadResult => {
  const parsed = parseConfigJson(filePath, text);

  return parsed.ok
    ? validateParsedConfig(filePath, parsed.value)
    : { ok: false, error: parsed.error };
};

/** Loads and validates a configuration file that is required to exist. */
const loadConfigFile = (filePath: string, readConfigFile: ConfigFileReader): ConfigLoadResult => {
  const readResult = readConfigText(filePath, readConfigFile);
  if (!readResult.ok) {
    return { ok: false, error: readResult.error };
  }

  return finalizeConfigText(filePath, readResult.text);
};

/** Loads the optional default configuration file from the working directory. */
const loadDefaultConfigFile = (cwd: string, readConfigFile: ConfigFileReader): ConfigLoadResult => {
  const filePath = join(cwd, DEFAULT_CONFIG_FILENAME);
  const readResult = readConfigText(filePath, readConfigFile);
  if (!readResult.ok) {
    return readResult.error.reason === "not-found"
      ? EMPTY_CONFIG_RESULT
      : { ok: false, error: readResult.error };
  }

  return finalizeConfigText(filePath, readResult.text);
};

/** Builds the usage error for contradictory configuration loading modes. */
const isolatedWithConfigPathError = (): ConfigLoadResult => ({
  ok: false,
  error: Object.freeze({
    kind: "usage-error",
    message: "--config and --isolated cannot be used together.",
  }),
});

/**
 * Loads the optional linter configuration from an explicit path or default file.
 *
 * @param options Configuration loading mode and injected reader.
 * @returns Loaded configuration, empty configuration, or a project-owned error.
 *
 * @example
 * ```ts
 * const result = loadLinterConfig({ cwd: process.cwd() });
 * if (result.ok) {
 *   console.log(result.config.strictClaude);
 * }
 * ```
 */
export const loadLinterConfig = (options: LoadLinterConfigOptions = {}): ConfigLoadResult => {
  const isolated = options.isolated ?? false;

  if (isolated) {
    return options.configPath === undefined ? EMPTY_CONFIG_RESULT : isolatedWithConfigPathError();
  }

  const readConfigFile = options.readConfigFile ?? defaultReadConfigFile;
  return options.configPath === undefined
    ? loadDefaultConfigFile(options.cwd ?? process.cwd(), readConfigFile)
    : loadConfigFile(options.configPath, readConfigFile);
};
