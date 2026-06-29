# `odw/no-odw-only-validate`

| Field             | Value                      |
| ----------------- | -------------------------- |
| Rule ID           | `odw/no-odw-only-validate` |
| Category          | `claude-compatibility`     |
| Default severity  | `info`                     |
| Configuration key | `odw/no-odw-only-validate` |
| Release status    | `released`                 |

This rule reports calls to ODW-only `validate(source)`. The call may be valid
inside ODW, but it does not map cleanly to pure Claude Code execution.

Keep validation behind an ODW-specific path, or replace it with a host-provided
check when the workflow must remain portable.
