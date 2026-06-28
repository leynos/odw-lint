import { helper } from "./helper.js";

export const meta = {
  name: "top-level-import",
  description: "Top-level import fixture.",
  phases: [{ title: "Run" }],
};

await agent(helper);
