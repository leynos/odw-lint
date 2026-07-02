/**
 * @file Reviewed diagnostic message-template contract.
 *
 * Templates are static strings owned by the rule catalogue. They allow dynamic
 * parser detail to stay reviewable without weakening tests to substring checks.
 */

const messageTemplateBrand: unique symbol = Symbol("messageTemplate");

/** A reviewed diagnostic message with zero or more `{name}` placeholders. */
export type MessageTemplate = {
  /** Reviewed template text containing `{name}` placeholders. */
  readonly template: string;
  /** Unique placeholder names in first-appearance order. */
  readonly placeholders: readonly string[];
  /** Brands reviewed templates so only `createMessageTemplate` can create them. */
  readonly [messageTemplateBrand]: true;
};

/** Placeholder values keyed by placeholder name. */
export type MessageTemplateValues = Readonly<Record<string, string>>;

type MessageTemplateToken =
  | { readonly kind: "literal"; readonly text: string }
  | { readonly kind: "placeholder"; readonly name: string };

type ParsedMessageTemplate = {
  readonly tokens: readonly MessageTemplateToken[];
  readonly placeholders: readonly string[];
};

const PLACEHOLDER_NAME_SOURCE = "[A-Za-z][A-Za-z0-9]*";
const PLACEHOLDER_NAME_PATTERN = new RegExp(`^${PLACEHOLDER_NAME_SOURCE}$`, "u");
const REGEXP_METACHARACTER_PATTERN = /[\\^$.*+?()[\]{}|]/gu;
const MAX_TEMPLATE_LENGTH = 2_000;
const MAX_TEMPLATE_PLACEHOLDER_OCCURRENCES = 16;
const MAX_MATCH_CANDIDATE_LENGTH = 8_192;
const compiledTemplateRegexes = new WeakMap<MessageTemplate, RegExp>();
const parsedTemplateTokens = new WeakMap<MessageTemplate, readonly MessageTemplateToken[]>();

/**
 * Parses reviewed template text into a frozen message template.
 *
 * @param template - Reviewed template text containing `{name}` placeholders.
 * @returns Frozen message template with unique placeholder names.
 */
export const createMessageTemplate = (template: string): MessageTemplate => {
  assertTemplateLength(template);
  const parsedTemplate = parseTemplate(template);
  const messageTemplate = {
    template,
    placeholders: Object.freeze([...parsedTemplate.placeholders]),
  } as MessageTemplate;

  Object.defineProperty(messageTemplate, messageTemplateBrand, {
    value: true,
    enumerable: false,
  });
  parsedTemplateTokens.set(messageTemplate, Object.freeze([...parsedTemplate.tokens]));

  return Object.freeze(messageTemplate);
};

/**
 * Renders a concrete message, requiring exactly the declared placeholders.
 *
 * @param template - Reviewed message template to render.
 * @param values - Placeholder values keyed by the template's placeholder names.
 * @returns Concrete diagnostic message text.
 */
export const renderMessageTemplate = (
  template: MessageTemplate,
  values: MessageTemplateValues,
): string => {
  assertValueKeysMatchTemplate(template, values);

  return tokensFor(template)
    .map((token) => renderToken(token, values))
    .join("");
};

/**
 * Reports whether a concrete message could come from the template.
 *
 * @param template - Reviewed message template to test against.
 * @param message - Concrete diagnostic message emitted by a rule.
 * @returns True when the message fully matches the reviewed template.
 */
export const messageMatchesTemplate = (template: MessageTemplate, message: string): boolean => {
  if (!isMatchCandidateWithinBounds(message)) {
    return false;
  }

  return templateRegex(template).test(message);
};

/** Parses reviewed template text into reusable render and match tokens. */
const parseTemplate = (template: string): ParsedMessageTemplate => {
  const tokens: MessageTemplateToken[] = [];
  const placeholders: string[] = [];
  const seenPlaceholders = new Set<string>();
  let placeholderOccurrences = 0;
  let index = 0;
  let literalStart = 0;

  while (index < template.length) {
    const character = template[index] ?? "";
    if (character === "}") {
      throw new Error("Message template contains an unopened placeholder.");
    }
    if (character !== "{") {
      index += 1;
      continue;
    }

    const closeIndex = template.indexOf("}", index + 1);
    if (closeIndex === -1) {
      throw new Error("Message template contains an unclosed placeholder.");
    }

    tokens.push({ kind: "literal", text: template.slice(literalStart, index) });
    const name = template.slice(index + 1, closeIndex);
    assertPlaceholderName(name);
    placeholderOccurrences += 1;
    assertPlaceholderOccurrences(placeholderOccurrences);
    tokens.push({ kind: "placeholder", name });
    if (!seenPlaceholders.has(name)) {
      placeholders.push(name);
      seenPlaceholders.add(name);
    }
    index = closeIndex + 1;
    literalStart = index;
  }

  tokens.push({ kind: "literal", text: template.slice(literalStart) });

  return {
    tokens: Object.freeze(tokens),
    placeholders: Object.freeze(placeholders),
  };
};

/** Verifies reviewed templates stay small enough for deterministic matching. */
const assertTemplateLength = (template: string): void => {
  if (template.length > MAX_TEMPLATE_LENGTH) {
    throw new Error(
      `Message template exceeds maximum length of ${MAX_TEMPLATE_LENGTH} characters.`,
    );
  }
};

/** Verifies dynamic placeholders cannot create pathological matchers. */
const assertPlaceholderOccurrences = (placeholderOccurrences: number): void => {
  if (placeholderOccurrences > MAX_TEMPLATE_PLACEHOLDER_OCCURRENCES) {
    throw new Error(
      `Message template exceeds maximum placeholder count of ${MAX_TEMPLATE_PLACEHOLDER_OCCURRENCES}.`,
    );
  }
};

/** Verifies a placeholder name is explicit and unambiguous. */
const assertPlaceholderName = (name: string): void => {
  if (!PLACEHOLDER_NAME_PATTERN.test(name)) {
    throw new Error(`Message template placeholder has invalid name: ${name}`);
  }
};

/** Verifies render values exactly cover the template placeholder set. */
const assertValueKeysMatchTemplate = (
  template: MessageTemplate,
  values: MessageTemplateValues,
): void => {
  const expectedNames = new Set(template.placeholders);
  const valueNames = Object.keys(values);
  const missingName = template.placeholders.find((name) => !Object.hasOwn(values, name));
  if (missingName !== undefined) {
    throw new Error(`Message template render value is missing: ${missingName}`);
  }

  const emptyName = template.placeholders.find(
    (name) => requiredPlaceholderValue(values, name) === "",
  );
  const unknownName = valueNames.find((name) => !expectedNames.has(name));

  if (emptyName !== undefined) {
    throw new Error(`Message template render value is empty: ${emptyName}`);
  }
  if (unknownName !== undefined) {
    throw new Error(`Message template render value is unknown: ${unknownName}`);
  }
};

/** Reads an own placeholder value after render-key validation. */
const requiredPlaceholderValue = (values: MessageTemplateValues, name: string): string => {
  if (!Object.hasOwn(values, name)) {
    throw new Error(`Message template render value is missing: ${name}`);
  }

  const value = values[name];
  if (value === undefined) {
    throw new Error(`Message template render value is missing: ${name}`);
  }

  return value;
};

/** Renders one parsed template token. */
const renderToken = (token: MessageTemplateToken, values: MessageTemplateValues): string => {
  if (token.kind === "literal") {
    return token.text;
  }

  return requiredPlaceholderValue(values, token.name);
};

/** Reports whether parser detail is small enough to attempt template matching. */
const isMatchCandidateWithinBounds = (message: string): boolean => {
  return message.length <= MAX_MATCH_CANDIDATE_LENGTH;
};

/** Returns the token stream attached to an opaque reviewed template. */
const tokensFor = (template: MessageTemplate): readonly MessageTemplateToken[] => {
  const tokens = parsedTemplateTokens.get(template);
  if (tokens === undefined) {
    throw new Error("Message template was not created by createMessageTemplate.");
  }

  return tokens;
};

/** Converts reviewed template text to a whole-message matching expression. */
const templateRegex = (template: MessageTemplate): RegExp => {
  const compiledRegex = compiledTemplateRegexes.get(template);
  if (compiledRegex !== undefined) {
    return compiledRegex;
  }

  const parts: string[] = ["^"];
  const capturedNames = new Set<string>();

  for (const token of tokensFor(template)) {
    parts.push(tokenPattern(token, capturedNames));
  }
  parts.push("$");

  const regex = new RegExp(parts.join(""), "u");
  compiledTemplateRegexes.set(template, regex);
  return regex;
};

/** Builds a regex fragment for one parsed template token. */
const tokenPattern = (token: MessageTemplateToken, capturedNames: Set<string>): string => {
  if (token.kind === "literal") {
    return escapeRegExp(token.text);
  }

  return placeholderPattern(token.name, capturedNames);
};

/** Builds a capture or backreference for a placeholder occurrence. */
const placeholderPattern = (name: string, capturedNames: Set<string>): string => {
  if (capturedNames.has(name)) {
    return `\\k<${name}>`;
  }

  capturedNames.add(name);
  return `(?<${name}>[\\s\\S]+?)`;
};

/** Escapes literal template text before it is embedded in a regex. */
const escapeRegExp = (text: string): string => {
  return text.replaceAll(REGEXP_METACHARACTER_PATTERN, "\\$&");
};
