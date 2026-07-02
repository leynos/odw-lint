# `odw/meta-description`

| Field             | Value                  |
| ----------------- | ---------------------- |
| Rule ID           | `odw/meta-description` |
| Category          | `dialect`              |
| Default severity  | `error`                |
| Configuration key | `odw/meta-description` |
| Release status    | `released`             |

This rule reports when `meta.description` is missing or is not a string. The
description gives users and review tools a concise explanation of the workflow.

Add a string `description` field to the metadata object. Use an empty string
only when there is a deliberate reason to publish no description.

## Failing example

This mirrors the `numeric-meta-description.js` invalid workflow fixture.

```js
export const meta = {
  name: "numeric-meta-description",
  description: 123,
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```

## Fixed example

```js
export const meta = {
  name: "numeric-meta-description",
  description: "Numeric metadata description fixture.",
  phases: [{ title: "Run" }],
};

await agent("Draft status.");
```
