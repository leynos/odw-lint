# `odw/no-math-random`

| Field             | Value                  |
| ----------------- | ---------------------- |
| Rule ID           | `odw/no-math-random`   |
| Category          | `claude-compatibility` |
| Default severity  | `warning`              |
| Configuration key | `odw/no-math-random`   |
| Release status    | `released`             |

This rule reports direct calls to `Math.random()`. It does not report a bare
`Math.random` reference that is not called. Hidden randomness makes workflow
runs non-reproducible and complicates review of agent decisions.

Pass seeded randomness or a chosen value into the workflow explicitly. Keep the
source of randomness at the host boundary where it can be logged and tested.

## Failing example

```js
export const meta = {
  name: "sample-review",
  description: "Select one review sample.",
  phases: [{ title: "Run" }],
};

const sampleIndex = Math.floor(Math.random() * args.samples.length);
await agent(`Review ${args.samples[sampleIndex]}.`);
```

## Fixed example

```js
export const meta = {
  name: "sample-review",
  description: "Select one review sample.",
  phases: [{ title: "Run" }],
};

const sampleIndex = args.sampleIndex;
await agent(`Review ${args.samples[sampleIndex]}.`);
```

## Limitations

The scanner ignores a bare `Math.random()` call only when a local `Math`
binding is in scope at that reference. A same-named binding in an unrelated
function, method, getter, or setter no longer hides the warning. It detects
string-key access such as `Math["random"]()` and `globalThis` chains such as
`globalThis.Math.random()`. It also detects optional member calls such as
`Math?.random()` and direct aliases such as
`const random = Math.random; random()`.

Alias declarations and alias use resolve through the same lexical scope model
as bare `Math` roots. A same-named alias or rebinding in an unrelated scope no
longer suppresses or fabricates a warning, and an alias shadowed at the use
site stays suppressed. Alias visibility is still computed for the whole current
scope, so use-before-declaration and temporal dead-zone ordering inside one
scope remain conservative.

The remaining conservative limits are dynamic computed keys (`Math[k]()`),
block, `for`, and `catch` shadows attributed to the enclosing function scope,
and non-`globalThis` roots such as `window`, `self`, and `global`.
