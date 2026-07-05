/**
 * @file Tests for shared fixture diagnostic projection helpers.
 */

import { beforeAll, describe, expect, it } from "bun:test";
import { lintWorkflowSource, sliceSourceSpan, type WorkflowLintResult } from "odw-lint";
import { readFixtureSource } from "./fixtures/corpus-support";
import {
  liveDiagnosticToComparable,
  manifestDiagnosticToComparable,
} from "./fixtures/diagnostic-projection";
import {
  findInvalidWorkflowFixture,
  INVALID_WORKFLOW_FIXTURE_CORPUS,
} from "./fixtures/invalid-workflows/corpus";
import type { InvalidWorkflowFixtureDiagnostic } from "./fixtures/invalid-workflows/manifest-types";

const BODY_SYNTAX_RULE = "odw/body-syntax";
let expectedSyntaxDiagnostic: InvalidWorkflowFixtureDiagnostic;
let liveSyntaxResult: WorkflowLintResult;
let liveSyntaxDiagnostic: WorkflowLintResult["diagnostics"][number];

/** Returns the test fixture state initialized by `beforeAll`. */
const fixtureState = () => {
  return {
    expectedSyntaxDiagnostic,
    liveSyntaxResult,
    liveSyntaxDiagnostic,
  };
};

describe("fixture diagnostic projection helpers", () => {
  beforeAll(() => {
    const syntaxFixture = findInvalidWorkflowFixture({
      family: "syntax-error",
      fileName: "body-unclosed-block.js",
    });
    const expected = syntaxFixture.expectedDiagnostics[0];
    expect(expected).toBeDefined();
    if (expected === undefined) {
      throw new Error("Expected body-unclosed-block.js to pin a body syntax diagnostic.");
    }
    expectedSyntaxDiagnostic = expected;

    liveSyntaxResult = lintWorkflowSource({
      filePath: syntaxFixture.fixturePath,
      sourceText: readFixtureSource(INVALID_WORKFLOW_FIXTURE_CORPUS, syntaxFixture.fixturePath),
    });
    const found = liveSyntaxResult.diagnostics.find(
      (candidate) => String(candidate.rule) === BODY_SYNTAX_RULE,
    );
    expect(found).toBeDefined();
    if (found === undefined) {
      throw new Error(`Expected ${syntaxFixture.fixturePath} to emit ${BODY_SYNTAX_RULE}.`);
    }
    liveSyntaxDiagnostic = found;
  });

  it("projects manifest diagnostics to the canonical comparable shape", () => {
    const { expectedSyntaxDiagnostic } = fixtureState();
    const comparable = manifestDiagnosticToComparable(expectedSyntaxDiagnostic);

    expect({
      ...comparable,
      spanText: JSON.stringify(comparable.spanText),
    }).toMatchSnapshot();
  });

  it("projects live diagnostics to the same comparable shape as the manifest", () => {
    const { expectedSyntaxDiagnostic, liveSyntaxDiagnostic, liveSyntaxResult } = fixtureState();

    expect(liveDiagnosticToComparable(liveSyntaxDiagnostic, liveSyntaxResult.sourceFile)).toEqual(
      manifestDiagnosticToComparable(expectedSyntaxDiagnostic),
    );
  });

  it("normalizes rule brands and derives spanText from the source file", () => {
    const { liveSyntaxDiagnostic, liveSyntaxResult } = fixtureState();
    const comparable = liveDiagnosticToComparable(
      liveSyntaxDiagnostic,
      liveSyntaxResult.sourceFile,
    );

    expect(comparable.rule).toBe(BODY_SYNTAX_RULE);
    expect(comparable.spanText).toBe(
      sliceSourceSpan(liveSyntaxResult.sourceFile, liveSyntaxDiagnostic.span),
    );
  });

  it("throws when live diagnostics omit the documentation path", () => {
    const { liveSyntaxDiagnostic, liveSyntaxResult } = fixtureState();
    const { docs: _docs, ...diagnosticWithoutDocs } = liveSyntaxDiagnostic;

    expect(() =>
      liveDiagnosticToComparable(diagnosticWithoutDocs, liveSyntaxResult.sourceFile),
    ).toThrow(`Live diagnostic ${BODY_SYNTAX_RULE} is missing a docs path.`);
  });
});
