/**
 * @file Unit tests for recorded review-evidence tree provenance.
 */

import { describe, expect, it } from "bun:test";
import {
  compareTreeProvenance,
  formatProvenanceTrailer,
  parseTreeProvenance,
  type TreeProvenance,
} from "./review-evidence-provenance";

const provenance = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  tree: "fedcba9876543210fedcba9876543210fedcba98",
} satisfies TreeProvenance;

describe("formatProvenanceTrailer", () => {
  it("round-trips through the parser", () => {
    expect(parseTreeProvenance(formatProvenanceTrailer(provenance))).toEqual(provenance);
  });

  it("matches the exact trailer snapshot", () => {
    expect(formatProvenanceTrailer(provenance)).toMatchInlineSnapshot(`
      "- reviewed commit: 0123456789abcdef0123456789abcdef01234567
      - reviewed tree: fedcba9876543210fedcba9876543210fedcba98
      "
    `);
  });

  it("accepts SHA-256 object ids", () => {
    expect(
      formatProvenanceTrailer({
        commit: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        tree: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      }),
    ).toContain(
      "- reviewed tree: fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210\n",
    );
  });

  it.each([
    [
      "uppercase commit",
      "commit",
      { ...provenance, commit: "0123456789ABCDEF0123456789ABCDEF01234567" },
    ],
    ["short tree", "tree", { ...provenance, tree: "fedcba9876543210fedcba9876543210fedcba9" }],
    [
      "newline tree",
      "tree",
      { ...provenance, tree: `${provenance.tree}\n- reviewed tree: injected` },
    ],
  ] satisfies readonly [
    string,
    "commit" | "tree",
    TreeProvenance,
  ][])("rejects malformed %s values", (_name, field, input) => {
    expect(() => formatProvenanceTrailer(input)).toThrow(
      `review evidence ${field} provenance must be a 40- or 64-character lowercase hex object id`,
    );
  });
});

describe("parseTreeProvenance", () => {
  it.each([
    ["missing commit", "- reviewed tree: fedcba9876543210fedcba9876543210fedcba98\n"],
    ["missing tree", "- reviewed commit: 0123456789abcdef0123456789abcdef01234567\n"],
    [
      "malformed commit",
      "- reviewed commit: 0123456789ABCDEF0123456789ABCDEF01234567\n- reviewed tree: fedcba9876543210fedcba9876543210fedcba98\n",
    ],
    [
      "duplicate tree",
      "- reviewed commit: 0123456789abcdef0123456789abcdef01234567\n- reviewed tree: fedcba9876543210fedcba9876543210fedcba98\n- reviewed tree: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n",
    ],
  ])("returns undefined when %s", (_name, content) => {
    expect(parseTreeProvenance(content)).toBeUndefined();
  });

  it("finds provenance inside a completed report", () => {
    const report = [
      "Review evidence: verified",
      "- gate make all: passed",
      "- dual-review path: scrutineer (primary; scrutineer available)",
      formatProvenanceTrailer(provenance).trimEnd(),
      "",
    ].join("\n");

    expect(parseTreeProvenance(report)).toEqual(provenance);
  });
});

describe("compareTreeProvenance", () => {
  it("matches when tree hashes are equal", () => {
    const rebasedProvenance = {
      commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      tree: provenance.tree,
    } satisfies TreeProvenance;

    expect(compareTreeProvenance(provenance, rebasedProvenance)).toBe("match");
  });

  it("mismatches when tree hashes differ", () => {
    expect(
      compareTreeProvenance(provenance, {
        tree: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
    ).toBe("mismatch");
  });
});
