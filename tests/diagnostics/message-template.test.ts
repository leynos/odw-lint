/**
 * @file Diagnostic message-template contract tests.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import * as fc from "fast-check";
import {
  createMessageTemplate,
  type MessageTemplateValues,
  messageMatchesTemplate,
  renderMessageTemplate,
} from "odw-lint";

const MESSAGE_TEMPLATE_PROPERTY_RUNNER = { seed: 0x2182026, numRuns: 200 } as const;
const GENERATED_TEMPLATE_PARTS = fc.array(
  fc.constantFrom(
    { kind: "literal", text: "Workflow body: " },
    { kind: "literal", text: " after ODW normalization. " },
    { kind: "literal", text: " literal (.) [ok] " },
    { kind: "placeholder", name: "detail" },
    { kind: "placeholder", name: "token" },
    { kind: "placeholder", name: "reason" },
  ),
  { minLength: 1, maxLength: 8 },
);

/** Renders generated template fragments to reviewed template text. */
const templateTextFor = (
  parts: readonly { readonly kind: string; readonly text?: string; readonly name?: string }[],
): string => {
  return parts
    .map((part) => {
      if (part.kind === "placeholder") {
        return `{${part.name ?? ""}}`;
      }

      return part.text ?? "";
    })
    .join("");
};

/** Builds deterministic non-empty placeholder values for generated templates. */
const valuesFor = (placeholderNames: readonly string[]): Readonly<Record<string, string>> => {
  return Object.fromEntries(
    placeholderNames.map((name) => [name, `generated value for ${name} (.+)`]),
  );
};

describe("diagnostic message templates", () => {
  it("extracts unique placeholders in first-appearance order", () => {
    const template = createMessageTemplate("{detail}: {token} then {detail}");

    expect(template).toEqual({
      template: "{detail}: {token} then {detail}",
      placeholders: ["detail", "token"],
    });
    expect(Object.isFrozen(template)).toBeTrue();
    expect(Object.isFrozen(template.placeholders)).toBeTrue();
    expectTypeOf(template.placeholders).toEqualTypeOf<readonly string[]>();
  });

  it.each([
    ["unclosed placeholder", "prefix {detail"],
    ["unopened placeholder", "prefix detail}"],
    ["empty placeholder", "prefix {}"],
    ["numeric placeholder start", "prefix {1x}"],
    ["placeholder with whitespace", "prefix {a b}"],
  ])("rejects malformed template text: %s", (_name, templateText) => {
    expect(() => createMessageTemplate(templateText)).toThrow(/placeholder/u);
  });

  it("renders all placeholder occurrences with exact values", () => {
    const template = createMessageTemplate("{detail}: {token} then {detail}");

    expect(
      renderMessageTemplate(template, {
        detail: "missing brace",
        token: "}",
      }),
    ).toBe("missing brace: } then missing brace");
  });

  it("rejects missing and unknown render values", () => {
    const template = createMessageTemplate("{detail}: {token}");

    expect(() => renderMessageTemplate(template, { detail: "missing token" })).toThrow(
      /missing: token/u,
    );
    expect(() => renderMessageTemplate(template, { detail: "", token: "ok" })).toThrow(
      /empty: detail/u,
    );
    expect(() =>
      renderMessageTemplate(template, {
        detail: "ok",
        token: "ok",
        unknown: "extra",
      }),
    ).toThrow(/unknown: unknown/u);
  });

  it("requires reserved placeholder names to be own render values", () => {
    const template = createMessageTemplate("{constructor}");
    const inheritedValues = Object.create({
      constructor: "inherited value",
    }) as MessageTemplateValues;

    expect(() => renderMessageTemplate(template, inheritedValues)).toThrow(/missing: constructor/u);
    expect(renderMessageTemplate(template, { constructor: "own value" })).toBe("own value");
  });

  it("matches rendered messages without broad substring acceptance", () => {
    const template = createMessageTemplate("Workflow body ({detail}) must end with {token}.");
    const message = renderMessageTemplate(template, {
      detail: "unexpected .+ token",
      token: "}",
    });

    expect(messageMatchesTemplate(template, message)).toBeTrue();
    expect(messageMatchesTemplate(template, "Workflow body (unexpected .+ token)")).toBeFalse();
    expect(
      messageMatchesTemplate(template, "body (unexpected .+ token) must end with }."),
    ).toBeFalse();
    expect(messageMatchesTemplate(template, "Workflow body () must end with }.")).toBeFalse();
    expect(messageMatchesTemplate(template, `prefix ${message} suffix`)).toBeFalse();
  });

  it("requires repeated placeholders to match the same dynamic value", () => {
    const template = createMessageTemplate("{detail}: {token} then {detail}");

    expect(
      messageMatchesTemplate(
        template,
        renderMessageTemplate(template, { detail: "same", token: "}" }),
      ),
    ).toBeTrue();
    expect(messageMatchesTemplate(template, "same: } then different")).toBeFalse();
  });

  it("matches every generated rendered message to its template", () => {
    fc.assert(
      fc.property(GENERATED_TEMPLATE_PARTS, (parts) => {
        const template = createMessageTemplate(templateTextFor(parts));
        const rendered = renderMessageTemplate(template, valuesFor(template.placeholders));

        expect(messageMatchesTemplate(template, rendered)).toBeTrue();
      }),
      MESSAGE_TEMPLATE_PROPERTY_RUNNER,
    );
  });
});
