# `odw/no-argless-new-date`

| Field             | Value                     |
| ----------------- | ------------------------- |
| Rule ID           | `odw/no-argless-new-date` |
| Category          | `claude-compatibility`    |
| Default severity  | `warning`                 |
| Configuration key | `odw/no-argless-new-date` |
| Release status    | `released`                |

This rule reports `new Date()` calls without arguments. Like `Date.now()`,
argless date construction captures ambient wall-clock time.

Pass a timestamp or date string into the workflow and construct dates from that
explicit value.

## Failing example

```js
export const meta = {
  name: "timestamped-review",
  description: "Draft a timestamped review note.",
  phases: [{ title: "Run" }],
};

const startedAt = new Date();
await agent(`Draft a review note for ${startedAt.toISOString()}.`);
```

## Fixed example

```js
export const meta = {
  name: "timestamped-review",
  description: "Draft a timestamped review note.",
  phases: [{ title: "Run" }],
};

const startedAt = new Date(args.startedAt);
await agent(`Draft a review note for ${startedAt.toISOString()}.`);
```
