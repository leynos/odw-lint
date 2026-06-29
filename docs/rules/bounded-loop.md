# `odw/bounded-loop`

| Field             | Value                |
| ----------------- | -------------------- |
| Rule ID           | `odw/bounded-loop`   |
| Category          | `orchestration-risk` |
| Default severity  | `warning`            |
| Configuration key | `odw/bounded-loop`   |
| Release status    | `planned`            |

This planned rule will report loops around agent dispatch that have no visible
numeric or argument-derived bound. Unbounded dispatch loops can create
expensive or difficult-to-supervise runs.

The current checker does not emit this rule yet. When it is released, users
will normally fix findings by adding an explicit iteration bound or by moving
the loop policy into reviewed input.
