# `odw/meta-description`

| Field             | Value                  |
| ----------------- | ---------------------- |
| Rule ID           | `odw/meta-description` |
| Category          | `dialect`              |
| Default severity  | `error`                |
| Configuration key | `odw/meta-description` |
| Release status    | `released`             |

This rule reports when `meta.description` is missing or is not a string. The
description gives users and review tools a concise explanation of the workflow.

Add a string `description` field to the metadata object. Use an empty string
only when there is a deliberate reason to publish no description.
