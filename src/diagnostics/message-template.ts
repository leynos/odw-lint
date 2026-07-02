/**
 * @file Reviewed diagnostic message-template contract.
 *
 * Templates are static strings owned by the rule catalogue. They allow dynamic
 * parser detail to stay reviewable without weakening tests to substring checks.
 */

/** A reviewed diagnostic message with zero or more `{name}` placeholders. */
export type MessageTemplate = {
  /** Reviewed template text containing `{name}` placeholders. */
  readonly template: string;
  /** Unique placeholder names in first-appearance order. */
  readonly placeholders: readonly string[];
};

/** Placeholder values keyed by placeholder name. */
export type MessageTemplateValues = Readonly<Record<string, string>>;

const PLACEHOLDER_NAME_SOURCE = "[A-Za-z][A-Za-z0-9]*";
const PLACEHOLDER_NAME_PATTERN = new RegExp(`^${PLACEHOLDER_NAME_SOURCE}$`, "u");
const PLACEHOLDER_PATTERN_SOURCE = `\\{(${PLACEHOLDER_NAME_SOURCE})\\}`;
const REGEXP_METACHARACTER_PATTERN = /[\\^$.*+?()[\]{}|]/gu;

/**
 * Parses reviewed template text into a frozen message template.
 *
 * @param template - Reviewed template text containing `{name}` placeholders.
 * @returns Frozen message template with unique placeholder names.
 */
export const createMessageTemplate = (template: string): MessageTemplate => {
  const placeholders = scanPlaceholders(template);

  return Object.freeze({
    template,
    placeholders: Object.freeze([...placeholders]),
  });
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

  return template.template.replaceAll(placeholderMatcher(), (_match, name: string) => {
    return requiredPlaceholderValue(values, name);
  });
};

/**
 * Reports whether a concrete message could come from the template.
 *
 * @param template - Reviewed message template to test against.
 * @param message - Concrete diagnostic message emitted by a rule.
 * @returns True when the message fully matches the reviewed template.
 */
export const messageMatchesTemplate = (template: MessageTemplate, message: string): boolean => {
  return templateRegex(template).test(message);
};

/** Extracts valid placeholder names in stable first-appearance order. */
const scanPlaceholders = (template: string): readonly string[] => {
  const placeholders: string[] = [];
  const seenPlaceholders = new Set<string>();
  let index = 0;

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

    const name = template.slice(index + 1, closeIndex);
    assertPlaceholderName(name);
    if (!seenPlaceholders.has(name)) {
      placeholders.push(name);
      seenPlaceholders.add(name);
    }
    index = closeIndex + 1;
  }

  return placeholders;
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

/** Converts reviewed template text to a whole-message matching expression. */
const templateRegex = (template: MessageTemplate): RegExp => {
  const parts: string[] = ["^"];
  const capturedNames = new Set<string>();
  let index = 0;

  for (const match of template.template.matchAll(placeholderMatcher())) {
    const matchText = match[0];
    const placeholderName = match[1];
    const matchIndex = match.index;
    if (matchIndex === undefined) {
      throw new Error("Message template placeholder match is missing its index.");
    }
    if (placeholderName === undefined) {
      throw new Error("Message template placeholder match is missing its name.");
    }

    parts.push(escapeRegExp(template.template.slice(index, matchIndex)));
    parts.push(placeholderPattern(placeholderName, capturedNames));
    index = matchIndex + matchText.length;
  }

  parts.push(escapeRegExp(template.template.slice(index)));
  parts.push("$");

  return new RegExp(parts.join(""), "u");
};

/** Creates a fresh placeholder matcher so global regex state cannot leak. */
const placeholderMatcher = (): RegExp => {
  return new RegExp(PLACEHOLDER_PATTERN_SOURCE, "gu");
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
