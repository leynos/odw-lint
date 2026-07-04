# `odw/no-date-now`

| Field             | Value                  |
| ----------------- | ---------------------- |
| Rule ID           | `odw/no-date-now`      |
| Category          | `claude-compatibility` |
| Default severity  | `warning`              |
| Configuration key | `odw/no-date-now`      |
| Release status    | `released`             |

This rule reports direct calls to `Date.now()`. It does not report a bare
`Date.now` reference that is not called. Time-dependent workflows are harder to
replay, test, and compare across ODW and Claude Code environments.

Inject the current time through workflow arguments or an explicit host adapter
so tests and supervised runs can control it.

## Failing example

```js
export const meta = {
  name: "dated-status",
  description: "Draft a status note with the current time.",
  phases: [{ title: "Run" }],
};

const timestamp = Date.now();
await agent(`Draft a status note for ${timestamp}.`);
```

## Fixed example

```js
export const meta = {
  name: "dated-status",
  description: "Draft a status note with the supplied time.",
  phases: [{ title: "Run" }],
};

const timestamp = args.timestamp;
await agent(`Draft a status note for ${timestamp}.`);
```

## Limitations

The scanner ignores bare `Date.now()` calls when the workflow body declares a
local `Date` binding. It detects string-key access such as `Date["now"]()` and
`globalThis` chains such as `globalThis.Date.now()`. It also detects optional
member calls such as `Date?.now()` and direct aliases such as
`const now = Date.now; now()`.

The remaining conservative limits are dynamic computed keys (`Date[k]()`), alias
chains beyond one direct declaration, and non-`globalThis` roots such as
`window`, `self`, and `global`.
