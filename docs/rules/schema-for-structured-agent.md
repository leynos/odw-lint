# `odw/schema-for-structured-agent`

| Field             | Value                             |
| ----------------- | --------------------------------- |
| Rule ID           | `odw/schema-for-structured-agent` |
| Category          | `orchestration-risk`              |
| Default severity  | `info`                            |
| Configuration key | `odw/schema-for-structured-agent` |
| Release status    | `planned`                         |

This planned rule will report `agent()` calls that appear to request structured
data in prompt text without providing a schema. Schema-less structured output
is harder to validate and retry.

The current checker does not emit this rule yet. When it is released, users
will normally fix findings by adding an explicit schema or by changing the
prompt to request unstructured prose.
