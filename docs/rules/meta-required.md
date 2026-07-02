# `odw/meta-required`

| Field             | Value               |
| ----------------- | ------------------- |
| Rule ID           | `odw/meta-required` |
| Category          | `dialect`           |
| Default severity  | `error`             |
| Configuration key | `odw/meta-required` |
| Release status    | `released`          |

This rule reports when a workflow source file has no real
`export const meta =` declaration. ODW needs that metadata envelope before it
can identify and run the workflow.

Add a top-level `export const meta = { ... }` object before the workflow body.
Do not hide the metadata behind computed exports or runtime construction.

## Failing example

This mirrors the `missing-meta.js` invalid workflow fixture.

```js
phase("Run");

await agent("Draft status.");
```

## Fixed example

```js
export const meta = {
  name: "missing-meta",
  description: "Missing metadata fixture.",
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```
