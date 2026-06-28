/**
 * @file Passive masking fixture with decoy workflow syntax inside template literals.
 */

export const meta = {
  name: "masking-template-decoy",
  description: "Fixture proving template literal decoys are inert.",
};

const templateDecoy = `export const meta = { name: "template-decoy" };
import "fake-workflow-runtime";
export const body = { braceLike: "{{ }" };
${'export const meta = { name: "nested-string-decoy" }'}`;

await Promise.resolve(templateDecoy);
