# `odw/body-syntax`

| Field             | Value             |
| ----------------- | ----------------- |
| Rule ID           | `odw/body-syntax` |
| Category          | `dialect`         |
| Default severity  | `error`           |
| Configuration key | `odw/body-syntax` |
| Release status    | `released`        |

This rule reports when the normalized workflow body cannot be parsed as
JavaScript or TypeScript. The checker cannot run later rules safely without a
parseable body.

Fix the syntax error at the reported span, then rerun the checker to reveal any
deeper dialect or compatibility diagnostics.
