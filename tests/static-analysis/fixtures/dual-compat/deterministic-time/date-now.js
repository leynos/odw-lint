/**
 * @file Dual-compatibility fixture with a global date-now hazard.
 */

export const meta = {
  name: "deterministic-time-date-now",
  description: "Portable metadata with a deterministic timestamp warning.",
};

const timestamp = Date.now();

await agent(`Use timestamp ${timestamp} only as fixture text.`);
