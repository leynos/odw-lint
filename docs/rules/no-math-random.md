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

The scanner ignores bare `Math.random()` calls when the workflow body declares
a local `Math` binding. It detects string-key access such as
`Math["random"]()` and `globalThis` chains such as
`globalThis.Math.random()`. It also detects optional member calls such as
`Math?.random()` and direct aliases such as
`const random = Math.random; random()`.

The remaining conservative limits are dynamic computed keys (`Math[k]()`), alias
chains beyond one direct declaration, and non-`globalThis` roots such as
`window`, `self`, and `global`.
