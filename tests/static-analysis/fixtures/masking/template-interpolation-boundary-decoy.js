/**
 * @file Passive masking fixture with template interpolation boundary decoys.
 */

export const meta = {
  name: "masking-template-interpolation-boundary-decoy",
  description: "Fixture proving template interpolation boundary decoys are inert.",
};

const nestedName = "nested-interpolation-decoy";
const interpolationBoundaryDecoy = `export const meta = { name: "template-boundary-decoy" };
${`import "fake-${nestedName}";`}
${"{ notRealWorkflow: true }"}`;

await Promise.resolve(interpolationBoundaryDecoy);
