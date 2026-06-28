# Implement the diagnostic contract spine

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.2.1 creates the shared diagnostic data model for every later
parser, rule, reporter, and command slice. After this work, consumers can
import the public TypeScript API through the package entry point, represent an
`odw-lint` diagnostic once, count severities consistently, emit a versioned
JSON report envelope, and derive text output from the same diagnostic objects.

This task deliberately does not parse workflows, calculate line and column
positions, discover files, load configuration, or implement the CLI. Roadmap
task 1.2.2 owns source-span calculation. Later roadmap tasks own the parser,
rules, configuration, and command boundary.

Success is observable without running a workflow. Running `make test` after
implementation includes focused Bun tests proving that package self-reference
resolves, diagnostics can be constructed with stable rule identifiers, invalid
rule identifiers have a programmatic failure shape, summary counts include
every severity, the JSON Schema encodes the documented source-position
invariants, and text output is formatted from the same diagnostic array used
for JSON reports.

## Constraints

- Work only in `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-1`.
- Keep `origin/main` as the canonical integration branch.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Use GrepAI first for intent search against the main-branch index. The index
  reflects `main` only, so every branch-local fact must be verified with
  `leta`, exact text search, or file inspection in this worktree.
- Use `leta` for branch-local symbol navigation, references, and code-shape
  verification.
- Use `sem` rather than raw git history commands for semantic history and
  entity-level diffs.
- Keep this task to package entry metadata, diagnostic/reporting data
  structures, and pure helpers. ODW envelope parsing, SWC parsing, line-index
  helpers, source-span calculation, file discovery, configuration, and CLI
  behaviour are out of scope.
- Production code must not import executable ODW runtime paths, including
  `loadWorkflowScript`, `createPrimitives`, runtime `validate(source)`, worker
  paths, launcher paths, or anything that evaluates metadata or dispatches
  agents. This implements ADR 0001 and `docs/technical-design.md` sections 5,
  6.4, 11.3, and 12.1.
- Do not add a runtime JSON Schema validator or any new dependency for this
  task. The report schema is exported as a literal object and tested
  structurally.
- Keep diagnostics immutable from the public API perspective. Prefer
  `readonly` object fields, `readonly` arrays, pure functions, and
  discriminated result types for recoverable failures.
- Every source module starts with a module JSDoc block. Every public and
  private declaration has useful JSDoc because Oxlint loads the `df12-lints`
  plugin.
- Keep functions small enough for the configured `complexity` max 8,
  `max-depth` max 3, and `df12/complex-conditional` max 1 logical operator.
- Format only changed files. Do not run repository-global mutating format
  commands such as `make fmt`, `bun fmt`, or `mdformat-all`.
- Each implementation work item is an independently committable change. Run
  its relevant gates before committing it.

## Tolerances (exception triggers)

- Scope: stop and escalate if implementation needs more than five new or
  modified production/config files, four new or modified test files, or more
  than 450 net lines of code for this roadmap task.
- Interface: stop and escalate if satisfying this task requires changing the
  documented diagnostic JSON shape outside `docs/technical-design.md` section
  8, except for the planned `summary.hints` clarification in work item 3.
- Package entry: stop and escalate if package self-reference cannot be made to
  pass with the current private Bun/TypeScript source entry. Do not silently
  switch to generated `dist` entry points unless the work item also changes the
  build contract and documents that change.
- Dependencies: stop and escalate if a new package is needed. This plan
  intentionally avoids Ajv, Zod, `json-schema-to-ts`, `fast-check`, and CLI
  parser dependencies for this task.
- Runtime boundary: stop immediately if a proposed implementation needs to
  import ODW runtime loader, primitive, scheduler, launcher, worker, or agent
  code in production.
- Span calculation: stop if tests require real line-index, snippet, or Unicode
  column calculation. This task defines span shapes and schema constraints
  only. Roadmap task 1.2.2 owns calculation helpers.
- Text output: keep it as a pure formatter over already-built diagnostics.
  Stop if implementing it requires CLI flags, colour policy, stdout/stderr
  routing, or file output.
- Iterations: if `make all` still fails after three fix attempts in a work
  item, document the failure in `Decision Log` and escalate.

## Risks

- Risk: `docs/technical-design.md` section 8 shows `summary.errors`,
  `summary.warnings`, and `summary.infos`, while the severity invariant also
  includes `hint`.
  Severity: medium.
  Likelihood: medium.
  Mitigation: work item 3 must update section 8 to include `summary.hints`,
  and work items 3 and 4 must pin the `hints` field with tests and schema
  assertions. Do not count hints under `infos`.

- Risk: the package entry point could drift from the tested source API.
  Severity: high.
  Likelihood: medium.
  Mitigation: work item 1 adds explicit `package.json` `exports`, `types`, and
  `main` metadata, then updates tests to import from the package name
  `odw-lint`. All later tests must keep importing through `odw-lint`, not
  `../src/index`.

- Risk: a thrown-only rule-id constructor would be awkward for later
  configuration parsing, where unknown or malformed rule IDs are recoverable
  user input.
  Severity: high.
  Likelihood: medium.
  Mitigation: work item 2 defines a discriminated `parseRuleId` result and
  predicate for boundaries, plus a throwing `makeRuleId` convenience for
  trusted literals. Tests pin both contracts.

- Risk: a broad JSON Schema validator dependency could expand the task beyond
  the diagnostic model.
  Severity: medium.
  Likelihood: low.
  Mitigation: export the schema as a literal, use structural unit tests and
  snapshots, and defer runtime schema validation until a real I/O boundary
  needs it.

- Risk: source-position helper behaviour could leak into this task.
  Severity: medium.
  Likelihood: medium.
  Mitigation: define `SourcePosition` and `SourceSpan` shapes only. The schema
  uses `minimum` to encode offset, line, and column invariants, but tests use
  literal positions and do not calculate offsets, snippets, or Unicode display
  columns.

## Progress

- [x] (2026-06-28 04:27Z) Read `AGENTS.md`, project docs, roadmap task 1.2.1,
  and the mandatory ExecPlan skill for round 1.
- [x] (2026-06-28 04:27Z) Ran GrepAI intent search against the canonical
  `odw-lint` main index and verified the branch-local code shape with `leta`.
- [x] (2026-06-28 04:27Z) Verified sibling ODW loader, dual-compat, primitive
  validation, schema helper, and example behaviour from
  `/data/leynos/Projects/open-dynamic-workflows`.
- [x] (2026-06-28 04:27Z) Verified locked local tooling versions with
  `make build`.
- [x] (2026-06-28 04:27Z) Verified official JSON Schema and Bun test
  documentation using Firecrawl.
- [x] (2026-06-28 04:41Z) Revised the plan for round 2 after design review:
  package entry publication, source-position schema minimums, and an explicit
  rule-id parse failure contract are now fixed work items.
- [x] (2026-06-28 05:06Z) Implementation work item 1: published the current
  package entry point, resolved TypeScript self-reference with `rootDir: "."`,
  passed `make all`, and received zero CodeRabbit findings.
- [x] (2026-06-28 05:10Z) Implementation work item 2: introduced diagnostic
  domain types, branded rule IDs, recoverable parse failures, trusted
  construction errors, and package-entry tests; `make all` passed and
  CodeRabbit reported zero findings.
- [x] (2026-06-28 05:14Z) Implementation work item 3: added severity-aware
  summary counts, report envelope creation, and the `summary.hints`
  design-contract clarification; `make all`, `make markdownlint`,
  `make nixie`, and CodeRabbit passed.
- [x] (2026-06-28 05:18Z) Implementation work item 4: published the
  versioned diagnostic JSON Schema with source-position and summary-count
  minimums, structural tests, and a snapshot; `make all` passed. CodeRabbit
  findings were reviewed and skipped where they conflicted with this plan's
  fixed schema scope or were already covered by tests.
- [x] (2026-06-28 05:21Z) Implementation work item 5: added a pure text
  diagnostic formatter with empty, single-diagnostic, ordering, and shared
  diagnostics snapshot coverage; `make all` and CodeRabbit passed.

## Surprises & discoveries

- Observation: GrepAI returned no existing diagnostic model code for the first
  diagnostic-contract query.
  Evidence: `grepai search --workspace Projects --project odw-lint
  "diagnostic output model severity rule identifiers summary counts JSON
  schema" --toon --compact` returned no results.
  Impact: the implementation should replace the template `greet` module rather
  than extending a hidden diagnostic module.

- Observation: the branch-local source is still the repository template.
  Evidence: `leta grep ".*" -k function,method,class,interface,type,enum,
  constant,variable --head 300` reported only `src/index.ts:greet` and its
  tests. `leta refs greet -n 2` showed tests importing `../src/index`.
  Impact: work item 1 must move tests to the package entry point before the
  diagnostic API replaces `greet`.

- Observation: `package.json` is private, has `"type": "module"`, and has no
  current `exports`, `types`, or `main` entry.
  Evidence: direct inspection of `package.json` in this worktree.
  Impact: the public TypeScript API must not be described as package-exported
  until work item 1 adds explicit package metadata and package-name tests.

- Observation: Bun's official module-resolution documentation says Bun reads
  `exports`, checks conditions in order, respects subpath exports, and can
  import untranspiled TypeScript through the special `"bun"` condition.
  Evidence: Firecrawl scrape of
  `https://bun.sh/docs/runtime/module-resolution`.
  Impact: work item 1 can use the current private source entry
  `./src/index.ts` under `"types"`, `"bun"`, `"import"`, and `"default"`
  conditions, and tests can import `odw-lint` without creating a dist build in
  this task.

- Observation: Node's official package documentation says `exports` defines
  package entry points, encapsulates unexported subpaths, takes precedence over
  `main`, and enables self-reference by package name. Its community
  conditions list says `"types"` is a typing-system condition and should be
  first.
  Evidence: Firecrawl scrape of
  `https://nodejs.org/api/packages.html#package-entry-points`.
  Impact: work item 1 must put the `"types"` condition first, include an
  explicit `"."` export, and test package self-reference.

- Observation: JSON Schema's official numeric reference says `integer` accepts
  integral values, negative integers are valid unless constrained, and ranges
  use `minimum` and `maximum`; `minimum` is inclusive.
  Evidence: Firecrawl scrape of
  `https://json-schema.org/understanding-json-schema/reference/numeric`.
  Impact: work item 4 must add `minimum: 0` to `offset` and summary count
  fields, and `minimum: 1` to `line` and `column`.

- Observation: ODW's runtime loader evaluates metadata with `new Function`,
  while `dual-compat.ts` implements a separate pure-literal parser.
  Evidence: `open-dynamic-workflows/src/loader.ts` function `extractMeta`
  slices the metadata literal and calls `new Function`; `src/dual-compat.ts`
  function `checkMeta` uses `LiteralParser`.
  Impact: this task must not import ODW runtime code. It only defines inert
  diagnostic data structures.

- Observation: ODW's own schema helper is dependency-free and implements a
  small JSON Schema subset.
  Evidence: `open-dynamic-workflows/src/schema.ts` exports `JsonSchema`,
  constructors, `describeSchema`, `extractJson`, and `validate` without an
  external validator package.
  Impact: `odw-lint` can export a JSON Schema literal now and defer validator
  dependency decisions.

- Observation: the locked install resolved `@biomejs/biome@2.5.1`,
  `bun-types@1.3.14`, `oxlint@1.71.0`, `typescript@5.9.3`, and
  `df12-lints` pinned at commit `08ca59b`.
  Evidence: `node_modules/*/package.json`, `bun.lock`, and `make build`.
  Impact: tests can rely on `bun:test`, `expectTypeOf`, and snapshots from the
  locked Bun types, and gates should use the Makefile.

- Observation: TypeScript requires an explicit `rootDir` once the package
  self-reference is resolved through the export map.
  Evidence: `make all` failed with `TS2209` until `tsconfig.json` set
  `"rootDir": "."`.
  Impact: the source-level package entry remains viable without switching to
  `dist`, and `tsc --noEmit` can resolve the package name in tests.

## Decision Log

- Decision: define spans as data shapes only in this task.
  Rationale: roadmap task 1.2.2 owns line-index and source-span helpers, while
  section 8 already requires the diagnostic JSON shape to contain spans.
  Date/Author: 2026-06-28, Codex.

- Decision: expose the current public TypeScript API through a source-level
  package entry in this task.
  Rationale: `AGENTS.md` requires explicit `package.json` `exports` and
  `types` for public APIs. The package is currently private, Bun supports a
  `"bun"` condition pointing at TypeScript source, and the Makefile does not
  build `dist` as part of `make all`. Work item 1 pins the source entry with
  package-name tests. A later packaging task may redirect runtime import paths
  to generated `dist` artefacts after it changes the build contract.
  Date/Author: 2026-06-28, Codex.

- Decision: set TypeScript `rootDir` to the repository root for package
  self-reference.
  Rationale: the export map points at `./src/index.ts` while tests import the
  package by name. TypeScript needs an unambiguous project root to resolve that
  entry, and the repository root preserves both `src` and `tests` in the
  current `noEmit` gate.
  Date/Author: 2026-06-28, Codex.

- Decision: make `parseRuleId` the recoverable boundary API and `makeRuleId`
  the trusted-literal convenience API.
  Rationale: later configuration parsing needs programmatic handling of
  unknown or invalid rule identifiers, so a discriminated result is the stable
  public contract. A throwing convenience remains useful for hard-coded rule
  IDs in tests and rule definitions.
  Date/Author: 2026-06-28, Codex.

- Decision: encode source-position numeric invariants in the exported JSON
  Schema with `minimum`.
  Rationale: `docs/technical-design.md` section 8 requires zero-based offsets
  and one-based line and column positions. Official JSON Schema numeric docs
  verify that `minimum` is the inclusive keyword needed to reject negative
  offsets and zero line or column values in the exported contract.
  Date/Author: 2026-06-28, Codex.

- Decision: include `hints` as a first-class summary count.
  Rationale: section 8 lists `hint` as a valid severity and says summary counts
  diagnostics after severity overrides. Counting hints under `infos` would
  hide a released severity from JSON consumers.
  Date/Author: 2026-06-28, Codex.

- Decision: do not add Ajv, Zod, `fast-check`, or another validator
  dependency.
  Rationale: the current lockfile has no runtime validator, official JSON
  Schema docs cover the literal schema keywords needed, and this task does not
  yet validate untrusted JSON input at a boundary.
  Date/Author: 2026-06-28, Codex.

- Decision: use Bun unit, type, and snapshot tests for this task. Do not add
  behavioural or end-to-end tests until the CLI exists.
  Rationale: the observable surface here is a pure TypeScript library contract
  and package entry point, not a command-line workflow.
  Date/Author: 2026-06-28, Codex.

- Decision: keep work item 4's JSON Schema limited to the approved keyword set
  and producer contract.
  Rationale: CodeRabbit suggested adding a `pattern` rule for `rule` and
  widening `tool.name` beyond `odw-lint`. The ExecPlan explicitly permits only
  `type`, `properties`, `required`, `additionalProperties`, `items`,
  `minItems`, `enum`, and `minimum`, and requires `tool.name` as
  `enum: ["odw-lint"]`. The snapshot suggestion was already satisfied by the
  `DIAGNOSTIC_REPORT_SCHEMA` snapshot plus structural assertions.
  Date/Author: 2026-06-28, Codex.

## Outcomes & Retrospective

Roadmap task 1.2.1 is implemented. The package entry point now exposes the
diagnostic contract spine, branded rule identifiers, severity-aware summaries,
a versioned report envelope, a dependency-free JSON Schema literal, and a pure
text formatter derived from the same diagnostic objects as JSON reports.

All five implementation work items were committed independently after their
deterministic gates. CodeRabbit was run for each work item; one schema review
run produced findings that conflicted with the approved ExecPlan keyword and
producer-name constraints, and those deviations were recorded in the Decision
Log.

## Addenda

- [x] 1.2.1.1. Harden diagnostic reporter contracts.
  - Source: review:1.2.1 and audit:1.2.1, medium.
  - Scope: normalize text-only control whitespace while leaving JSON
    diagnostics unchanged, and snapshot report diagnostics so caller-owned
    arrays cannot make report summaries inconsistent.
  - Success: text diagnostics preserve one rendered line per diagnostic, and
    report envelopes stay internally consistent after caller-side mutation.
- [x] 1.2.1.2. Add severity mirror exhaustiveness checks.
  - Source: review:1.2.1, medium.
  - Scope: add compile-time drift checks tying the severity model to
    `countDiagnostics`, JSON Schema severity enums, and tests.
  - Success: adding a severity fails type checking until all severity mirrors
    are updated together.
- [x] 1.2.1.3. Validate report file counts at the boundary.
  - Source: review:1.2.1, medium.
  - Scope: convert raw file counts into a validated non-negative integer
    report value before JSON emission.
  - Success: invalid report file counts fail at the reporting boundary instead
    of entering JSON report summaries.

## Context and orientation

The repository is a Bun and TypeScript project. Current production code is only
`src/index.ts`, which exports `greet(name: string): string`. Current tests in
`tests/index.test.ts` only exercise that greeting and import it with a relative
source path. The diagnostic model does not exist yet.

The governing roadmap item is `docs/roadmap.md` task 1.2.1 under step 1.2,
"Build the diagnostic and source-position spine". The task is complete when
JSON output includes `schemaVersion`, `tool`, `summary`, and `diagnostics`,
and text output is generated from the same diagnostics.

The primary design source is `docs/technical-design.md` section 8. It defines
the versioned JSON object shape, stable rule identifiers, severity values,
original-source span invariants, optional suggestions, and text output derived
from diagnostic objects. Sections 2.1, 5, 6.1, 6.4, 9, 11, 12, 13, and 15
constrain architecture, security, tests, and release gates. ADR 0001 makes the
static-analysis boundary binding: production code must own static analysis and
must not import ODW executable runtime helpers.

The project documentation also matters:

- `AGENTS.md` "Tooling Defaults", "Change Quality & Committing",
  "TypeScript Guidance", and "Markdown Guidance" define Makefile gates,
  package entry expectations, strict typing, test shape, and formatting rules.
- `docs/terms-of-reference.md` sections 5, 6, 8, and 9 define the job,
  diagnostic goals, success criteria, and trust-boundary constraints.
- `docs/developers-guide.md` sections "Static-Analysis Boundary",
  "Commit Gate", "Bun Scripts", "Formatting", "Linting", "Type Checking",
  "Tests", "Markdown", and "Documentation Upkeep" define local gate usage.
- `docs/scripting-standards.md` is relevant only if this task introduces
  automation scripts. It should not.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 2
  through 5 explain the complexity and refactoring rules behind the local
  Oxlint thresholds.
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines" govern prose and
  Markdown changes.

There is no `docs/users-guide.md` in the current tree. Do not invent one for
this task unless a later user-facing command or public usage guide requires it.

## Research and verified dependencies

Use these findings as fixed inputs. Do not reopen mechanism choices unless a
test or gate proves they are wrong.

- GrepAI main-index search:
  `grepai search --workspace Projects --project odw-lint "static analysis
  diagnostics reported as machine readable JSON" --toon --compact` found only
  design documentation, not implementation code.
- Branch-local verification:
  `leta files`, `leta grep ".*" -k function,method,class,interface,type,enum,
  constant,variable --head 300`, `leta show greet`, and `leta refs greet -n 2`
  show only the template `greet` export and tests.
- Semantic history verification:
  `sem diff --from origin/main --to HEAD --format json` shows the branch
  currently adds this ExecPlan relative to `origin/main`.
- Package metadata:
  `package.json` is private, ESM-first through `"type": "module"`, and has no
  current `exports`, `types`, or `main` entry. `tsconfig.json` has `outDir:
  "dist"`, `declaration: true`, and strict compiler settings, but `make all`
  currently runs `make build` as dependency installation rather than a dist
  emission step.
- Official Bun module-resolution docs verified with Firecrawl:
  `https://bun.sh/docs/runtime/module-resolution` says Bun reads `exports`,
  checks conditions in order, respects subpath exports, and can execute
  untranspiled TypeScript through the `"bun"` export condition.
- Official Node package docs verified with Firecrawl:
  `https://nodejs.org/api/packages.html#package-entry-points` says `main` and
  `exports` define package entry points, `exports` is the modern alternative,
  `exports` takes precedence over `main`, `exports` encapsulates unexported
  subpaths, self-reference by package name requires `exports`, and the
  `"types"` community condition should be first for typing systems.
- Official JSON Schema docs verified with Firecrawl:
  `https://json-schema.org/understanding-json-schema/reference/type` states
  `type` is fundamental and names `array`, `boolean`, `integer`, `number`,
  `null`, `object`, and `string` among valid types.
- Official JSON Schema docs verified with Firecrawl:
  `https://json-schema.org/understanding-json-schema/reference/object` states
  objects use string keys, `properties` maps property names to schemas,
  `required` lists required properties, and `additionalProperties: false`
  rejects extra properties.
- Official JSON Schema docs verified with Firecrawl:
  `https://json-schema.org/understanding-json-schema/reference/array` states
  `items` validates each item in list-style arrays, and `minItems` constrains
  length.
- Official JSON Schema docs verified with Firecrawl:
  `https://json-schema.org/understanding-json-schema/reference/enum` states
  `enum` restricts a value to a unique fixed set.
- Official JSON Schema docs verified with Firecrawl:
  `https://json-schema.org/understanding-json-schema/reference/numeric` states
  `integer` accepts integral values, negative integers are valid unless a range
  keyword constrains them, `minimum` and `maximum` specify ranges, and
  `minimum` is inclusive.
- Official Bun test docs verified with Firecrawl:
  `https://bun.sh/docs/test/writing-tests` states tests use the built-in
  `bun:test` module with Jest-like `test`, `describe`, `expect`,
  `expectTypeOf`, and supported snapshot matchers.
- Locked local source:
  `node_modules/bun-types/package.json` identifies `bun-types@1.3.14`.
  `node_modules/bun-types/test.d.ts` declares module `"bun:test"`,
  `expectTypeOf`, `toMatchSnapshot`, and `toMatchInlineSnapshot`.
- Locked local docs:
  `node_modules/bun-types/docs/test/snapshots.mdx` documents
  `.toMatchSnapshot()` and `.toMatchInlineSnapshot()`.
- Locked local source:
  `node_modules/typescript/package.json` identifies TypeScript `5.9.3`; the
  repository `tsconfig.json` has `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `useUnknownInCatchVariables`, `noPropertyAccessFromIndexSignature`, and
  `isolatedModules` enabled.
- Locked local source:
  `node_modules/@biomejs/biome/package.json` identifies Biome `2.5.1`,
  `node_modules/oxlint/package.json` identifies Oxlint `1.71.0`, and
  `node_modules/df12-lints/package.json` confirms the local Oxlint plugin
  package export.
- ODW sibling source:
  `open-dynamic-workflows/src/loader.ts` function `loadWorkflowScript`
  extracts `meta`, strips the `export` keyword, injects workflow globals, and
  uses `extractMeta`. Its private `extractMeta` calls `new Function` on the
  metadata literal, so it is not safe for production lint of untrusted input.
- ODW sibling source:
  `open-dynamic-workflows/src/dual-compat.ts` function `checkMeta` uses
  `LiteralParser` to accept pure object and array literals and reject
  variables, calls, spreads, operators, and template interpolation.
- ODW sibling source:
  `open-dynamic-workflows/src/primitives.ts` interface `ValidationReport`
  returns `{ ok, meta?, errors, warnings }`, and primitive `validate(source)`
  calls `loadWorkflowScript` and `scanDualCompat`. This is runtime workflow
  validation, not a host-side lint dependency.
- ODW sibling source:
  `open-dynamic-workflows/src/schema.ts` type `JsonSchema` is
  `Record<string, unknown>` and its validator is a small dependency-free
  subset covering keywords such as `type`, `properties`, `required`,
  `additionalProperties`, `items`, `minItems`, and `enum`. This task does not
  import that helper because ADR 0001 requires `odw-lint` to own its static
  analysis boundary.

## Plan of work

### Work item 1: publish the current package entry point

This work item makes the current source API importable through the package name
before the diagnostic model is added. It implements `AGENTS.md` "Public APIs",
`docs/technical-design.md` section 13, `docs/developers-guide.md` "Bun
Scripts" and "Type Checking", and `docs/roadmap.md` step 1.1's package
boundary intent.

Files to edit:

- `package.json`
- `tests/index.test.ts`

Add explicit package entry metadata to `package.json`:

```json
{
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "bun": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./package.json": "./package.json"
  }
}
```

Keep the `"types"` condition first. This matches Node's documented community
condition ordering. Pointing at `src/index.ts` is intentional for this private
Bun-first source slice because the Makefile does not build `dist` in
`make all`, and Bun's official docs support untranspiled TypeScript through
the `"bun"` condition. Do not point to `dist` in this task. A later packaging
task may switch runtime entries to generated artefacts only after it changes
the build contract and tests that contract.

Update `tests/index.test.ts` so the current template test imports from
`"odw-lint"` rather than `../src/index`. This is a temporary test over the
existing `greet` export. Later work items replace the tested API while keeping
the package-name import.

Tests:

- Unit tests: update the existing greeting tests to import from `"odw-lint"`.
- Type tests: none beyond `make typecheck`, which must resolve the package
  self-reference through `package.json`.
- Behavioural tests: none; no CLI exists.
- Property tests: none; this is package metadata.
- Snapshot tests: none.
- End-to-end tests: none.

Skills to load before implementing:

- `leta` for symbol inspection and references.
- `grepai` for any intent search.
- `biome-typescript` for TypeScript and JSON formatting behaviour.
- `execplans` if updating this plan while executing it.
- No Python or Rust router skill is needed because this work item touches
  TypeScript tests and package metadata only.

Validation for this work item:

```plaintext
set -o pipefail; bunx @biomejs/biome format --write package.json tests/index.test.ts 2>&1 \
  | tee /tmp/fmt-odw-lint-roadmap-1-2-1.out
set -o pipefail; make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-2-1.out
```

Commit after the gate passes.

### Work item 2: introduce diagnostic types and the rule-id failure contract

This work item replaces the template `greet` export with the first
diagnostic-domain public API. It implements `docs/roadmap.md` task 1.2.1,
`docs/technical-design.md` section 8, `docs/technical-design.md` sections 9.1
through 9.3 for documented rule naming examples, `docs/terms-of-reference.md`
sections 6, 8, and 9, and ADR 0001's static-analysis boundary.

Files to edit:

- `src/index.ts`
- `tests/index.test.ts`

Define these public types and constants in `src/index.ts` unless the file
would exceed the 400-line limit. If a split is needed, create
`src/diagnostics.ts` and explicitly re-export the public names from
`src/index.ts`. Tests must continue importing from `"odw-lint"`.

```typescript
export const DIAGNOSTIC_SCHEMA_VERSION = 1;
export const TOOL_NAME = "odw-lint";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";
export type SourcePosition = {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
};
export type SourceSpan = {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
};
export type DiagnosticSuggestion = {
  readonly message: string;
};
export type Diagnostic = {
  readonly file: string;
  readonly rule: RuleId;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span: SourceSpan;
  readonly docs?: string;
  readonly suggestions?: readonly DiagnosticSuggestion[];
};
```

Also define a branded `RuleId` and these public rule-id helpers:

```typescript
export type RuleId = string & { readonly __brand: unique symbol };
export type InvalidRuleIdReason =
  | "empty"
  | "missing-namespace"
  | "wrong-namespace"
  | "invalid-name";
export type InvalidRuleId = {
  readonly kind: "invalid-rule-id";
  readonly reason: InvalidRuleIdReason;
  readonly value: string;
  readonly message: string;
};
export type RuleIdParseResult =
  | { readonly ok: true; readonly value: RuleId }
  | { readonly ok: false; readonly error: InvalidRuleId };

export class InvalidRuleIdError extends Error {
  readonly detail: InvalidRuleId;
}

export function parseRuleId(value: string): RuleIdParseResult;
export function isRuleId(value: string): value is RuleId;
export function makeRuleId(value: string): RuleId;
```

`parseRuleId` is the boundary API for future configuration parsing and must
never throw for a string input. It returns `{ ok: true, value }` when the value
matches `^odw/[a-z0-9]+(?:-[a-z0-9]+)*$`; otherwise it returns
`{ ok: false, error }` with one of the reasons above. `makeRuleId` calls
`parseRuleId` and throws `InvalidRuleIdError` carrying the same `detail` when
the result is invalid. `isRuleId` narrows valid strings without exposing the
brand constructor.

The regex accepts every documented rule identifier in
`docs/technical-design.md` sections 9.1 through 9.3, including
`odw/no-odw-only-validate` and `odw/schema-for-structured-agent`. If a
documented rule ID does not match, stop and revise this plan before coding.

Tests:

- Unit tests for valid documented rule IDs from sections 9.1 through 9.3.
- Unit tests for invalid IDs: empty string, missing namespace, wrong namespace,
  uppercase letters, spaces, double slashes, double hyphens, trailing hyphen,
  and path-like values such as `odw/../meta-required`.
- Unit tests proving `parseRuleId` returns a discriminated error and does not
  throw for invalid input.
- Unit tests proving `makeRuleId` throws `InvalidRuleIdError` with the same
  detail as `parseRuleId` for invalid input.
- Unit tests proving `isRuleId` narrows valid values and rejects invalid ones.
- Unit tests proving a representative `Diagnostic` can be constructed with a
  literal span from `docs/technical-design.md` section 8.
- Type tests using `expectTypeOf` for `DiagnosticSeverity`, `RuleId`,
  `RuleIdParseResult`, and the diagnostic object shape.
- Behavioural tests: none; no CLI exists.
- Property tests: none; the rule-id grammar is finite enough for table-driven
  coverage in this task.
- Snapshot tests: none in this work item.
- End-to-end tests: none.

Skills to load before implementing:

- `leta` for symbol inspection and references.
- `grepai` for intent search.
- `biome-typescript` for TypeScript formatting and lint behaviour.
- `execplans` if updating this plan while executing it.
- No Python or Rust router skill is needed because this item touches only
  TypeScript.

Validation for this work item:

```plaintext
set -o pipefail; bunx @biomejs/biome format --write src/index.ts tests/index.test.ts 2>&1 \
  | tee /tmp/fmt-odw-lint-roadmap-1-2-1.out
set -o pipefail; make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-2-1.out
```

If the implementation split modules, replace the paths above with only the
changed TypeScript files. Commit after the gate passes.

### Work item 3: add severity-aware summary counts and report envelope

This work item adds the pure functions that count effective diagnostic
severities and wrap diagnostics in the versioned report envelope. It implements
`docs/technical-design.md` section 8, `docs/terms-of-reference.md` section 8,
`docs/roadmap.md` task 1.2.1, and `AGENTS.md` "Structured diagnostics".

Files to edit:

- `src/index.ts`, or the diagnostic module created in work item 2.
- `tests/index.test.ts`, or a focused diagnostics test if work item 2 split
  the module.
- `docs/technical-design.md`

Update the JSON example and invariant prose in `docs/technical-design.md`
section 8 so `summary` includes `hints`. This is a design clarification, not
an optional fork. The severity model includes `hint`, so the summary contract
must expose a first-class hint count.

Define:

```typescript
export type DiagnosticSummary = {
  readonly files: number;
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly hints: number;
};

export type ToolInfo = {
  readonly name: typeof TOOL_NAME;
  readonly version: string;
};

export type DiagnosticReport = {
  readonly schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
  readonly tool: ToolInfo;
  readonly summary: DiagnosticSummary;
  readonly diagnostics: readonly Diagnostic[];
};
```

Define pure helpers:

```typescript
export function countDiagnostics(input: {
  readonly files: number;
  readonly diagnostics: readonly Diagnostic[];
}): DiagnosticSummary;

export function createDiagnosticReport(input: {
  readonly version: string;
  readonly files: number;
  readonly diagnostics: readonly Diagnostic[];
}): DiagnosticReport;
```

`summary` must count the diagnostics passed to the helper exactly as they
arrive. Later configuration and strictness work applies severity overrides
before report creation. `createDiagnosticReport` uses the supplied version
string because section 8 says `tool.version` comes from the package version,
and the CLI or package boundary will supply that value later.

Tests:

- Unit tests for an empty diagnostic list and a mixed list containing every
  severity.
- Unit tests that input order does not affect counts.
- Unit tests that `hints` is independent from `infos`.
- Unit tests that `createDiagnosticReport` uses schema version `1`, tool name
  `odw-lint`, the supplied version string, the supplied file count, and the
  same diagnostic array values.
- Behavioural tests: none; no CLI exists yet.
- Property tests: none; finite severity coverage plus order tests are enough
  without adding `fast-check`.
- Snapshot tests: use one small inline or file snapshot for the report envelope
  only if it helps review the `hints` design-doc clarification. Keep semantic
  assertions as the primary checks.
- End-to-end tests: none.

Skills to load before implementing:

- `leta`
- `grepai`
- `biome-typescript`
- `execplans` if editing this plan while executing it.
- `en-gb-oxendict-style` when updating prose.

Validation for this work item:

```plaintext
set -o pipefail; bunx @biomejs/biome format --write <changed-ts-files> 2>&1 \
  | tee /tmp/fmt-odw-lint-roadmap-1-2-1.out
mdtablefix docs/technical-design.md
bunx markdownlint-cli2 --fix docs/technical-design.md
set -o pipefail; make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-2-1.out
set -o pipefail; make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-2-1.out
set -o pipefail; make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-2-1.out
```

Commit after all relevant gates pass.

### Work item 4: publish the versioned diagnostic JSON Schema

This work item exports the schema describing the report envelope and encodes
the source-position invariants from `docs/technical-design.md` section 8. It
implements section 8 and the JSON-output success criterion in
`docs/roadmap.md` task 1.2.1.

Files to edit:

- `src/index.ts`, the diagnostic module created earlier, or a new
  `src/diagnostic-schema.ts` re-exported from `src/index.ts`.
- Diagnostic tests under `tests/`.

Export a literal `DIAGNOSTIC_REPORT_SCHEMA` object. Use only the JSON Schema
keywords verified above: `type`, `properties`, `required`,
`additionalProperties`, `items`, `minItems`, `enum`, and `minimum`. Do not use
`$ref`, `allOf`, `unevaluatedProperties`, custom formats, or runtime validator
dependencies in this task.

The schema must describe:

- the top-level report object with required `schemaVersion`, `tool`,
  `summary`, and `diagnostics`;
- `schemaVersion` as the fixed value `1`, using `enum: [1]`;
- `tool.name` as `enum: ["odw-lint"]`;
- `tool.version` as a string;
- `summary.files`, `summary.errors`, `summary.warnings`, `summary.infos`, and
  `summary.hints` as integers with `minimum: 0`;
- `diagnostics` as an array of diagnostic objects with `minItems: 0`;
- diagnostic `severity` as `enum: ["error", "warning", "info", "hint"]`;
- diagnostic `rule`, `file`, and `message` as strings;
- diagnostic `span.start` and `span.end` positions with integer `offset`,
  `line`, and `column`;
- `offset` as `type: "integer"` with `minimum: 0`, because section 8 says
  offset is zero-based;
- `line` and `column` as `type: "integer"` with `minimum: 1`, because section
  8 says line and column are one-based display positions;
- optional `docs` as a string;
- optional `suggestions` as an array of objects with required string
  `message` and `minItems: 0`.

Use `additionalProperties: false` on each object schema owned by this task so
JSON consumers receive a tight contract. Since this task does not add a runtime
schema validator, tests must inspect the exported schema structure directly.

Tests:

- Unit tests that the exported schema contains the same severity enum as the
  TypeScript severity model.
- Unit tests that the schema requires the documented top-level envelope keys.
- Unit tests that the schema summary keys match `DiagnosticSummary` and each
  summary count has `minimum: 0`.
- Unit tests that both start and end positions declare `offset.minimum === 0`,
  `line.minimum === 1`, and `column.minimum === 1`.
- Unit tests that `additionalProperties: false` appears on owned object
  schemas.
- Snapshot test for the schema object, because this is a reviewer-useful
  output contract. Keep the snapshot small by sorting object keys if the
  implementation uses helper builders.
- Behavioural tests: none; no CLI exists.
- Property tests: none; this is a finite schema object.
- End-to-end tests: none.

Skills to load before implementing:

- `leta`
- `grepai`
- `biome-typescript`
- `firecrawl-mcp` only if rechecking external JSON Schema behaviour.

Validation for this work item:

```plaintext
set -o pipefail; bunx @biomejs/biome format --write <changed-ts-files> 2>&1 \
  | tee /tmp/fmt-odw-lint-roadmap-1-2-1.out
set -o pipefail; make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-2-1.out
```

Commit after the gate passes.

### Work item 5: add a pure text diagnostic formatter from the same diagnostics

This work item satisfies the roadmap success criterion that text output is
generated from the same diagnostics as JSON output, without implementing CLI
I/O. It implements `docs/technical-design.md` section 8,
`docs/terms-of-reference.md` sections 6 and 8, and `docs/roadmap.md` task
1.2.1.

Files to edit:

- `src/index.ts` or the diagnostic module created earlier.
- Diagnostic tests under `tests/`.

Define a pure helper:

```typescript
export function formatTextDiagnostics(diagnostics: readonly Diagnostic[]): string;
```

The formatter returns an empty string for no diagnostics. For diagnostics, it
formats one stable line per diagnostic with enough information to fix a
fixture without JSON:

```plaintext
examples/fan-out-reduce.js:1:1 error odw/meta-required workflow must export const meta
```

Use `span.start.line` and `span.start.column`. Do not read files, calculate
snippets, colourize output, wrap text, or choose exit codes. Those belong to
later reporter and CLI tasks.

Tests:

- Unit tests for the empty case and one diagnostic.
- Unit tests for multiple diagnostics preserving input order.
- Snapshot test for a mixed diagnostic list. Use the same diagnostic fixture to
  build a JSON report and text output in the test, pinning the "same
  diagnostics" contract without a CLI.
- Behavioural tests: none; no command exists.
- Property tests: none; formatting is deterministic string rendering over a
  finite fixture set.
- End-to-end tests: none.

Skills to load before implementing:

- `leta`
- `grepai`
- `biome-typescript`

Validation for this work item:

```plaintext
set -o pipefail; bunx @biomejs/biome format --write <changed-ts-files> 2>&1 \
  | tee /tmp/fmt-odw-lint-roadmap-1-2-1.out
set -o pipefail; make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-2-1.out
```

Commit after the gate passes.

## Concrete steps

Run all commands from
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-1`.

Before implementation, re-check the branch and plan path:

```plaintext
git branch --show
test "$(git branch --show)" = "roadmap-1-2-1"
test -f docs/execplans/roadmap-1-2-1.md
```

Before each work item, refresh branch-local context:

```plaintext
grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
leta files
leta grep "Diagnostic|Rule|Severity|Report|Summary" -k type,interface,function,const,variable --head 200
sem diff --from origin/main --to HEAD --format json
```

Use exact text search only for literals such as rule identifiers, command
names, config keys, and Markdown headings.

After editing TypeScript or JSON files, format only the changed files:

```plaintext
bunx @biomejs/biome format --write <changed-ts-or-json-files>
```

After editing Markdown files, format only the changed Markdown files:

```plaintext
mdtablefix docs/execplans/roadmap-1-2-1.md <other-changed-md-files>
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-1.md <other-changed-md-files>
```

Run gates through `tee`:

```plaintext
set -o pipefail; make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-2-1.out
```

When Markdown files changed in a work item, also run:

```plaintext
set -o pipefail; make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-2-1.out
set -o pipefail; make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-2-1.out
```

Inspect failure logs directly before retrying:

```plaintext
tail -n 120 /tmp/all-odw-lint-roadmap-1-2-1.out
tail -n 120 /tmp/markdownlint-odw-lint-roadmap-1-2-1.out
tail -n 120 /tmp/nixie-odw-lint-roadmap-1-2-1.out
```

Commit each work item only after its relevant gates pass. Use the
`commit-message` skill and file-based commit messages:

```plaintext
git status --short
sem diff --format json
git add <changed-files>
COMMIT_MSG_DIR=$(mktemp -d)
$EDITOR "$COMMIT_MSG_DIR/COMMIT_MSG.md"
git commit -F "$COMMIT_MSG_DIR/COMMIT_MSG.md"
rm -rf "$COMMIT_MSG_DIR"
```

## Validation and acceptance

The implementation of roadmap task 1.2.1 is accepted when:

- `package.json` exposes the current package entry through explicit `exports`,
  `types`, and `main` fields, and tests import from `"odw-lint"` rather than
  `../src/index`.
- `src/index.ts` or its explicitly re-exported diagnostic modules define a
  diagnostic model with source span data, severity model, branded rule
  identifier type, parse failure result type, summary type, report envelope
  type, JSON Schema constant, and pure text formatter.
- `parseRuleId` returns a discriminated result for valid and invalid input, and
  later configuration parsing can use it without catching exceptions.
- `makeRuleId` accepts all documented rule identifiers in
  `docs/technical-design.md` sections 9.1 through 9.3 and throws
  `InvalidRuleIdError` with programmatic detail for malformed identifiers.
- `countDiagnostics` counts diagnostics after effective severities have been
  chosen by the caller and exposes `hints` separately from `infos`.
- `createDiagnosticReport` emits `schemaVersion`, `tool`, `summary`, and
  `diagnostics`.
- `docs/technical-design.md` section 8 shows `summary.hints` and matches the
  implemented report envelope.
- The exported JSON Schema describes the same report shape as the TypeScript
  types, uses only verified JSON Schema keywords, and includes `minimum: 0` for
  offsets and summary counts plus `minimum: 1` for line and column.
- Text output is derived from the same `Diagnostic` objects as JSON output and
  includes file, line, column, severity, rule, and message.
- Tests cover package self-reference, valid and invalid rule identifiers,
  parse-result failures, empty diagnostics, mixed severities, schema
  consistency, source-position schema minimums, and text formatting.
- `make all` passes.
- `make markdownlint` and `make nixie` pass for any work item that changes
  Markdown.

Expected final command shape:

```plaintext
set -o pipefail; make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-2-1.out
set -o pipefail; make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-2-1.out
set -o pipefail; make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-2-1.out
```

Expected final result: all commands exit 0.

## Idempotence and recovery

All code helpers in this plan are pure and deterministic. Re-running tests
should not write outside Bun snapshot files created by snapshot tests. If a
snapshot changes, inspect the diff and update it only when the diagnostic
contract change is intentional.

If a formatter changes files outside the intended paths, do not commit that
churn. If parking is required, use a named stash:

```plaintext
git stash push -m 'df12-stash v1 task=1.2.1 kind=discard reason="unrelated formatter churn"' -- <paths>
```

Do not use a bare `git stash`. Do not use `git reset --hard` or
`git checkout --` unless explicitly authorised.

If a work item fails midway, leave the plan's `Progress`, `Surprises &
Discoveries`, and `Decision Log` updated before stopping. The next agent must
be able to resume from this file alone.

## Artifacts and notes

Important local research commands already run for this draft:

```plaintext
grepai search --workspace Projects --project odw-lint \
  "static analysis diagnostics reported as machine readable JSON" \
  --toon --compact
grepai search --workspace Projects --project odw-lint \
  "package entry point exports public TypeScript API" \
  --toon --compact
grepai search --workspace Projects --project odw-lint \
  "ODW workflow loader parse source positions diagnostics" \
  --toon --compact
leta workspace add /data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-1
leta files
leta grep ".*" -k function,method,class,interface,type,enum,constant,variable --head 300
leta show greet
leta refs greet -n 2
sem diff --from origin/main --to HEAD --format json
```

External documents verified with Firecrawl:

```plaintext
https://bun.sh/docs/runtime/module-resolution
https://bun.sh/docs/test/writing-tests
https://nodejs.org/api/packages.html#package-entry-points
https://json-schema.org/understanding-json-schema/reference/type
https://json-schema.org/understanding-json-schema/reference/object
https://json-schema.org/understanding-json-schema/reference/array
https://json-schema.org/understanding-json-schema/reference/enum
https://json-schema.org/understanding-json-schema/reference/numeric
```

Sibling ODW files inspected:

```plaintext
/data/leynos/Projects/open-dynamic-workflows/src/loader.ts
/data/leynos/Projects/open-dynamic-workflows/src/dual-compat.ts
/data/leynos/Projects/open-dynamic-workflows/src/primitives.ts
/data/leynos/Projects/open-dynamic-workflows/src/schema.ts
/data/leynos/Projects/open-dynamic-workflows/src/index.ts
/data/leynos/Projects/open-dynamic-workflows/examples/fan-out-reduce.js
/data/leynos/Projects/open-dynamic-workflows/examples/loop-until-dry.js
```

Skills used to prepare this plan and relevant for implementation:

- `execplans`: plan structure, mandatory living sections, and revision note.
- `leta`: branch-local symbol navigation and verification.
- `grepai`: primary intent search against the canonical main index.
- `sem`: semantic diff/history navigation.
- `firecrawl-mcp`: official web documentation verification.
- `biome-typescript`: TypeScript and JSON formatting and lint guidance.
- `en-gb-oxendict-style`: Oxford British spelling and grammar for prose.
- `commit-message`: file-based commit messages for gated commits.

## Interfaces and dependencies

The implementation must expose a small TypeScript API from the package entry
point. Tests must import public names from `"odw-lint"`, not from relative
source paths. The exact module split is flexible within the file-count
tolerance, but the public names should stay stable once committed:

- `DIAGNOSTIC_SCHEMA_VERSION`
- `TOOL_NAME`
- `DiagnosticSeverity`
- `RuleId`
- `InvalidRuleIdReason`
- `InvalidRuleId`
- `RuleIdParseResult`
- `InvalidRuleIdError`
- `parseRuleId`
- `isRuleId`
- `makeRuleId`
- `SourcePosition`
- `SourceSpan`
- `DiagnosticSuggestion`
- `Diagnostic`
- `DiagnosticSummary`
- `ToolInfo`
- `DiagnosticReport`
- `countDiagnostics`
- `createDiagnosticReport`
- `DIAGNOSTIC_REPORT_SCHEMA`
- `formatTextDiagnostics`

No new external dependency is permitted by this plan. The only load-bearing
external behaviour is the existing repository tooling and official standards:

- Package self-reference and `exports` semantics from official Node package
  docs and Bun module-resolution docs.
- Bun source TypeScript execution through the official `"bun"` export
  condition.
- Bun test APIs from official Bun docs and locked `bun-types@1.3.14`.
- Type checking through locked `typescript@5.9.3` via the repository Makefile.
- Formatting and linting through locked Biome, Oxlint, and `df12-lints` as
  invoked by the Makefile.
- JSON Schema keyword semantics from official JSON Schema documentation,
  including inclusive `minimum`.

## Initial draft note

Created 2026-06-28 by Codex for roadmap task 1.2.1. The first planning round
contained no implementation changes.

## Round 2 revision note

Revised 2026-06-28 by Codex after design review. This revision adds an
independently committable package-entry work item and requires tests to import
through `"odw-lint"`. It also requires JSON Schema `minimum` constraints for
source-position and summary-count invariants, and defines the public rule-id
failure contract through `parseRuleId`, `isRuleId`, `makeRuleId`, and
`InvalidRuleIdError`. No implementation has started.
