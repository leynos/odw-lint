/**
 * @file Passive masking fixture with decoy workflow syntax inside strings.
 */

export const meta = {
  name: "masking-string-decoy",
  description: "Fixture proving string decoys are inert.",
};

const doubleQuotedDecoy = 'export const meta = { name: "double-quoted-decoy" }; import "fake"; }';
const singleQuotedDecoy =
  'export default { name: "single-quoted-decoy", note: \'escaped boundary\' }; export const extra = "decoy";';

await Promise.resolve([doubleQuotedDecoy, singleQuotedDecoy]);
