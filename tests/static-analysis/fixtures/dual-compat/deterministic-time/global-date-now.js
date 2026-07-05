/**
 * @file Dual-compatibility fixture with a globalThis date-now hazard.
 */

export const meta = {
  name: "deterministic-time-global-date-now",
  description: "Portable metadata with a globalThis timestamp warning.",
};

const timestamp = globalThis.Date.now();

await agent(`Use timestamp ${timestamp} only as fixture text.`);
