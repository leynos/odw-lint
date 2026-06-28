# odw-lint technical design

Status: Draft v0.1
Audience: implementers, maintainers, and reviewers
Companion documents: [terms of reference](terms-of-reference.md) and
[roadmap](roadmap.md). Architectural decisions live under [adr](adr/).
Updated: 2026-06-28

## 1. Problem statement

ODW workflows are JavaScript-like scripts with runtime-specific semantics:
`export const meta`, injected workflow globals, top-level `await`, and
top-level `return`. ODW currently exposes `validate(source)` as an injected
primitive for generated workflows, but it does not expose a host-side lint or
validation command for repository authors and CI.

`odw-lint` will provide a static checker for ODW workflow files. It must detect
workflow-dialect errors, compatibility hazards, and high-risk orchestration
patterns without executing workflow code.

## 2. Goals and non-goals

### 2.1. Goals

- Provide a CLI that checks workflow files before `odw run`.
- Parse ODW workflow source without executing the body or metadata expression.
- Report diagnostics with original file spans and stable rule identifiers.
- Preserve ODW-vs-Claude compatibility distinctions.
- Produce human-readable and JSON output.
- Build a fixture corpus from ODW examples and invalid workflow cases.
- Keep the architecture open to later Biome, Oxlint, and editor integration.

### 2.2. Non-goals

- Replace project-wide JavaScript linting.
- Execute workflows, dispatch agents, or supervise runs.
- Guarantee prompt quality or agent response shape beyond statically visible
  schema and orchestration checks.
- Ship a Rust core in v1.
- Depend on alpha plugin APIs for the core checker.

## 3. Evidence and prior art

|Source|Finding|Design consequence|
|---|---|---|
|ODW loader, `/src/loader.ts`|ODW extracts `export const meta`, strips only the `export` keyword, wraps the body in an async function, rejects other top-level imports or exports, and scans for Claude compatibility hazards.|`odw-lint` needs its own ODW-aware source model rather than a raw JavaScript parse of the original file.|
|ODW dual compatibility, `/src/dual-compat.ts`|Claude compatibility requires a pure-literal `meta`; ODW's runtime loader is more lenient.|The linter needs separate ODW validity and Claude portability diagnostics.|
|ODW primitive validation, `/src/primitives.ts`|`validate(source)` compile-checks generated workflow source and returns `{ ok, meta?, errors, warnings }`.|Host-side lint should overlap with this result but should not require being called from a workflow.|
|ODW public entry point, `/src/index.ts`|ODW exports workflow metadata types, but not the loader implementation or safe static helper implementations.|`odw-lint` needs an explicit static-analysis boundary before it can promise runtime parity.|
|ODW workflow resolver, `/src/workflows/resolve.ts`|ODW distinguishes path-like inputs from flat workflow names and resolves names from managed workflow roots without opening workflow files.|`odw-lint` must decide whether file discovery follows ODW name/root semantics or stays path/glob-only.|
|Biome linter plugins, <https://biomejs.dev/linter/plugins/>|Biome plugins use GritQL snippets to match supported files, report diagnostics, and suggest safe or unsafe rewrites.|Biome is useful as a later integration surface for simple structural rules, not as the primary ODW dialect engine.|
|Biome GritQL reference, <https://biomejs.dev/reference/gritql/>|GritQL performs structural search for JavaScript/TypeScript, CSS, and JSON, but Biome notes missing and in-progress features.|GritQL can express pattern rules after source is ordinary JS/TS, but cannot own ODW's static workflow contract.|
|Oxlint JS plugin docs, <https://oxc.rs/docs/guide/usage/linter/js-plugins>|Oxlint supports ESLint-compatible JS plugins, AST traversal, fixes, source APIs, scope analysis, control flow, and IDE diagnostics, but not custom file formats or parsers.|Oxlint plugin support is promising after the ODW dialect has been normalized, but it should not be the v1 core.|
|Oxlint writing plugins, <https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html>|JS plugins are alpha; `createOnce` is an Oxlint-specific optimisation path that remains ESLint-compatible via `@oxlint/plugins`.|A future plugin should be optional and version-tolerant.|
|`@swc/core` npm package, <https://www.npmjs.com/package/@swc/core>|SWC is a Rust TypeScript/JavaScript compiler exposed as a JavaScript and Rust library; `@swc/core` was 1.15.43, published five days before this document was written.|A TypeScript CLI using `@swc/core` gives ODW-native integration with a current parser library and leaves a Rust path open later.|

## 4. Design intent

Build a TypeScript CLI around a small static-analysis pipeline:

1. Read workflow source.
2. Extract and validate the ODW workflow envelope.
3. Transform the workflow body into parseable JavaScript while preserving
   source-span mappings.
4. Parse with SWC.
5. Run ODW-specific rules over the envelope, metadata, and AST.
6. Emit text or JSON diagnostics with stable exit codes.

The v1 design deliberately keeps Biome and Oxlint outside the core. Their
plugin systems can host selected rules later, but neither should define the
ODW dialect contract.

## 5. Static-analysis boundary

The static-analysis boundary is a first-class architecture decision. See
[0001-static-analysis-boundary.md](adr/0001-static-analysis-boundary.md).

`odw-lint` must not import or call executable ODW runtime paths in production
code. In particular, it must not call `loadWorkflowScript`, `createPrimitives`,
or the runtime `validate(source)` primitive, because the runtime loader
evaluates metadata and compiles workflow bodies. The implementation must use a
static parser path that never evaluates workflow source.

The first implementation owns a vendored static implementation of the ODW
workflow envelope scanner, pure metadata parser, dual-compat scanner, span
mapper, and related static semantics. ODW may later consume `odw-lint`'s
static API, or both projects may extract a shared static package after the
contract is proven, but `odw-lint` v1 does not wait for ODW to expose one.

The design does not allow an informal "port or share small helpers" approach,
nor does it allow production code to import private ODW runtime helpers.
Parity is maintained by fixtures and drift tests, not by delegating to an
executable loader path.

## 6. Architecture

### 6.1. Components

|Component|Responsibility|
|---|---|
|CLI front end|Parse arguments, discover files, load config, and select reporter.|
|Source reader|Read files or stdin, normalize paths, and build line indexes.|
|ODW envelope scanner|Locate `export const meta`, reject unsupported imports and exports, and identify the body span.|
|Static meta parser|Parse metadata as a pure or lenient object without executing expressions.|
|Body normalizer|Produce SWC-parseable source by stripping the `export` token and wrapping or replacing top-level `return` when needed for parsing.|
|Span mapper|Map normalized AST spans back to original source offsets, lines, and columns.|
|SWC parser adapter|Parse normalized JavaScript or TypeScript source and return AST plus syntax errors.|
|Rule engine|Run deterministic rules over the envelope, metadata, AST, and derived facts.|
|Reporter|Emit text, JSON, and future SARIF-compatible diagnostic streams.|
|Fixture corpus|Store valid and invalid workflow examples for differential tests.|

### 6.2. Static source model

The analysis model has three layers:

|Layer|Data|Produced by|
|---|---|---|
|`WorkflowEnvelope`|File path, original source, line index, meta declaration span, body span, unsupported top-level declarations|Envelope scanner|
|`WorkflowMetaFacts`|`name`, `description`, `phases`, pure-literal status, ODW-lenient status, parse reason|Static meta parser|
|`WorkflowAstFacts`|SWC AST, primitive calls, loops, fan-out expressions, randomness/time hazards, schema literals|Parser adapter and fact collectors|

The envelope scanner should use the same string, comment, template, and regex
masking strategy as ODW's loader. That avoids false positives when `export const
meta =` or braces appear inside strings or comments.

### 6.3. Metadata classification

Metadata diagnostics must separate three cases:

|Category|Meaning|Default result|
|---|---|---|
|ODW runtime-invalid|The static envelope proves ODW cannot load the workflow, such as missing `meta.name` or malformed object syntax.|Error|
|Statically unprovable|ODW's executable runtime might accept the metadata, but `odw-lint` cannot prove that safely without evaluating source.|Warning in default mode, configurable to error|
|Claude-incompatible|ODW can accept the workflow, but Claude Code's static workflow reader would reject it.|Warning, promoted by `--strict-claude`|

`odw/meta-object` is reserved for metadata that the static parser proves is
not an object in the supported static contract. Computed metadata that might
run under ODW but cannot be proven safely should use
`odw/meta-statically-unprovable`, not an ordinary runtime-invalid error.

### 6.4. Do not execute source

ODW's runtime loader currently evaluates the metadata literal with
`new Function` after slicing it from source. That is acceptable for runtime
loading of trusted workflow files, but `odw-lint` must treat workflow source as
untrusted input. It must not call any runtime API path that evaluates metadata
or executes the workflow body.

The first implementation should port or share the pure-literal parser from
ODW's `dual-compat.ts`, then extend it with a static lenient parse mode only if
ODW-valid but Claude-incompatible metadata needs a richer diagnostic. A failure
to statically evaluate lenient metadata should be reported as "not statically
portable" rather than executed for convenience.

## 7. CLI contract

### 7.1. Commands

The initial standalone command is:

```text
odw-lint check [workflow.js ...]
```

If the package later integrates with ODW directly, the equivalent ODW command
should be:

```text
odw check [workflow.js ...]
```

The standalone package should keep the internal command model generic enough
that ODW can call it without shelling out.

### 7.2. File discovery

The standalone v1 command is path/glob-first. It does not resolve bare ODW
workflow names by default. When no files are passed, it checks configured
include globs. If no configuration exists, it checks these roots when present:

- `.odw/workflows/**/*.js`
- `.claude/workflows/**/*.js`
- `workflows/**/*.js`

ODW-style name resolution and managed-root precedence are deferred to the
future `odw check` integration, where ODW can reuse its own resolver. The
standalone CLI may expose `--odw-roots` later, but v1 should not silently
pretend to run ODW's resolver semantics without importing the resolver
contract.

File-discovery rules:

- Shell-expanded files and explicit paths are used as provided.
- Tool-expanded globs are resolved relative to the current working directory,
  unless `--config` defines a root.
- Symlinks to regular files are followed; directory symlinks are not recursed
  unless a future option enables that explicitly.
- Unreadable files produce diagnostics and exit code 1 when other files can be
  checked; unreadable configuration or invalid CLI usage exits code 2.
- `--stdin-file-path` is required when reading stdin so diagnostics have a
  stable path and configuration can apply include/exclude rules.

### 7.3. Flags

|Flag|Meaning|
|---|---|
|`--format text\|json`|Select text output for humans or JSON for tooling.|
|`--strict-claude`|Promote Claude portability findings that are normally warnings to errors.|
|`--max-warnings <n>`|Exit non-zero when warning count exceeds `n`.|
|`--config <path>`|Load rule severity and include/exclude settings.|
|`--stdin-file-path <path>`|Analyse stdin as if it came from `path`.|
|`--no-ignore`|Ignore configured exclude patterns.|

### 7.4. Exit codes

|Code|Meaning|
|---|---|
|0|No errors and warning threshold not exceeded.|
|1|At least one error, or warning threshold exceeded.|
|2|Usage error or unreadable configuration.|
|3|Internal analyser failure.|

## 8. Diagnostic contract

JSON output is a versioned object, not a bare diagnostics array:

```json
{
  "schemaVersion": 1,
  "tool": { "name": "odw-lint", "version": "0.1.0" },
  "summary": { "files": 1, "errors": 1, "warnings": 0, "infos": 0 },
  "diagnostics": [
    {
      "file": "examples/fan-out-reduce.js",
      "rule": "odw/meta-required",
      "severity": "error",
      "message": "workflow must export const meta",
      "span": {
        "start": { "offset": 0, "line": 1, "column": 1 },
        "end": { "offset": 0, "line": 1, "column": 1 }
      },
      "docs": "https://github.com/leynos/odw-lint/docs/rules/meta-required.md",
      "suggestions": []
    }
  ]
}
```

The diagnostic contract has these invariants:

- `schemaVersion` changes only when JSON consumers need compatibility logic.
- `tool.version` comes from the package version.
- `summary` counts diagnostics after severity overrides.
- `rule` is stable once released.
- `severity` is one of `error`, `warning`, `info`, or `hint`.
- `span` always refers to original source, not normalized source.
- `offset` is a zero-based UTF-8 byte offset into the original file.
- `line` and `column` are one-based display positions. `column` is counted in
  Unicode code points, not UTF-16 code units.
- Suggestions are optional and never applied in v1.
- Text output is derived from the same diagnostic objects as JSON output.

## 9. Rule taxonomy

### 9.1. Dialect errors

These findings prevent the workflow from being loaded as an ODW workflow.

|Rule|Default|Condition|
|---|---|---|
|`odw/meta-required`|Error|No real `export const meta =` declaration exists.|
|`odw/meta-object`|Error|The static parser proves the metadata declaration is not an object in the supported static contract.|
|`odw/meta-statically-unprovable`|Warning|The metadata might execute under ODW, but proving that would require source evaluation.|
|`odw/meta-name`|Error|`meta.name` is missing or not a non-empty string.|
|`odw/meta-description`|Error|`meta.description` is missing or not a string.|
|`odw/no-import-export`|Error|The body contains unsupported top-level `import` or extra `export`.|
|`odw/body-syntax`|Error|The normalized body cannot be parsed.|

### 9.2. Claude compatibility

These findings distinguish ODW runtime validity from Claude Code portability.

|Rule|Default|Condition|
|---|---|---|
|`odw/claude-pure-meta`|Warning|`meta` is not a pure literal.|
|`odw/no-date-now`|Warning|The workflow calls `Date.now()`.|
|`odw/no-math-random`|Warning|The workflow calls `Math.random()`.|
|`odw/no-argless-new-date`|Warning|The workflow calls `new Date()` without arguments.|
|`odw/no-odw-only-validate`|Info|The workflow calls ODW-only `validate(source)`.|

`--strict-claude` promotes all Claude compatibility warnings to errors. The
`validate(source)` rule should remain informational unless a future mode
explicitly targets pure Claude Code execution.

### 9.3. Orchestration risk

These rules warn when legal workflows have patterns likely to cause expensive,
non-reproducible, or hard-to-supervise runs.

|Rule|Default|Condition|
|---|---|---|
|`odw/bounded-loop`|Warning|A `while` or `for` loop around agent dispatch has no visible numeric or args-derived bound.|
|`odw/bounded-fanout`|Warning|`parallel(Array.from({ length: ... }))` uses a non-obviously bounded length.|
|`odw/no-promise-race`|Warning|The workflow uses completion-order control flow such as `Promise.race`.|
|`odw/schema-for-structured-agent`|Info|An `agent()` call appears to request structured data in prompt text without `schema`.|
|`odw/worktree-isolation-note`|Info|`isolation: "worktree"` appears and the prompt implies persistent git state.|

The first release should keep these as warnings or info because their analysis
is heuristic. They become useful by explaining risk, not by blocking all
dynamic JavaScript.

Each heuristic rule needs a rule-quality gate before release:

- positive fixtures that should warn,
- negative fixtures that should not warn,
- at least one documented false-positive example,
- a configuration or suppression path,
- span snapshots for each diagnostic shape.

## 10. Configuration

The first configuration file should be optional:

```json
{
  "include": [".odw/workflows/**/*.js", "workflows/**/*.js"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "strictClaude": false,
  "rules": {
    "odw/bounded-loop": "warning",
    "odw/schema-for-structured-agent": "off"
  }
}
```

Configuration rules:

- CLI flags override configuration.
- Unknown rule identifiers are errors.
- Unknown configuration keys are warnings in pre-1.0 releases and errors after
  the configuration schema is stable.
- ODW integration may additionally read `odw.config.json` to discover workflow
  roots, but lint behaviour should stay in the linter config unless ODW
  explicitly adopts the schema.

## 11. Verification strategy

### 11.1. Differential workflow corpus

The fixture corpus should include:

- Every ODW example workflow.
- Minimal valid workflows for each primitive.
- Invalid metadata cases.
- Unsupported import/export cases.
- Top-level return and top-level await cases.
- Claude-incompatible but ODW-valid cases.
- Statically unprovable metadata cases.
- Hostile metadata that would cause a side effect if evaluated.
- Strings, comments, regex literals, and template literals that contain
  decoy workflow syntax.
- LF, CRLF, Unicode, comments, regex literals, template text, and template
  interpolation cases for source spans.

For each fixture, tests assert expected diagnostics and spans.

### 11.2. Loader parity checks

Loader parity is release-blocking for the first dialect slice, not a phase 4
hardening task. For trusted in-repository fixtures only, tests should compare
`odw-lint` results with ODW's static expectations:

- If ODW would reject a fixture before execution, `odw-lint` must report an
  error.
- If `scanDualCompat` reports a known compatibility warning, `odw-lint` must
  report the equivalent rule.
- If `checkMeta` rejects pure-literal metadata, `odw-lint` must report the
  equivalent Claude compatibility finding.
- If ODW examples are valid today, `odw-lint` must not report dialect errors
  for their fixture snapshots.

The parity tests must not execute arbitrary fixture body code. They may import
ODW helper functions only where those helpers are static and do not evaluate
source.

### 11.3. Forbidden import and security regression checks

The implementation test suite must include an architecture rule that scans
production `odw-lint` imports and fails if any production module imports the
executable ODW loader, primitive factory, runtime launcher, or worker path.

The security regression fixture must include metadata that writes a file,
reads an environment variable, throws a custom side-effect marker, or otherwise
would be observable if evaluated. The expected outcome is a diagnostic and no
side effect.

### 11.4. Combinatorial surface

The public CLI has meaningful combinations:

- File paths versus stdin.
- Text versus JSON format.
- Default mode versus `--strict-claude`.
- Default warning policy versus `--max-warnings`.
- Configured severities versus CLI overrides.

The test matrix should cover pairwise combinations of these modes, plus one
full end-to-end CI scenario that checks multiple files and fails on warnings.

### 11.5. Span-mapping invariant

Every diagnostic span must point into the original source. A fixture suite
should assert line, column, and snippet for each rule that reports on normalized
body AST nodes. The suite must include LF, CRLF, Unicode, comments, regex
literals, template text, and template interpolation. This is the most important
correctness property after dialect parity.

## 12. Security and failure modes

### 12.1. Trust boundary

Workflow source is untrusted input. The protected assets are the developer's
machine, environment variables, repository contents, and configured agent
credentials. `odw-lint` must not evaluate source, import workflow files, run
workflow bodies, or call ODW runtime functions that evaluate metadata.

### 12.2. Failure modes

|Failure mode|Mitigation|
|---|---|
|Parser crash on malformed input|Catch parser exceptions and emit `odw/body-syntax` or internal code 3 as appropriate.|
|Diagnostic span points to normalized source|Centralize span mapping and test each rule with snapshot spans.|
|Rule disagrees with ODW runtime|Maintain phase-2 loader-parity fixtures and document intentional stricter checks.|
|Production code imports executable ODW runtime paths|Run a forbidden-import architecture test in the default test suite.|
|Hostile metadata executes during lint|Use only static parsers and keep the hostile metadata fixture release-blocking.|
|Alpha ecosystem plugin changes break users|Keep Biome and Oxlint integrations optional and outside the core checker.|
|Heuristic rule blocks valid dynamic workflow|Default heuristic rules to warning or info and allow per-rule configuration.|

## 13. Packaging decision

The v1 implementation should be TypeScript, distributed as a Node/Bun package
with `@swc/core` as the parser dependency. This keeps implementation close to
ODW's TypeScript runtime and enables shared tests, shared data structures, and
future `odw check` integration.

ADR [0001-static-analysis-boundary.md](adr/0001-static-analysis-boundary.md)
chooses an owned vendored static implementation for v1. ODW integration is a
future consumer path, not a prerequisite for implementing the checker.

A Rust core is deferred. It becomes attractive if the project needs a
long-lived language server, a Node-free binary, or large-repository throughput
that the TypeScript implementation cannot meet.

## 14. Deferred integrations

|Integration|Deferred reason|
|---|---|
|Biome GritQL snippets|Useful for simple pattern checks, but cannot own ODW envelope semantics.|
|Oxlint JS plugin|Promising for AST rules and IDE diagnostics, but the plugin API is alpha and does not support custom parsers.|
|ESLint plugin|Broad reach, but it adds another diagnostic host before the ODW core is stable.|
|Language server|Depends on stable diagnostics, config, and span mapping.|
|Rust analyser core|Depends on proven performance or distribution need.|

## 15. Acceptance boundary

The first useful release is complete when `odw-lint check` can analyse the ODW
example corpus and deliberately invalid fixtures, produce stable text and JSON
diagnostics, and run in CI without executing workflow source.

Release requires:

- `make all`.
- `make markdownlint`.
- fixture snapshots for ODW examples and invalid dialect cases.
- phase-2 loader-parity tests.
- forbidden-import architecture tests.
- hostile metadata security regression tests.
- span snapshots for parser-backed diagnostics.

That release does not need automatic fixes, editor integration, or a full
plugin ecosystem.

## 16. References

- ODW loader:
  `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts`
- ODW dual compatibility:
  `/data/leynos/Projects/open-dynamic-workflows/src/dual-compat.ts`
- ODW primitives:
  `/data/leynos/Projects/open-dynamic-workflows/src/primitives.ts`
- ODW CLI:
  `/data/leynos/Projects/open-dynamic-workflows/src/cli.ts`
- Biome linter plugins:
  <https://biomejs.dev/linter/plugins/>
- Biome GritQL reference:
  <https://biomejs.dev/reference/gritql/>
- Oxlint JS plugins:
  <https://oxc.rs/docs/guide/usage/linter/js-plugins>
- Oxlint writing JS plugins:
  <https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html>
- SWC package:
  <https://www.npmjs.com/package/@swc/core>
