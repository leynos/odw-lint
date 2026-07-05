/**
 * @file Dual-compatibility fixture with inert Date.now text and no warning.
 */

export const meta = {
  name: "deterministic-time-masked-date",
  description: "Portable metadata with deterministic-time tokens inside inert text.",
};

const prompt = "These examples are inert fixture text: Date.now(), Math.random(), new Date().";

await agent(prompt);
