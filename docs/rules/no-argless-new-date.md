# `odw/no-argless-new-date`

| Field             | Value                     |
| ----------------- | ------------------------- |
| Rule ID           | `odw/no-argless-new-date` |
| Category          | `claude-compatibility`    |
| Default severity  | `warning`                 |
| Configuration key | `odw/no-argless-new-date` |
| Release status    | `released`                |

This rule reports `new Date()` and `new Date` construction without arguments.
It does not report `new Date(value)` or other calls that pass an explicit
timestamp or date value. Like `Date.now()`, argless date construction captures
ambient wall-clock time.

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

## Limitations

Detection is syntactic. A local binding named `Date` is still treated as
`Date`, so a shadowed constructor can still warn. Revisit this limit after
roadmap 2.2.4 adds lexical binding facts.
