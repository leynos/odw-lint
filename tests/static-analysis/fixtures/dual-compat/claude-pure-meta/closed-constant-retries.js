/**
 * @file Dual-compatibility fixture with closed-constant metadata arithmetic.
 */

export const meta = {
  name: "claude-pure-meta-closed-constant-retries",
  description: "Portable required metadata with computed optional retries.",
  retries: 1 - 2,
};

await agent("Summarize the closed-constant retry fixture.");
