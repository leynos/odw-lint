/**
 * @file Argument parsing for the explicit-path `check` command.
 */

import type { ParsedCheckOptions, ParsedCheckRunArgs } from "./check-arg-types";
import {
  type CheckInformationalAction,
  informationalActionFor,
} from "./check-informational-action";
import {
  EQUALS_STRING_VALUE_OPTIONS,
  STRING_VALUE_OPTIONS,
  type StringValueOption,
  VALUE_LESS_CHECK_OPTIONS,
} from "./check-option-tables";
import { parseOutputFormatValue } from "./check-output-format";
import { parseMaxWarningsValue } from "./check-warning-budget";

export type ParsedCheckArgs =
  | ParsedCheckRunArgs
  | { readonly ok: true; readonly action: CheckInformationalAction }
  | { readonly ok: false; readonly usageError: string };

type ParsedCheckArgState = ParsedCheckOptions & {
  readonly paths: readonly string[];
  readonly nextIndex: number;
};

type ParseCheckTokenResult =
  | { readonly ok: true; readonly state: ParsedCheckArgState }
  | { readonly ok: false; readonly usageError: string };

type ParsedCheckOption =
  | { readonly ok: true; readonly handled: true; readonly state: ParsedCheckArgState }
  | { readonly ok: true; readonly handled: false }
  | { readonly ok: false; readonly usageError: string };

type ParsedValueLessCheckOption =
  | { readonly handled: true; readonly state: ParsedCheckArgState }
  | { readonly handled: false };
const USAGE = "usage: odw-lint check <workflow.js ...>";
/** Builds the successful parser result without retaining mutable arrays. */
const parsedCheckArgsFromState = (state: ParsedCheckArgState): ParsedCheckArgs => {
  return {
    ok: true,
    outputFormat: state.outputFormat,
    paths: Object.freeze([...state.paths]),
    ...(state.configPath === undefined ? {} : { configPath: state.configPath }),
    ...(state.maxWarnings === undefined ? {} : { maxWarnings: state.maxWarnings }),
    ...(state.outputFile === undefined ? {} : { outputFile: state.outputFile }),
    ...(state.stdinFilename === undefined ? {} : { stdinFilename: state.stdinFilename }),
    isolated: state.isolated,
    strictClaude: state.strictClaude,
    exitZero: state.exitZero,
    exitNonZeroOnFix: state.exitNonZeroOnFix,
    forceExclude: state.forceExclude,
    respectGitignore: state.respectGitignore,
  };
};

/**
 * Parse the minimal explicit-path `check` command shape.
 *
 * @param args Command-line arguments excluding `bun` and the script path.
 * @returns Parsed arguments or a stable usage error for the CLI boundary.
 */
export const parseCheckArgs = (args: readonly string[]): ParsedCheckArgs => {
  const [subcommand, ...tokens] = args;
  const action = informationalActionFor(args);

  if (action !== undefined) {
    return { ok: true, action };
  }

  const commandUsageError = usageErrorForSubcommand(subcommand);

  if (commandUsageError !== undefined) {
    return { ok: false, usageError: commandUsageError };
  }

  const parsedTail = parseCheckTail(tokens, {
    outputFormat: "full",
    paths: [],
    isolated: false,
    strictClaude: false,
    exitZero: false,
    exitNonZeroOnFix: false,
    forceExclude: false,
    respectGitignore: true,
    nextIndex: 0,
  });

  if (!parsedTail.ok) {
    return parsedTail;
  }

  const tailUsageError = usageErrorForParsedTail(parsedTail.state);

  if (tailUsageError !== undefined) {
    return { ok: false, usageError: tailUsageError };
  }

  return parsedCheckArgsFromState(parsedTail.state);
};

/** Validates the `check` subcommand before parsing command-specific options. */
const usageErrorForSubcommand = (subcommand: string | undefined): string | undefined => {
  if (subcommand === undefined) {
    return USAGE;
  }

  return subcommand === "check" ? undefined : `unknown command: ${subcommand}`;
};

/** Parses the option and operand tail after the `check` subcommand. */
const parseCheckTail = (
  tokens: readonly string[],
  initialState: ParsedCheckArgState,
): ParseCheckTokenResult => {
  let state = initialState;

  while (state.nextIndex < tokens.length) {
    const parsedToken = parseCheckToken(tokens, state);
    if (!parsedToken.ok) {
      return parsedToken;
    }

    state = parsedToken.state;
  }

  return { ok: true, state };
};

/** Returns usage errors that depend on the final parsed argument state. */
const usageErrorForParsedTail = (state: ParsedCheckArgState): string | undefined => {
  if (hasStdinFilenameAndOperands(state)) {
    return "--stdin-filename cannot be combined with path operands";
  }

  return hasNoInput(state) ? USAGE : undefined;
};

/** Returns whether stdin mode was combined with explicit input operands. */
const hasStdinFilenameAndOperands = (state: ParsedCheckArgState): boolean => {
  return state.stdinFilename !== undefined && state.paths.length > 0;
};

/** Returns whether the invocation selected no file or stdin input. */
const hasNoInput = (state: ParsedCheckArgState): boolean => {
  return state.stdinFilename === undefined && state.paths.length === 0;
};

/** Parses one option or positional token from the `check` argument tail. */
const parseCheckToken = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
): ParseCheckTokenResult => {
  const token = tokens[state.nextIndex];
  if (token === undefined) {
    return { ok: true, state };
  }

  const parsedOption = parseCheckOption(tokens, state, token);
  if (!parsedOption.ok) {
    return parsedOption;
  }
  if (parsedOption.handled) {
    return { ok: true, state: parsedOption.state };
  }

  return token.startsWith("-")
    ? { ok: false, usageError: `unknown option: ${token}` }
    : {
        ok: true,
        state: {
          ...state,
          paths: [...state.paths, token],
          nextIndex: state.nextIndex + 1,
        },
      };
};

/** Parses recognised `check` options while leaving operands to the caller. */
const parseCheckOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  const valueLessOption = parseValueLessCheckOption(state, token);
  if (valueLessOption.handled) {
    return { ok: true, handled: true, state: valueLessOption.state };
  }

  return parseValueCheckOption(tokens, state, token);
};

/** Parses recognised options that require values for the `check` command. */
const parseValueCheckOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  const separateValueOption = parseSeparateValueCheckOption(tokens, state, token);
  if (!separateValueOption.ok) {
    return separateValueOption;
  }
  if (separateValueOption.handled) {
    return separateValueOption;
  }

  return parseEqualsValueCheckOption(state, token);
};

/** Parses recognised two-token options that require values. */
const parseSeparateValueCheckOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  if (token === "--output-format") {
    const value = tokens[state.nextIndex + 1];
    if (value === undefined) {
      return { ok: false, usageError: "missing value for --output-format" };
    }

    const parsedFormat = parseOutputFormatValue(value);
    return parsedFormat.ok
      ? {
          ok: true,
          handled: true,
          state: {
            ...state,
            outputFormat: parsedFormat.outputFormat,
            nextIndex: state.nextIndex + 2,
          },
        }
      : parsedFormat;
  }
  if (token === "--max-warnings") {
    const value = tokens[state.nextIndex + 1];
    const parsedMaxWarnings = parseMaxWarningsValue(value);
    return parsedMaxWarnings.ok
      ? {
          ok: true,
          handled: true,
          state: {
            ...state,
            maxWarnings: parsedMaxWarnings.maxWarnings,
            nextIndex: state.nextIndex + 2,
          },
        }
      : parsedMaxWarnings;
  }

  const stringOption = STRING_VALUE_OPTIONS.get(token);

  if (stringOption !== undefined) {
    return parseSeparateStringValueOption(tokens, state, stringOption);
  }

  return { ok: true, handled: false };
};

/** Parses recognised `--option=value` forms that require values. */
const parseEqualsValueCheckOption = (
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  if (token.startsWith("--output-format=")) {
    const value = token.slice("--output-format=".length);
    if (value.length === 0) {
      return { ok: false, usageError: "missing value for --output-format" };
    }

    const parsedFormat = parseOutputFormatValue(value);
    return parsedFormat.ok
      ? {
          ok: true,
          handled: true,
          state: {
            ...state,
            outputFormat: parsedFormat.outputFormat,
            nextIndex: state.nextIndex + 1,
          },
        }
      : parsedFormat;
  }
  if (token.startsWith("--max-warnings=")) {
    const parsedMaxWarnings = parseMaxWarningsValue(token.slice("--max-warnings=".length));
    return parsedMaxWarnings.ok
      ? {
          ok: true,
          handled: true,
          state: {
            ...state,
            maxWarnings: parsedMaxWarnings.maxWarnings,
            nextIndex: state.nextIndex + 1,
          },
        }
      : parsedMaxWarnings;
  }

  const stringOption = parseEqualsStringValueOption(state, token);

  if (!stringOption.ok) {
    return stringOption;
  }
  if (stringOption.handled) {
    return { ok: true, handled: true, state: stringOption.state };
  }

  return { ok: true, handled: false };
};

/** Parses two-token string options that all share missing-value semantics. */
const parseSeparateStringValueOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
  option: StringValueOption,
): ParsedCheckOption => {
  const value = tokens[state.nextIndex + 1];

  return value === undefined
    ? { ok: false, usageError: option.missingValueError }
    : {
        ok: true,
        handled: true,
        state: stateWithStringOptionValue(state, option.field, value, state.nextIndex + 2),
      };
};

/** Parses recognised `--option=value` string options. */
const parseEqualsStringValueOption = (
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  for (const [prefix, option] of EQUALS_STRING_VALUE_OPTIONS) {
    if (token.startsWith(prefix)) {
      const value = token.slice(prefix.length);

      if (value.length === 0) {
        return { ok: false, usageError: option.missingValueError };
      }

      return {
        ok: true,
        handled: true,
        state: stateWithStringOptionValue(state, option.field, value, state.nextIndex + 1),
      };
    }
  }

  return { ok: true, handled: false };
};

/** Sets one parsed string option while preserving exact optional properties. */
const stateWithStringOptionValue = (
  state: ParsedCheckArgState,
  field: StringValueOption["field"],
  value: string,
  nextIndex: number,
): ParsedCheckArgState => {
  switch (field) {
    case "configPath":
      return { ...state, configPath: value, nextIndex };
    case "outputFile":
      return { ...state, outputFile: value, nextIndex };
    case "stdinFilename":
      return { ...state, stdinFilename: value, nextIndex };
  }
};

/** Parses recognised value-less options for the `check` command. */
const parseValueLessCheckOption = (
  state: ParsedCheckArgState,
  token: string,
): ParsedValueLessCheckOption => {
  if (token === "--respect-gitignore" || token === "--no-respect-gitignore") {
    return {
      handled: true,
      state: {
        ...state,
        respectGitignore: token === "--respect-gitignore",
        nextIndex: state.nextIndex + 1,
      },
    };
  }

  const field = VALUE_LESS_CHECK_OPTIONS.get(token);

  if (field === undefined) {
    return { handled: false };
  }

  return {
    handled: true,
    state: { ...state, [field]: true, nextIndex: state.nextIndex + 1 },
  };
};
