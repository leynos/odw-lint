/**
 * @file Dual-compatibility fixture with a shadowed Date binding.
 */

export const meta = {
  name: "deterministic-time-shadowed-date",
  description: "Portable metadata with a local date helper.",
};

// biome-ignore lint/suspicious/noShadowRestrictedNames: this fixture pins shadowed Date false-positive behaviour.
const Date = {
  now: () => 12,
};
const timestamp = Date.now();

await agent(`Use timestamp ${timestamp} only as fixture text.`);
