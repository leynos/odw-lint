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

The scanner also reports a single-hop alias of the injected primitive:

```js
const checkWorkflow = validate;
const result = checkWorkflow(args.generatedWorkflowSource);
```

Chained aliases of that primitive are also reported:

```js
const checkWorkflow = validate;
const runCheck = checkWorkflow;
const result = runCheck(args.generatedWorkflowSource);
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
identifier, such as `validate(source)`, and single-hop aliases of that
primitive, such as `const v = validate; v(source)`. It also detects chained
aliases, such as `const v = validate; const w = v; w(source)`.

Alias declarations, chained alias declarations, and alias use resolve through
the same lexical scope model as bare `validate` calls. A same-named alias or
rebinding in an unrelated scope does not suppress or fabricate a note, and an
alias shadowed at the use site stays suppressed. Alias visibility is still
computed for the whole current scope, so use-before-declaration and temporal
dead-zone ordering inside one scope remain conservative. The same whole-scope
reassignment and temporal-dead-zone bound applies to each hop of a chain, so a
chain off a reassigned or temporal-dead-zone-ordered base remains
conservatively broad.

The remaining conservative limits are member forms such as
`namespace.validate(source)`, dynamic and computed callees such as
`registry["validate"](source)`, and global forms such as
`globalThis.validate(source)`. These forms stay intentionally undetected
because the scanner cannot prove that they reference ODW's injected primitive.
