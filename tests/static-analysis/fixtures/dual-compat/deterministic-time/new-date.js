/**
 * @file Dual-compatibility fixture with an argless date-construction hazard.
 */

export const meta = {
  name: "deterministic-time-new-date",
  description: "Portable metadata with an argless date construction warning.",
};

const started = new Date();

await agent(`Use start ${started.toISOString()} only as fixture text.`);
