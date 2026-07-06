/**
 * @file Dual-compatibility fixture with closed-constant metadata concatenation.
 */

export const meta = {
  name: "claude-pure-meta-concat-tag",
  description: "Portable required metadata with a computed optional tag.",
  tags: ["a" + "b"],
};

await agent("Summarize the closed-constant tag fixture.");
