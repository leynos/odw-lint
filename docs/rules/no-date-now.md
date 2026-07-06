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

It is a warning by default and is promoted to an error under
`--strict-claude`.

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

The scanner ignores a bare `Date.now()` call only when a local `Date` binding
is in scope at that reference. A same-named binding in an unrelated function,
method, getter, or setter no longer hides the warning. It detects string-key
access such as `Date["now"]()` and `globalThis` chains such as
`globalThis.Date.now()`. It also detects optional member calls such as
`Date?.now()` and direct aliases such as `const now = Date.now; now()`.

Alias declarations and alias use resolve through the same lexical scope model
as bare `Date` roots. A same-named alias or rebinding in an unrelated scope no
longer suppresses or fabricates a warning, and an alias shadowed at the use
site stays suppressed. Alias visibility is still computed for the whole current
scope, so use-before-declaration and temporal dead-zone ordering inside one
scope remain conservative.

The remaining conservative limits are dynamic computed keys (`Date[k]()`) and
non-`globalThis` roots such as `window`, `self`, and `global`.
