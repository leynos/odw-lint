/**
 * @file Pure-metadata fixture with deterministic-time tokens in inert text.
 */

export const meta = {
  name: "pure-metadata-string-decoy",
  description: "Pure literal metadata mentioning Date.now and Math.random as inert text.",
};

const prompt = "These tokens are examples only: Date.now(), Math.random(), new Date().";

await agent(prompt);
