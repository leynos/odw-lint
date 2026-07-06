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

It is a warning by default and is promoted to an error under
`--strict-claude`.

Prefer a plain metadata object made from literal values. Move computed values
into the workflow body when they are not needed for discovery.

The diagnostic points at the first computed value. It fires only when ODW would
still load the workflow: the required fields are literal strings and every
computed part is a self-contained constant expression.

## Failing example

```js
export const meta = {
  name: "status-report",
  description: "Summarizes status.",
  retries: 1 - 2,
};

await agent("Draft status.");
```

## Fixed example

```js
export const meta = {
  name: "status-report",
  description: "Summarizes status.",
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```
