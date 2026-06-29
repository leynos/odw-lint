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
