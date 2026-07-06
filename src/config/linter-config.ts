/**
 * @file Linter configuration schema and validation.
 *
 * This module validates inert JSON data only. It must not import workflow
 * source readers, ODW runtime helpers, or analyser code that could evaluate a
 * workflow while configuration is being loaded.
 */

import { RULE_IDS } from "../diagnostics/rule-catalogue";
import { parseRuleId, type RuleId } from "../diagnostics/rule-id";
import { DIAGNOSTIC_SEVERITIES } from "../diagnostics/severity";

const KNOWN_CONFIG_KEYS = Object.freeze(["include", "exclude", "strictClaude", "rules"] as const);
const CATALOGUED_RULE_IDS = new Set<string>(RULE_IDS);

/**
 * Severity override values accepted in the `rules` configuration map.
 */
export const CONFIGURED_RULE_SEVERITIES = Object.freeze([...DIAGNOSTIC_SEVERITIES, "off"] as const);
const CONFIGURED_RULE_SEVERITY_VALUES = new Set<string>(CONFIGURED_RULE_SEVERITIES);

/**
 * Effective rule setting from configuration.
 */
export type ConfiguredRuleSeverity = (typeof CONFIGURED_RULE_SEVERITIES)[number];

/**
 * Validated linter configuration.
 */
export type LinterConfig = {
  /** Glob patterns to include during future configured discovery. */
  readonly include?: readonly string[];
  /** Glob patterns to exclude during future configured discovery. */
  readonly exclude?: readonly string[];
  /** Whether Claude compatibility warnings should be promoted. */
  readonly strictClaude?: boolean;
  /** Per-rule severity settings keyed by branded rule identifiers. */
  readonly rules?: ReadonlyMap<RuleId, ConfiguredRuleSeverity>;
};

/**
 * Machine-readable configuration validation error.
 */
export type ConfigValidationError =
  | {
      readonly kind: "not-an-object";
      readonly message: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "invalid-include" | "invalid-exclude";
      readonly key: "include" | "exclude";
      readonly message: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "invalid-strict-claude";
      readonly key: "strictClaude";
      readonly message: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "invalid-rules";
      readonly key: "rules";
      readonly message: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "unknown-rule-id";
      readonly key: string;
      readonly message: string;
    }
  | {
      readonly kind: "invalid-rule-severity";
      readonly key: string;
      readonly message: string;
      readonly value: unknown;
    };

/**
 * Machine-readable configuration validation warning.
 */
export type ConfigValidationWarning = {
  /** Warning kind. */
  readonly kind: "unknown-key";
  /** Unknown top-level key. */
  readonly key: string;
  /** Human-readable warning. */
  readonly message: string;
};

/**
 * Discriminated validation result for linter configuration JSON.
 */
export type ConfigValidationResult =
  | {
      readonly ok: true;
      readonly config: LinterConfig;
      readonly warnings: readonly ConfigValidationWarning[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly ConfigValidationError[];
      readonly warnings: readonly ConfigValidationWarning[];
    };

type MutableLinterConfig = {
  include?: readonly string[];
  exclude?: readonly string[];
  strictClaude?: boolean;
  rules?: ReadonlyMap<RuleId, ConfiguredRuleSeverity>;
};

type ConfigObject = Record<string, unknown> & {
  readonly include?: unknown;
  readonly exclude?: unknown;
  readonly strictClaude?: unknown;
  readonly rules?: unknown;
};

type GlobListKey = "include" | "exclude";
type ConfigValidationPart = {
  readonly config: MutableLinterConfig;
  readonly errors: readonly ConfigValidationError[];
};

/** A frozen read-only facade over validated rule settings. */
class ImmutableRulesMap implements ReadonlyMap<RuleId, ConfiguredRuleSeverity> {
  readonly #rules: ReadonlyMap<RuleId, ConfiguredRuleSeverity>;
  public readonly [Symbol.toStringTag] = "Map";

  public constructor(entries: Iterable<readonly [RuleId, ConfiguredRuleSeverity]>) {
    this.#rules = new Map(entries);
    Object.freeze(this);
  }

  public get size(): number {
    return this.#rules.size;
  }

  public entries(): ReturnType<ReadonlyMap<RuleId, ConfiguredRuleSeverity>["entries"]> {
    return this.#rules.entries();
  }

  public forEach(
    callbackfn: (
      value: ConfiguredRuleSeverity,
      key: RuleId,
      map: ReadonlyMap<RuleId, ConfiguredRuleSeverity>,
    ) => void,
    thisArg?: unknown,
  ): void {
    this.#rules.forEach((value, key) => {
      callbackfn.call(thisArg, value, key, this);
    });
  }

  public get(key: RuleId): ConfiguredRuleSeverity | undefined {
    return this.#rules.get(key);
  }

  public has(key: RuleId): boolean {
    return this.#rules.has(key);
  }

  public keys(): ReturnType<ReadonlyMap<RuleId, ConfiguredRuleSeverity>["keys"]> {
    return this.#rules.keys();
  }

  public values(): ReturnType<ReadonlyMap<RuleId, ConfiguredRuleSeverity>["values"]> {
    return this.#rules.values();
  }

  public [Symbol.iterator](): ReturnType<
    ReadonlyMap<RuleId, ConfiguredRuleSeverity>[typeof Symbol.iterator]
  > {
    return this.entries();
  }
}

/**
 * Validates an unknown JSON value as an `odw-lint` configuration object.
 *
 * @param value Parsed JSON value to validate.
 * @returns Structured validation result with all observed errors and warnings.
 *
 * @example
 * ```ts
 * const result = validateLinterConfig({ strictClaude: true });
 * if (result.ok) {
 *   console.log(result.config.strictClaude);
 * }
 * ```
 */
export const validateLinterConfig = (value: unknown): ConfigValidationResult => {
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [
        {
          kind: "not-an-object",
          message: "Linter configuration must be a JSON object.",
          value,
        },
      ],
      warnings: [],
    };
  }

  const warnings = unknownKeyWarnings(value);
  const { config, errors } = validateKnownConfig(value);

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors), warnings };
  }

  return { ok: true, config: Object.freeze(config), warnings };
};

/** Checks whether a parsed JSON value is a non-array object. */
const isRecord = (value: unknown): value is ConfigObject => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** Builds warnings for pre-1.0 top-level keys the current schema ignores. */
const unknownKeyWarnings = (value: ConfigObject): readonly ConfigValidationWarning[] => {
  const knownKeys = new Set<string>(KNOWN_CONFIG_KEYS);
  return Object.freeze(
    Object.keys(value)
      .filter((key) => !knownKeys.has(key))
      .map((key) => ({
        kind: "unknown-key" as const,
        key,
        message: `Unknown configuration key "${key}" will be ignored.`,
      })),
  );
};

/** Validates every known optional configuration key and merges the results. */
const validateKnownConfig = (value: ConfigObject): ConfigValidationPart => {
  const parts = [
    validateOptionalGlobList(value, "include"),
    validateOptionalGlobList(value, "exclude"),
    validateOptionalStrictClaude(value),
    validateOptionalRules(value),
  ];

  return {
    config: Object.assign({}, ...parts.map((part) => part.config)),
    errors: Object.freeze(parts.flatMap((part) => part.errors)),
  };
};

/** Validates an optional include/exclude glob-list key. */
const validateOptionalGlobList = (config: ConfigObject, key: GlobListKey): ConfigValidationPart => {
  if (!Object.hasOwn(config, key)) {
    return { config: {}, errors: [] };
  }

  const result = validateGlobList(key, config[key]);
  if (!result.ok) {
    return { config: {}, errors: [result.error] };
  }

  return key === "include"
    ? { config: { include: result.value }, errors: [] }
    : { config: { exclude: result.value }, errors: [] };
};

/** Validates the optional strict-Claude promotion switch. */
const validateOptionalStrictClaude = (config: ConfigObject): ConfigValidationPart => {
  if (!Object.hasOwn(config, "strictClaude")) {
    return { config: {}, errors: [] };
  }

  const value = config.strictClaude;
  if (typeof value === "boolean") {
    return { config: { strictClaude: value }, errors: [] };
  }

  return {
    config: {},
    errors: [
      {
        kind: "invalid-strict-claude",
        key: "strictClaude",
        message: "Configuration key strictClaude must be a boolean.",
        value,
      },
    ],
  };
};

/** Validates the optional rules object. */
const validateOptionalRules = (config: ConfigObject): ConfigValidationPart => {
  if (!Object.hasOwn(config, "rules")) {
    return { config: {}, errors: [] };
  }

  const result = validateRules(config.rules);
  return result.ok
    ? { config: { rules: result.value }, errors: [] }
    : { config: {}, errors: result.errors };
};

/** Validates one include/exclude value as an array of non-empty strings. */
const validateGlobList = (
  key: GlobListKey,
  value: unknown,
):
  | { readonly ok: true; readonly value: readonly string[] }
  | { readonly ok: false; readonly error: ConfigValidationError } => {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    return {
      ok: false,
      error: {
        kind: key === "include" ? "invalid-include" : "invalid-exclude",
        key,
        message: `Configuration key ${key} must be an array of non-empty strings.`,
        value,
      },
    };
  }

  return { ok: true, value: Object.freeze([...value]) };
};

/** Validates the configured per-rule severity map. */
const validateRules = (
  value: unknown,
):
  | { readonly ok: true; readonly value: ReadonlyMap<RuleId, ConfiguredRuleSeverity> }
  | { readonly ok: false; readonly errors: readonly ConfigValidationError[] } => {
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [
        {
          kind: "invalid-rules",
          key: "rules",
          message: "Configuration key rules must be an object.",
          value,
        },
      ],
    };
  }

  const errors: ConfigValidationError[] = [];
  const rules = new Map<RuleId, ConfiguredRuleSeverity>();

  for (const [key, setting] of Object.entries(value)) {
    const parsed = parseRuleId(key);
    if (!parsed.ok || !CATALOGUED_RULE_IDS.has(key)) {
      errors.push({
        kind: "unknown-rule-id",
        key,
        message: `Unknown rule identifier "${key}" in configuration.`,
      });
      continue;
    }

    if (!isConfiguredRuleSeverity(setting)) {
      errors.push({
        kind: "invalid-rule-severity",
        key,
        message: `Invalid severity "${String(setting)}" for rule "${key}".`,
        value: setting,
      });
      continue;
    }

    rules.set(parsed.value, setting);
  }

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors) };
  }

  return { ok: true, value: new ImmutableRulesMap(rules) };
};

/** Checks whether a value is in the configured severity vocabulary. */
const isConfiguredRuleSeverity = (value: unknown): value is ConfiguredRuleSeverity => {
  return typeof value === "string" && CONFIGURED_RULE_SEVERITY_VALUES.has(value);
};
