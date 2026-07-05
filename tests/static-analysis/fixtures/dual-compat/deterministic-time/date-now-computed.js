/**
 * @file Dual-compatibility fixture with a computed date-now hazard.
 */

export const meta = {
  name: "deterministic-time-date-now-computed",
  description: "Portable metadata with a computed timestamp warning.",
};

// biome-ignore lint/complexity/useLiteralKeys: this fixture pins string-key date access.
const timestamp = Date["now"]();

await agent(`Use timestamp ${timestamp} only as fixture text.`);
