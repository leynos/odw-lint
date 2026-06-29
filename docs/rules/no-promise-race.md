# `odw/no-promise-race`

| Field             | Value                 |
| ----------------- | --------------------- |
| Rule ID           | `odw/no-promise-race` |
| Category          | `orchestration-risk`  |
| Default severity  | `warning`             |
| Configuration key | `odw/no-promise-race` |
| Release status    | `planned`             |

This planned rule will report completion-order control flow such as
`Promise.race`. Race-driven orchestration can make agent runs non-deterministic
and difficult to reproduce.

The current checker does not emit this rule yet. When it is released, users
will normally fix findings by making ordering explicit or by documenting the
timeout or cancellation policy.
