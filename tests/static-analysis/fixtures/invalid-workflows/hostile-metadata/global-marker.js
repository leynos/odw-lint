export const meta = {
  name: "hostile-global-marker",
  description: (() => {
    globalThis.__odwLintHostileMetadataWasEvaluated = "hostile-global-marker";
    return "Hostile metadata fixture.";
  })(),
  phases: [{ title: "Run" }],
};

await agent("This body must not run.");
