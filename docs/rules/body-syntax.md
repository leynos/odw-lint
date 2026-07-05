# `odw/body-syntax`

| Field             | Value             |
| ----------------- | ----------------- |
| Rule ID           | `odw/body-syntax` |
| Category          | `dialect`         |
| Default severity  | `error`           |
| Configuration key | `odw/body-syntax` |
| Release status    | `released`        |

This rule reports when the normalized workflow body cannot be parsed as
ECMAScript, the dialect ODW accepts for workflow bodies. The checker cannot run
later rules safely without a parseable body.

TypeScript-only syntax that the ECMAScript grammar cannot express is reported
by this rule. That includes colon type annotations on variables or parameters
(`const x: number`, `function f(x: number)`), `interface`, `enum`, `as`, and
`satisfies`. Generic call syntax such as `identity<number>(1)` is not reported:
ECMAScript parses the angle brackets as comparison operators, so that source is
accepted by the parser rather than flagged as a syntax error.

The shipped parser exposes no structured byte range for syntax errors, so the
diagnostic spans the whole normalized body while always pointing into original
workflow source, not the normalized parser wrapper. Token-level narrowing is
intentionally deferred by ADR
[0003-body-syntax-span-narrowing-quarantine.md](../adr/0003-body-syntax-span-narrowing-quarantine.md)
until a parser surface can provide stable structured offsets.

When parser detail is available, the diagnostic message appends it after the
fixed sentence, for example `...after ODW normalization: <parser detail>`.

Fix the syntax error at the reported span, then rerun the checker to reveal any
deeper dialect or compatibility diagnostics.

## Failing example

This mirrors the `body-unclosed-call.js` invalid workflow fixture.

```js
export const meta = {
  name: "body-unclosed-call",
  description: "Unclosed call fixture.",
  phases: [{ title: "Run" }],
};

await agent("draft"
```

## Fixed example

```js
export const meta = {
  name: "body-unclosed-call",
  description: "Unclosed call fixture.",
  phases: [{ title: "Run" }],
};

await agent("draft");
```
