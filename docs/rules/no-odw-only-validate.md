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

It is informational and is not promoted by `--strict-claude`.

Keep validation behind an ODW-specific path, or replace it with a host-provided
check when the workflow must remain portable.

## Failing example

```js
export const meta = {
  name: "validate-generated-workflow",
  description: "Validate generated workflow source.",
  phases: [{ title: "Run" }],
};

const result = validate(args.generatedWorkflowSource);
await agent(`Summarize validation result: ${JSON.stringify(result)}.`);
```

## Fixed example

```js
export const meta = {
  name: "validate-generated-workflow",
  description: "Summarize supplied validation output.",
  phases: [{ title: "Run" }],
};

await agent(`Summarize validation result: ${JSON.stringify(args.validationResult)}.`);
```

## Limitations

The scanner detects direct calls to a lexically unshadowed bare `validate`
identifier, such as `validate(source)`. It does not detect aliases such as
`const v = validate; v(source)`, member forms such as
`namespace.validate(source)`, or dynamic and computed callees such as
`registry["validate"](source)` in this release.
