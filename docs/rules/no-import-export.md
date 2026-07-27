# `odw/no-import-export`

| Field             | Value                  |
| ----------------- | ---------------------- |
| Rule ID           | `odw/no-import-export` |
| Category          | `dialect`              |
| Default severity  | `error`                |
| Configuration key | `odw/no-import-export` |
| Release status    | `released`             |

This rule reports unsupported top-level `import` declarations or extra `export`
declarations in the workflow body. The ODW dialect expects one metadata export
followed by the executable body.

Remove unsupported top-level imports and exports. Pass required values through
the workflow arguments or supported host primitives instead.

## Failing example

This mirrors the `top-level-import.js` invalid workflow fixture.

```js
import { helper } from "./helper.js";

export const meta = {
  name: "top-level-import",
  description: "Top-level import fixture.",
  phases: [{ title: "Run" }],
};

await agent(helper);
```

## Fixed example

```js
export const meta = {
  name: "top-level-import",
  description: "Top-level import fixture.",
  phases: [{ title: "Run" }],
};

await agent(args.helper);
```
