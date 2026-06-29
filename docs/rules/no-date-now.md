# `odw/no-date-now`

| Field             | Value                  |
| ----------------- | ---------------------- |
| Rule ID           | `odw/no-date-now`      |
| Category          | `claude-compatibility` |
| Default severity  | `warning`              |
| Configuration key | `odw/no-date-now`      |
| Release status    | `released`             |

This rule reports calls to `Date.now()`. Time-dependent workflows are harder to
replay, test, and compare across ODW and Claude Code environments.

Inject the current time through workflow arguments or an explicit host adapter
so tests and supervised runs can control it.
