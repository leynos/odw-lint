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

The scanner ignores bare `new Date()` and `new Date` construction only when a
local `Date` binding is in scope at that reference. A same-named binding in an
unrelated function, method, getter, or setter no longer hides the warning. It
detects `globalThis` chains such as `new globalThis.Date()` and direct
constructor aliases such as `const Clock = Date; new Clock()`.

The remaining conservative limits are dynamic computed keys, block, `for`, and
`catch` shadows attributed to the enclosing function scope, whole-body alias
suppression beyond one direct declaration, optional chaining around constructor
forms that ECMAScript does not permit with `new`, and non-`globalThis` roots
such as `window`, `self`, and `global`.
