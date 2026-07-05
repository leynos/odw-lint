/**
 * @file Portable pure-metadata fixture with no compatibility warnings.
 */

export const meta = {
  name: "pure-metadata-simple-agent",
  description: "Pure literal metadata with a portable agent body.",
};

await agent("Summarize the current task in one precise sentence.");
