/**
 * @file Dual-compatibility fixture with a global math-random hazard.
 */

export const meta = {
  name: "deterministic-time-math-random",
  description: "Portable metadata with a deterministic randomness warning.",
};

const sample = Math.random();

await agent(`Use sample ${sample} only as fixture text.`);
