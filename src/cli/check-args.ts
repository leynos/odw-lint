/**
 * @file Argument parsing for the explicit-path `check` command.
 */

import type { ParsedCheckOptions, ParsedCheckRunArgs } from "./check-arg-types";
import {
  type CheckInformationalAction,
  informationalActionFor,
} from "./check-informational-action";
import {
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

type ValueCheckOption = {
  readonly missingValueError: string;
  readonly apply: (
    state: ParsedCheckArgState,
    value: string,
    nextIndex: number,
  ) => ParsedCheckOption;
};

const USAGE = "usage: odw-lint check <workflow.js ...>";

/** Adapts table-driven string options into the common valued-option parser. */
const valueCheckOptionFromStringOption = (option: StringValueOption): ValueCheckOption => ({
  missingValueError: option.missingValueError,
  apply: (state, value, nextIndex) => ({
    ok: true,
    handled: true,
    state: stateWithStringOptionValue(state, option.field, value, nextIndex),
  }),
});

const STRING_VALUE_CHECK_OPTION_ENTRIES: readonly (readonly [string, ValueCheckOption])[] = [
  ...[...STRING_VALUE_OPTIONS].map(
    ([optionName, option]) => [optionName, valueCheckOptionFromStringOption(option)] as const,
  ),
];

const VALUE_CHECK_OPTIONS: ReadonlyMap<string, ValueCheckOption> = new Map([
  [
    "--output-format",
    {
      missingValueError: "missing value for --output-format",
      apply: (state, value, nextIndex) => {
        const parsedFormat = parseOutputFormatValue(value);

        return parsedFormat.ok
          ? {
              ok: true,
              handled: true,
              state: { ...state, outputFormat: parsedFormat.outputFormat, nextIndex },
            }
          : parsedFormat;
      },
    },
  ],
  [
    "--max-warnings",
    {
      missingValueError: "missing value for --max-warnings",
      apply: (state, value, nextIndex) => {
        const parsedMaxWarnings = parseMaxWarningsValue(value);

        return parsedMaxWarnings.ok
          ? {
              ok: true,
              handled: true,
              state: { ...state, maxWarnings: parsedMaxWarnings.maxWarnings, nextIndex },
            }
          : parsedMaxWarnings;
      },
    },
  ],
  ...STRING_VALUE_CHECK_OPTION_ENTRIES,
]);

const EQUALS_VALUE_CHECK_OPTIONS: ReadonlyMap<string, ValueCheckOption> = new Map([
  ...[...VALUE_CHECK_OPTIONS].map(([optionName, option]) => [`${optionName}=`, option] as const),
]);

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
  const option = VALUE_CHECK_OPTIONS.get(token);

  if (option !== undefined) {
    const value = tokens[state.nextIndex + 1];
    if (isMissingSeparateOptionValue(value)) {
      return { ok: false, usageError: option.missingValueError };
    }

    return option.apply(state, value, state.nextIndex + 2);
  }

  return { ok: true, handled: false };
};

/** Parses recognised `--option=value` forms that require values. */
const parseEqualsValueCheckOption = (
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  for (const [prefix, option] of EQUALS_VALUE_CHECK_OPTIONS) {
    if (token.startsWith(prefix)) {
      const value = token.slice(prefix.length);

      return value.length === 0
        ? { ok: false, usageError: option.missingValueError }
        : option.apply(state, value, state.nextIndex + 1);
    }
  }

  return { ok: true, handled: false };
};

/** Treats another recognised option as a missing split-form value. */
const isMissingSeparateOptionValue = (value: string | undefined): value is undefined => {
  return value === undefined || isRecognisedCheckOptionToken(value);
};

/** Returns whether a token would be consumed as a `check` option. */
const isRecognisedCheckOptionToken = (token: string): boolean => {
  return (
    VALUE_CHECK_OPTIONS.has(token) ||
    token.startsWith("--output-format=") ||
    token.startsWith("--max-warnings=") ||
    [...STRING_VALUE_OPTIONS.keys()].some((optionName) => token.startsWith(`${optionName}=`)) ||
    VALUE_LESS_CHECK_OPTIONS.has(token) ||
    token === "--respect-gitignore" ||
    token === "--no-respect-gitignore"
  );
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
