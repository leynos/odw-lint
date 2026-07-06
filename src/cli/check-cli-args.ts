/**
 * @file Argument parsing for the explicit-path `check` CLI.
 */

export type CheckOutputFormat = "full" | "json";

export type ParsedCheckArgs =
  | {
      readonly ok: true;
      readonly outputFormat: CheckOutputFormat;
      readonly paths: readonly string[];
      readonly configPath?: string;
      readonly maxWarnings?: number;
      readonly isolated: boolean;
    }
  | { readonly ok: false; readonly usageError: string };

type ParsedCheckArgState = {
  readonly outputFormat: CheckOutputFormat;
  readonly paths: readonly string[];
  readonly configPath?: string;
  readonly maxWarnings?: number;
  readonly isolated: boolean;
  readonly nextIndex: number;
};

type ParseCheckTokenResult =
  | { readonly ok: true; readonly state: ParsedCheckArgState }
  | { readonly ok: false; readonly usageError: string };

type ParsedCheckOption =
  | { readonly ok: true; readonly handled: true; readonly state: ParsedCheckArgState }
  | { readonly ok: true; readonly handled: false }
  | { readonly ok: false; readonly usageError: string };

const USAGE = "usage: odw-lint check <workflow.js ...>";

/** Builds the successful parser result without retaining mutable arrays. */
const parsedCheckArgsFromState = (state: ParsedCheckArgState): ParsedCheckArgs => {
  return {
    ok: true,
    outputFormat: state.outputFormat,
    paths: Object.freeze([...state.paths]),
    ...(state.configPath === undefined ? {} : { configPath: state.configPath }),
    ...(state.maxWarnings === undefined ? {} : { maxWarnings: state.maxWarnings }),
    isolated: state.isolated,
  };
};

/**
 * Parse the minimal explicit-path `check` command shape.
 *
 * @param args Command-line arguments excluding `bun` and the script path.
 * @returns Parsed check arguments or a stable usage error.
 */
export const parseCheckArgs = (args: readonly string[]): ParsedCheckArgs => {
  const [subcommand, ...tokens] = args;

  if (subcommand === undefined) {
    return { ok: false, usageError: USAGE };
  }

  if (subcommand !== "check") {
    return { ok: false, usageError: `unknown command: ${subcommand}` };
  }

  let state: ParsedCheckArgState = {
    outputFormat: "full",
    paths: [],
    isolated: false,
    nextIndex: 0,
  };

  while (state.nextIndex < tokens.length) {
    const parsedToken = parseCheckToken(tokens, state);
    if (!parsedToken.ok) {
      return parsedToken;
    }

    state = parsedToken.state;
  }

  if (state.paths.length === 0) {
    return { ok: false, usageError: USAGE };
  }

  return parsedCheckArgsFromState(state);
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
  if (token === "--isolated") {
    return parsedIsolatedOption(state);
  }
  if (token === "--config") {
    return parsedConfigOption(tokens, state);
  }
  if (token === "--output-format") {
    return parsedOutputFormatOption(tokens, state);
  }
  if (token.startsWith("--output-format=")) {
    return parsedOutputFormatEqualsOption(state, token);
  }
  if (token === "--max-warnings") {
    return parsedMaxWarningsOption(tokens, state);
  }
  if (token.startsWith("--max-warnings=")) {
    return parsedMaxWarningsEqualsOption(state, token);
  }

  return { ok: true, handled: false };
};

/** Parses `--isolated`, which has no value. */
const parsedIsolatedOption = (state: ParsedCheckArgState): ParsedCheckOption => {
  return {
    ok: true,
    handled: true,
    state: { ...state, isolated: true, nextIndex: state.nextIndex + 1 },
  };
};

/** Parses `--config <path>` and validates that the required value is present. */
const parsedConfigOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
): ParsedCheckOption => {
  const value = tokens[state.nextIndex + 1];
  return value === undefined
    ? { ok: false, usageError: "missing value for --config" }
    : {
        ok: true,
        handled: true,
        state: { ...state, configPath: value, nextIndex: state.nextIndex + 2 },
      };
};

/** Parses `--output-format <format>` and advances past its value. */
const parsedOutputFormatOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
): ParsedCheckOption => {
  return parsedOutputFormatState(parseOutputFormatValue(tokens[state.nextIndex + 1]), state, 2);
};

/** Parses `--output-format=<format>` and advances past the option token. */
const parsedOutputFormatEqualsOption = (
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  return parsedOutputFormatState(
    parseOutputFormatValue(token.slice("--output-format=".length)),
    state,
    1,
  );
};

/** Parses `--max-warnings <n>` and advances past its value. */
const parsedMaxWarningsOption = (
  tokens: readonly string[],
  state: ParsedCheckArgState,
): ParsedCheckOption => {
  return parsedMaxWarningsState(parseMaxWarningsValue(tokens[state.nextIndex + 1]), state, 2);
};

/** Parses `--max-warnings=<n>` and advances past the option token. */
const parsedMaxWarningsEqualsOption = (
  state: ParsedCheckArgState,
  token: string,
): ParsedCheckOption => {
  return parsedMaxWarningsState(
    parseMaxWarningsValue(token.slice("--max-warnings=".length)),
    state,
    1,
  );
};

/** Parse the implemented output formats from the wider planned flag surface. */
const parseOutputFormat = (
  value: string,
):
  | { readonly ok: true; readonly outputFormat: CheckOutputFormat }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === "full" || value === "json") {
    return { ok: true, outputFormat: value };
  }

  return { ok: false, usageError: `unsupported output format: ${value}` };
};

/** Parse a required output-format option value. */
const parseOutputFormatValue = (
  value: string | undefined,
):
  | { readonly ok: true; readonly outputFormat: CheckOutputFormat }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === undefined) {
    return { ok: false, usageError: "unsupported output format: " };
  }

  return parseOutputFormat(value);
};

/** Applies a parsed output-format value to parser state. */
const parsedOutputFormatState = (
  parsedFormat: ReturnType<typeof parseOutputFormatValue>,
  state: ParsedCheckArgState,
  advanceBy: number,
): ParsedCheckOption => {
  return parsedFormat.ok
    ? {
        ok: true,
        handled: true,
        state: {
          ...state,
          outputFormat: parsedFormat.outputFormat,
          nextIndex: state.nextIndex + advanceBy,
        },
      }
    : parsedFormat;
};

/** Parse a required non-negative integer warning-budget option value. */
const parseMaxWarningsValue = (
  value: string | undefined,
):
  | { readonly ok: true; readonly maxWarnings: number }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === undefined) {
    return { ok: false, usageError: "missing value for --max-warnings" };
  }

  if (!/^\d+$/.test(value)) {
    return { ok: false, usageError: `invalid value for --max-warnings: ${value}` };
  }

  const maxWarnings = Number.parseInt(value, 10);
  return Number.isSafeInteger(maxWarnings)
    ? { ok: true, maxWarnings }
    : { ok: false, usageError: `invalid value for --max-warnings: ${value}` };
};

/** Applies a parsed warning-budget value to parser state. */
const parsedMaxWarningsState = (
  parsedMaxWarnings: ReturnType<typeof parseMaxWarningsValue>,
  state: ParsedCheckArgState,
  advanceBy: number,
): ParsedCheckOption => {
  return parsedMaxWarnings.ok
    ? {
        ok: true,
        handled: true,
        state: {
          ...state,
          maxWarnings: parsedMaxWarnings.maxWarnings,
          nextIndex: state.nextIndex + advanceBy,
        },
      }
    : parsedMaxWarnings;
};
