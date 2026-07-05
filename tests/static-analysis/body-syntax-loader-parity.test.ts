/**
 * @file Characterizes ODW loader workflow-body syntax rejection.
 */

import { describe, expect, it } from "bun:test";
import { makeRuleId, parseWorkflowBody, ruleDefinitionFor } from "odw-lint";
import {
  ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES,
  TYPESCRIPT_ONLY_DIALECT_BODIES,
} from "./typescript-only-dialect-bodies";
import { envelopeForBody } from "./workflow-envelope-support";

type BodyConstructor = (body: string) => unknown;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as BodyConstructor;

/**
 * ODW compiles workflow bodies through a JavaScript function constructor path
 * per ADR 0002. This probe constructs fixed, author-controlled literals only;
 * it never invokes the constructed function and never reads fixture or user
 * source.
 */
const LOADER_BODY_CONSTRUCTORS = [
  ["Function", Function],
  ["AsyncFunction", AsyncFunction],
] as const satisfies readonly (readonly [label: string, construct: BodyConstructor])[];

const BODY_SYNTAX_RULE = ruleDefinitionFor(makeRuleId("odw/body-syntax"));

/**
 * Reports whether a body constructs without a JavaScript syntax error.
 */
const constructsWithoutSyntaxError = (construct: BodyConstructor, body: string): boolean => {
  try {
    construct(body);
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }

    throw error;
  }
};

/**
 * Returns the thrown value produced while constructing a body.
 */
const constructionErrorFor = (construct: BodyConstructor, body: string): unknown => {
  try {
    construct(body);
  } catch (error) {
    return error;
  }

  return undefined;
};

/**
 * Reports whether the loader constructor set rejects a body as syntax.
 */
const loaderRejectsBody = (body: string): boolean => {
  const outcomes = LOADER_BODY_CONSTRUCTORS.map(([_label, construct]) =>
    constructsWithoutSyntaxError(construct, body),
  );

  return outcomes.every((constructs) => constructs === false);
};

/**
 * Reports whether `odw-lint` rejects a body with the dialect syntax rule.
 */
const odwLintRejectsBody = (body: string): boolean => {
  const result = parseWorkflowBody(envelopeForBody(body));

  if (result.ok) {
    return false;
  }

  return result.diagnostic.rule === BODY_SYNTAX_RULE.id;
};

/**
 * Asserts that the constructor probe and `odw-lint` make the same decision.
 */
const expectLoaderParityForBody = (body: string): void => {
  const loaderRejects = loaderRejectsBody(body);
  const odwLintRejects = odwLintRejectsBody(body);

  expect(odwLintRejects).toBe(loaderRejects);
};

describe("ODW loader rejects TypeScript-only workflow bodies", () => {
  it.each(TYPESCRIPT_ONLY_DIALECT_BODIES)("rejects %s", (_label, body) => {
    for (const [_constructorLabel, construct] of LOADER_BODY_CONSTRUCTORS) {
      expect(constructsWithoutSyntaxError(construct, body)).toBeFalse();
    }

    expect(constructionErrorFor(AsyncFunction, body)).toBeInstanceOf(SyntaxError);
  });
});

describe("ODW loader accepts ECMAScript boundary workflow bodies", () => {
  it.each(ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES)("accepts %s", (_label, body) => {
    for (const [_constructorLabel, construct] of LOADER_BODY_CONSTRUCTORS) {
      expect(constructsWithoutSyntaxError(construct, body)).toBeTrue();
    }
  });
});

describe("loader parity for TypeScript-only body syntax", () => {
  it.each(TYPESCRIPT_ONLY_DIALECT_BODIES)("matches rejection for %s", (_label, body) => {
    expectLoaderParityForBody(body);
  });

  it.each(ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES)("matches acceptance for %s", (_label, body) => {
    expectLoaderParityForBody(body);
  });
});
