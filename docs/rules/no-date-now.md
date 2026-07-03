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

Detection is syntactic. A local binding named `Date` is still treated as
`Date`, and computed access such as `Date["now"]()` is not detected. Revisit
these limits after roadmap 2.2.4 adds lexical binding facts.
