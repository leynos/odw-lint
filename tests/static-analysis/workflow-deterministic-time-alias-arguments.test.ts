/**
 * @file Argument-wrapper regression tests for deterministic-time aliases.
 */

import { describe, expect, it } from "bun:test";
import type { Diagnostic } from "odw-lint";
import { createOriginalSourceFile, makeRuleId, scanWorkflowEnvelope } from "odw-lint";
import { scanDeterministicTimeWarnings } from "../../src/static-analysis/workflow-deterministic-time";
import { decodeSpanText } from "./source-span-oracle";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const DEFAULT_META = 'export const meta = { name: "time-check", description: "ok" };';
const DATE_NOW_RULE = makeRuleId("odw/no-date-now");
const MATH_RANDOM_RULE = makeRuleId("odw/no-math-random");

/** Scans one workflow body and returns diagnostics with source context. */
const scanBody = (
  body: string,
): {
  readonly sourceText: string;
  readonly diagnostics: readonly Diagnostic[];
} => {
  const sourceText = `${DEFAULT_META}\n${body}\n`;
  const sourceFile = createOriginalSourceFile({
    filePath: "workflows/argument-iife-aliases.js",
    sourceText,
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), "argument-iife-aliases");

  return {
    sourceText,
    diagnostics: scanDeterministicTimeWarnings(envelope),
  };
};

/** Returns the only diagnostic from a focused one-warning body. */
const expectSingleDiagnostic = (diagnostics: readonly Diagnostic[]): Diagnostic => {
  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0];
  if (diagnostic === undefined) {
    throw new Error("Expected one argument-scoped alias diagnostic.");
  }

  return diagnostic;
};

describe("argument-scoped deterministic-time aliases", () => {
  it("collects Date.now aliases from immediately invoked functions in call arguments", () => {
    const { sourceText, diagnostics } = scanBody(
      "consume((() => { const now = Date?.now; return now(); })());",
    );
    const diagnostic = expectSingleDiagnostic(diagnostics);

    expect(diagnostic.rule).toBe(DATE_NOW_RULE);
    expect(decodeSpanText(sourceText, diagnostic.span)).toBe("now");
  });

  it("collects Math.random aliases from immediately invoked functions in new arguments", () => {
    const { sourceText, diagnostics } = scanBody(
      "new Worker((() => { const random = Math?.random; return random(); })());",
    );
    const diagnostic = expectSingleDiagnostic(diagnostics);

    expect(diagnostic.rule).toBe(MATH_RANDOM_RULE);
    expect(decodeSpanText(sourceText, diagnostic.span)).toBe("random");
  });
});
