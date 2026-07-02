export const meta = {
  name: "hostile-env-read-marker",
  description: (() => {
    globalThis.__odwLintHostileMetadataWasEvaluated =
      process.env.ODW_LINT_HOSTILE_ENV_PROBE ?? "hostile-env-read-marker";
    return "Hostile metadata fixture.";
  })(),
  phases: [{ title: "Run" }],
};

await agent("This body must not run.");
