# `odw/meta-object`

| Field             | Value             |
| ----------------- | ----------------- |
| Rule ID           | `odw/meta-object` |
| Category          | `dialect`         |
| Default severity  | `error`           |
| Configuration key | `odw/meta-object` |
| Release status    | `released`        |

This rule reports when the static parser can prove that `meta` is not an
object in the supported static contract. A workflow cannot be loaded when its
metadata is a primitive, array, function, or other unsupported value.

Replace the metadata value with a plain object literal that contains the fields
required by the dialect.
