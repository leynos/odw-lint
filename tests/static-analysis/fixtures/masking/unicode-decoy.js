/**
 * @file Passive masking fixture with Unicode decoy workflow syntax.
 */

export const meta = {
  name: "masking-unicode-decoy",
  description: "Fixture proving Unicode decoys are inert.",
};

const unicodeDecoy =
  'export const meta = { name: "unicode-decoy-雪" }; import "faké-workflow"; café ☃';

await Promise.resolve(unicodeDecoy);
