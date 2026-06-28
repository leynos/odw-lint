/**
 * @file Passive masking fixture with decoy workflow syntax inside a regex literal.
 */

export const meta = {
  name: "masking-regex-decoy",
  description: "Fixture proving regex decoys are inert.",
};

const regexDecoy =
  /export const meta = \{ name: "regex-decoy" \}; import ["']fake\/workflow["']; export \{ value \}; [}{]/;

await Promise.resolve(regexDecoy);
