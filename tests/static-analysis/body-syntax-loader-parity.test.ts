/**
 * @file Characterizes ODW loader workflow-body syntax rejection.
 */

import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { makeRuleId, parseWorkflowBody, ruleDefinitionFor } from "odw-lint";
import {
  ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES,
  TYPESCRIPT_ONLY_DIALECT_BODIES,
} from "./typescript-only-dialect-bodies";
import { envelopeForBody } from "./workflow-envelope-support";

type BodyConstructor = (body: string) => unknown;
type OdwLintDecision = {
  readonly diagnostic: null | {
    readonly message: string;
    readonly rule: string;
  };
  readonly rejects: boolean;
};
type BodySyntaxParityReport = {
  readonly bodyLabel: string;
  readonly divergence:
    | "none"
    | "loader-accepts-odw-lint-rejects"
    | "loader-rejects-odw-lint-accepts";
  readonly expectedRejects: boolean;
  readonly loaderRejects: boolean;
  readonly odwLintDiagnostic: OdwLintDecision["diagnostic"];
  readonly odwLintRejects: boolean;
};
type ODWLoaderModule = {
  readonly loadWorkflowScript: (source: string, filename: string) => unknown;
};

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as BodyConstructor;
const ODW_LOADER_MODULE_PATH = "/data/leynos/Projects/open-dynamic-workflows/src/loader.ts";
const ODW_LOADER_MODULE_URL = `file://${ODW_LOADER_MODULE_PATH}`;

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
const TYPESCRIPT_ANNOTATION_BODY = TYPESCRIPT_ONLY_DIALECT_BODIES[0];

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
 * Reports whether `odw-lint` accepts or rejects a body with syntax details.
 */
const odwLintDecisionForBody = (body: string): OdwLintDecision => {
  const result = parseWorkflowBody(envelopeForBody(body));

  if (result.ok) {
    return { diagnostic: null, rejects: false };
  }

  return {
    diagnostic: {
      message: result.diagnostic.message,
      rule: result.diagnostic.rule,
    },
    rejects: result.diagnostic.rule === BODY_SYNTAX_RULE.id,
  };
};

/**
 * Names the parity failure direction so assertion output says which side moved.
 */
const divergenceFor = (
  loaderRejects: boolean,
  odwLintRejects: boolean,
): BodySyntaxParityReport["divergence"] => {
  if (loaderRejects === odwLintRejects) {
    return "none";
  }

  return loaderRejects ? "loader-rejects-odw-lint-accepts" : "loader-accepts-odw-lint-rejects";
};

/**
 * Builds a report that makes absolute expectation and parity failures readable.
 */
const parityReportForBody = (
  bodyLabel: string,
  body: string,
  expectedRejects: boolean,
): BodySyntaxParityReport => {
  const loaderRejects = loaderRejectsBody(body);
  const odwLintDecision = odwLintDecisionForBody(body);

  return {
    bodyLabel,
    divergence: divergenceFor(loaderRejects, odwLintDecision.rejects),
    expectedRejects,
    loaderRejects,
    odwLintDiagnostic: odwLintDecision.diagnostic,
    odwLintRejects: odwLintDecision.rejects,
  };
};

/**
 * Asserts that the loader and `odw-lint` match the expected dialect decision.
 */
const expectBodySyntaxParity = (
  bodyLabel: string,
  body: string,
  expectedRejects: boolean,
): void => {
  const report = parityReportForBody(bodyLabel, body, expectedRejects);

  expect(report).toMatchObject({
    divergence: "none",
    expectedRejects,
    loaderRejects: expectedRejects,
    odwLintRejects: expectedRejects,
  });
};

/**
 * Wraps a body in the minimal source shape accepted by the real ODW loader.
 */
const odwWorkflowSourceForBody = (body: string): string =>
  `export const meta = { name: 'dialect-probe', description: 'd' }\n${body}`;

/**
 * Loads the sibling ODW loader module used for the live characterization.
 */
const importODWLoaderModule = async (): Promise<ODWLoaderModule> => {
  const module = (await import(ODW_LOADER_MODULE_URL)) as ODWLoaderModule;
  return module;
};

describe("ODW loader rejects TypeScript-only workflow bodies", () => {
  it.each(TYPESCRIPT_ONLY_DIALECT_BODIES)("rejects %s", (_label, body) => {
    for (const [_constructorLabel, construct] of LOADER_BODY_CONSTRUCTORS) {
      expect(constructsWithoutSyntaxError(construct, body)).toBeFalse();
    }

    expect(constructionErrorFor(AsyncFunction, body)).toBeInstanceOf(SyntaxError);
  });
});

describe("real ODW loader body syntax characterization", () => {
  it.skipIf(!existsSync(ODW_LOADER_MODULE_PATH))(
    "rejects a TypeScript annotation through loadWorkflowScript",
    async () => {
      const [_label, body] = TYPESCRIPT_ANNOTATION_BODY;
      const { loadWorkflowScript } = await importODWLoaderModule();

      expect(() => loadWorkflowScript(odwWorkflowSourceForBody(body), "dialect-probe.js")).toThrow(
        /failed to compile workflow dialect-probe\.js:/,
      );
    },
  );
});

describe("ODW loader accepts ECMAScript boundary workflow bodies", () => {
  it.each(ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES)("accepts %s", (_label, body) => {
    for (const [_constructorLabel, construct] of LOADER_BODY_CONSTRUCTORS) {
      expect(constructsWithoutSyntaxError(construct, body)).toBeTrue();
    }
  });
});

describe("loader parity for TypeScript-only body syntax", () => {
  it.each(TYPESCRIPT_ONLY_DIALECT_BODIES)("matches rejection for %s", (label, body) => {
    expectBodySyntaxParity(label, body, true);
  });

  it.each(ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES)("matches acceptance for %s", (label, body) => {
    expectBodySyntaxParity(label, body, false);
  });
});
