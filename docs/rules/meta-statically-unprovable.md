# `odw/meta-statically-unprovable`

| Field             | Value                            |
| ----------------- | -------------------------------- |
| Rule ID           | `odw/meta-statically-unprovable` |
| Category          | `dialect`                        |
| Default severity  | `warning`                        |
| Configuration key | `odw/meta-statically-unprovable` |
| Release status    | `released`                       |

This rule reports when metadata might work at runtime but cannot be proven
without evaluating source code. The linter treats workflow source as untrusted,
so it does not execute metadata to discover its value.

Rewrite the metadata as a statically inspectable object literal. Keep dynamic
work in the workflow body rather than in the metadata envelope.

## Failing example

This mirrors the `computed-meta-expression.js` invalid workflow fixture.

```js
export const meta = {
  name: "computed-meta-expression",
  description: "Computed " + "description.",
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```

## Fixed example

```js
export const meta = {
  name: "computed-meta-expression",
  description: "Computed description.",
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```
