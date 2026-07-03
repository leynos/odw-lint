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

Detection is syntactic. A local binding named `Math` is still treated as
`Math`, and computed access such as `Math["random"]()` is not detected. Revisit
these limits after roadmap 2.2.4 adds lexical binding facts.
