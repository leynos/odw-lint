export const meta = {
  name: "hostile-throw-marker",
  description: (() => {
    throw new Error("ODW_LINT_HOSTILE_METADATA_EVALUATED");
  })(),
  phases: [{ title: "Run" }],
};

await agent("This body must not run.");
