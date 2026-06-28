/**
 * @file Passive masking fixture with decoy workflow syntax across CRLF text.
 *
 * Excluded from Biome formatting because the template literal below preserves
 * an actual CRLF byte pair for fixture coverage.
 */

export const meta = {
  name: "masking-crlf-decoy",
  description: "Fixture proving CRLF source-boundary decoys are inert.",
};

const crlfDecoy = `export const meta = { name: "crlf-decoy" };
import "fake-workflow-runtime";`;

await Promise.resolve(crlfDecoy);
