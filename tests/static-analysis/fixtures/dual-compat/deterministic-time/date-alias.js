/**
 * @file Dual-compatibility fixture with a date-object alias hazard.
 */

export const meta = {
  name: "deterministic-time-date-alias",
  description: "Portable metadata with an aliased date timestamp warning.",
};

const ClockDate = Date;
const timestamp = ClockDate.now();

await agent(`Use timestamp ${timestamp} only as fixture text.`);
