/**
 * @file Property tests for recorded review-evidence tree provenance.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { formatProvenanceTrailer, parseTreeProvenance } from "./review-evidence-provenance";

const lowerHexObjectId = fc.oneof(
  fc.stringMatching(/^[0-9a-f]{40}$/),
  fc.stringMatching(/^[0-9a-f]{64}$/),
);

describe("recorded review-evidence provenance properties", () => {
  it("round-trips arbitrary commit and tree hashes through the trailer", () => {
    fc.assert(
      fc.property(lowerHexObjectId, lowerHexObjectId, (commit, tree) => {
        expect(parseTreeProvenance(formatProvenanceTrailer({ commit, tree }))).toEqual({
          commit,
          tree,
        });
      }),
      { seed: 0x1512, numRuns: 80 },
    );
  });
});
