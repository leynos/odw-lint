# `odw/claude-pure-meta`

| Field             | Value                  |
| ----------------- | ---------------------- |
| Rule ID           | `odw/claude-pure-meta` |
| Category          | `claude-compatibility` |
| Default severity  | `warning`              |
| Configuration key | `odw/claude-pure-meta` |
| Release status    | `released`             |

This rule reports metadata that is valid for ODW's runtime but not portable to
Claude Code's stricter static workflow expectations. It highlights metadata
that relies on computation rather than a pure literal shape.

Prefer a plain metadata object made from literal values. Move computed values
into the workflow body when they are not needed for discovery.

## Failing example

```js
const workflowName = "dynamic-name";

export const meta = {
  name: workflowName,
  description: "Uses computed metadata.",
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```

## Fixed example

```js
export const meta = {
  name: "dynamic-name",
  description: "Uses static metadata.",
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```
