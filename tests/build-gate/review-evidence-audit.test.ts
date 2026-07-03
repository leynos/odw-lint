/**
 * @file Asserts AGENTS.md requires the roadmap review/audit path to run and
 * record `make review-evidence`, so the gate is not left to reviewer memory.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const agentsPath = join(repositoryRoot, "AGENTS.md");
const sectionHeading = "## Roadmap Review & Audit Evidence";

/** Reads the roadmap review/audit contract section when it exists. */
function readAgentsSection(): string | undefined {
  const agents = readFileSync(agentsPath, "utf8").replaceAll("\r\n", "\n");
  const sectionStart = agents.indexOf(`${sectionHeading}\n`);

  if (sectionStart === -1) {
    return undefined;
  }

  const nextSectionStart = agents.indexOf("\n## ", sectionStart + 1);

  return nextSectionStart === -1
    ? agents.slice(sectionStart)
    : agents.slice(sectionStart, nextSectionStart);
}

describe("roadmap review evidence audit contract", () => {
  it("requires roadmap review and audit runs to record review-evidence output", () => {
    const section = readAgentsSection();

    expect(section, `${sectionHeading} section should exist`).toBeDefined();

    const contractChecks: ReadonlyArray<{
      readonly name: string;
      readonly pattern: RegExp;
    }> = [
      {
        name: "names the review-evidence target",
        pattern: /`make review-evidence`/,
      },
      {
        name: "makes the target normative",
        pattern: /\b(?:required|must)\b/i,
      },
      {
        name: "requires recorded evidence",
        pattern: /\brecord/i,
      },
    ];

    for (const { name, pattern } of contractChecks) {
      expect(section, name).toMatch(pattern);
    }
  });
});
