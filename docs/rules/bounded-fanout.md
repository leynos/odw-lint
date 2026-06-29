# `odw/bounded-fanout`

| Field             | Value                |
| ----------------- | -------------------- |
| Rule ID           | `odw/bounded-fanout` |
| Category          | `orchestration-risk` |
| Default severity  | `warning`            |
| Configuration key | `odw/bounded-fanout` |
| Release status    | `planned`            |

This planned rule will report fan-out patterns whose size is not obviously
bounded, such as `parallel(Array.from({ length: ... }))` with an opaque
length. Large fan-outs can exhaust budgets or make failures hard to inspect.

The current checker does not emit this rule yet. When it is released, users
will normally fix findings by constraining fan-out length with a reviewed
constant or validated argument.
