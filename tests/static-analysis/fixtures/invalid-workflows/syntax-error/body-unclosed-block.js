export const meta = {
  name: "body-unclosed-block",
  description: "Unclosed block fixture.",
  phases: [{ title: "Run" }],
};

if (args.ready) {
  await agent("Draft status.");
