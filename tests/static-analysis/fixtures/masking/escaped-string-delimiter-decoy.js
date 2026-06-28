/**
 * @file Passive masking fixture with escaped string-delimiter decoy syntax.
 */

export const meta = {
  name: "masking-escaped-string-delimiter-decoy",
  description: "Fixture proving escaped string delimiter decoys are inert.",
};

const escapedSingleQuoteDecoy =
  "export const meta = { name: 'escaped-string-delimiter-decoy' }; import \"fake-single\";";
const escapedBoundaryDecoy =
  "export default { name: \"boundary-decoy\", note: 'escaped boundary' };";

await Promise.resolve([escapedSingleQuoteDecoy, escapedBoundaryDecoy]);
