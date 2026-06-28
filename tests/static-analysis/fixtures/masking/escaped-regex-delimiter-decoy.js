/**
 * @file Passive masking fixture with escaped regex-delimiter decoy syntax.
 */

export const meta = {
  name: "masking-escaped-regex-delimiter-decoy",
  description: "Fixture proving escaped regex delimiter decoys are inert.",
};

const escapedRegexDelimiterDecoy =
  /\/export const meta = \{ name: "escaped-regex-delimiter-decoy" \}\/; import ["']fake\/workflow["'];/;

await Promise.resolve(escapedRegexDelimiterDecoy);
