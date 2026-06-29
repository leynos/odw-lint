# `odw/meta-name`

| Field             | Value           |
| ----------------- | --------------- |
| Rule ID           | `odw/meta-name` |
| Category          | `dialect`       |
| Default severity  | `error`         |
| Configuration key | `odw/meta-name` |
| Release status    | `released`      |

This rule reports when `meta.name` is missing or is not a non-empty string. The
name is part of the workflow identity shown to users and tooling.

Add a stable, non-empty string value for `name` inside the metadata object.
