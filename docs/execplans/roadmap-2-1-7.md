# Add rule-catalogue parity checks for fixture diagnostics

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

Implementation status: Complete.

This is planning round 3. Do not begin implementation until the plan is
approved by the roadmap workflow. This revision addresses the previous
design-review blockers about the `messages` contract for released rules with
no fixture diagnostics and the file-scoped formatter path for work item 2.

## Purpose / big picture

Roadmap task 2.1.7 makes deliberately invalid workflow fixture diagnostics
depend on the typed rule catalogue introduced by roadmap task 2.1.6. After the
task is implemented, invalid fixture manifests can no longer drift by carrying
an uncatalogued rule, a stale default severity, a diagnostic message that is not
part of the reviewed rule contract, or a rule whose documentation page cannot be
derived from the catalogue.

The observable result is a test failure, not a new lint rule. A maintainer who
changes an invalid workflow fixture expectation must update the production rule
catalogue when the rule message contract changes, or the fixture parity tests
fail before parser-backed diagnostics begin consuming those manifests.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-7`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' \
    "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact with
  `leta`, exact text search, or file inspection inside this worktree before
  editing.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  code-shape verification when available. In this planning round, `leta files`
  succeeded and listed the branch-local source, test, fixture, and
  documentation surfaces. Implementation agents should retry `leta`; if the
  workspace is unavailable in their session, record the exact failure in this
  plan and use precise branch-local file inspection for the current task.
- Use `sem` instead of raw Git history commands if implementation needs
  history, entity-level diffs, blame, or change impact analysis. In this
  planning round, `sem diff` reported the current ExecPlan as an added
  branch-local document.
- Keep the task to catalogue-to-fixture parity. Do not implement the ODW
  envelope scanner, parser adapter, rule engine, CLI configuration loader,
  hostile metadata execution check from roadmap task 2.1.5, or loader parity
  harness from roadmap task 2.3.1.
- Production code must not import executable ODW runtime paths. ADR
  [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  forbids imports that evaluate metadata, compile workflow bodies, start runs,
  dispatch agents, or call runtime `validate(source)`.
- Tests may continue to read raw invalid fixture files as UTF-8 text. They must
  not import, evaluate, execute, or format
  `tests/static-analysis/fixtures/invalid-workflows/**/*.js`.
- Do not add a package dependency. The locked repository already provides Bun,
  TypeScript, Biome, Oxlint, Fast-check, and Node compatibility types. This
  task does not need a Markdown parser, schema validator, or code generator.
- `src/diagnostics/rule-catalogue.ts` remains the production source of truth
  for rule identifiers, categories, default severities, configuration keys,
  documentation slugs, release status, and after work item 1, diagnostic
  message contracts.
- A fixture diagnostic may use only a released rule. Planned orchestration-risk
  rules stay reserved by the catalogue but must not appear in invalid fixture
  expectations until an implementation task releases them.
- For this task, a diagnostic message contract is a finite list of exact
  reviewer-facing strings permitted for a rule. The catalogue must model it as
  data, not as prose scraped from `docs/rules/` pages.
- Do not require one message per rule. Existing branch-local manifests already
  use multiple messages for `odw/meta-description`, `odw/meta-name`, and
  `odw/meta-object`; the catalogue must support that without inventing message
  templates in this task.
- Do not add a helper abstraction that crosses module boundaries unless it is
  used in the same work item and its ownership is documented. A small
  test-local lookup helper in the fixture parity test is acceptable.
- Every source module starts with a `/** @file ... */` block. Public and
  private declarations need useful JSDoc because Oxlint loads the local
  `df12-lints` plugin.
- Keep functions small and table-driven. The existing Oxlint configuration
  enforces low complexity, low nesting depth, and complex-conditional limits.
- Format only files changed in the current work item. Do not run global
  mutating formatters such as `make fmt`, `bun fmt`, or `mdformat-all`.
- For Markdown changes, run file-scoped Markdown formatting on the changed
  paths, then run repository gates `make markdownlint` and `make nixie`.
- If a formatter rewrites unrelated files, park that churn with a named discard
  stash:

  ```sh
  git stash push -m 'df12-stash v1 task=2.1.7 kind=discard reason="formatter churn"'
  ```

- Each work item below is independently committable. Run its focused red
  check, focused green check, file-scoped formatter commands, `make all`,
  `make markdownlint`, and `make nixie` before committing that item.
- Use the `commit-message` skill and `git commit -F <message-file>` for each
  implementation commit. Do not use `git commit -m`.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs more than two production
  TypeScript files, four test TypeScript files, three documentation files, this
  ExecPlan, and the final `docs/roadmap.md` closure.
- Public API: stop and escalate if an existing public export from `odw-lint`
  must be renamed, removed, or moved to a package subpath. Adding a readonly
  field to the exported `RuleDefinition` type is in scope because the package
  is private and roadmap task 2.1.6 made the catalogue a reviewed contract.
- Dependencies: stop and escalate before adding any package dependency,
  invoking an unpinned external code generator, or adding a Markdown parser.
- Message contract: stop and escalate if an invalid fixture requires a dynamic
  message template or interpolation contract. This plan only supports exact
  message strings already present in fixture manifests.
- Fixture scope: stop and escalate if parity needs to execute fixture source or
  import raw JavaScript workflow fixtures.
- Documentation scope: stop and escalate if keeping message contracts aligned
  requires duplicating the full message list into every rule page. Rule pages
  should explain behaviour; the catalogue owns the exact message strings.
- Tests: if `make all` still fails after three focused fix attempts in one work
  item, record the failing command and options in `Decision Log` before
  continuing.
- Time: stop and escalate if one work item takes more than four hours of
  focused implementation after dependencies are installed.

## Risks

- Risk: rule messages become a second production catalogue hidden in invalid
  fixture manifests.
  Severity: high.
  Likelihood: high.
  Mitigation: work item 1 adds exact message contracts to
  `RULE_CATALOGUE`; work item 2 fails fixtures whose message is absent from the
  matching catalogue entry.

- Risk: allowing multiple messages per rule could weaken the test into a broad
  allow-list.
  Severity: medium.
  Likelihood: medium.
  Mitigation: the initial message lists are copied exactly from current invalid
  fixture manifests and reviewed in `tests/diagnostics/rule-catalogue.test.ts`.
  Do not add speculative future messages.

- Risk: fixture parity accidentally treats configured severity overrides as
  default severity.
  Severity: medium.
  Likelihood: low.
  Mitigation: invalid fixture manifests have no configuration context. Their
  `severity` must equal `RuleDefinition.defaultSeverity`; later configured
  severity tests belong to the CLI/configuration tasks.

- Risk: planned rules appear in fixture expectations before their rule-quality
  gates are implemented.
  Severity: medium.
  Likelihood: medium.
  Mitigation: work item 2 asserts every invalid fixture diagnostic references a
  `released` catalogue entry.

- Risk: documentation drift remains possible if fixture parity checks only rule
  strings and messages.
  Severity: medium.
  Likelihood: low.
  Mitigation: work item 2 derives the documentation path with `ruleDocsPath`
  and asserts that the path exists for every fixture diagnostic rule.

- Risk: the work drifts into regenerating fixture manifests.
  Severity: low.
  Likelihood: medium.
  Mitigation: do not change raw fixture files or the refresh command unless a
  parity test proves the refresh source emits stale catalogue fields. Existing
  refresh source preserves `diagnostic.message` and recomputes spans only.

## Progress

- [x] (2026-07-01T11:46+01:00) Confirmed the worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-7` on branch
  `roadmap-2-1-7`.
- [x] (2026-07-01T11:46+01:00) Read the ExecPlans, GrepAI, and Firecrawl MCP
  skills.
- [x] (2026-07-01T11:47+01:00) Ran GrepAI intent search against the canonical
  main-branch index for "rule catalogue parity checks fixture diagnostics".
  Relevant hits included `docs/roadmap.md`,
  `docs/issues/audit-2.1.6.md`, ADR 0001, and `docs/rules/index.md`.
- [x] (2026-07-01T11:47+01:00) The round-1 draft recorded a transient
  branch-local Leta workspace failure.
- [x] (2026-07-01T13:09+01:00) Reran branch-local Leta navigation with
  `leta files`; it succeeded and listed the diagnostic source modules, invalid
  workflow fixture manifests, tests, and documentation surfaces for this task.
- [x] (2026-07-01T11:48+01:00) Read `docs/roadmap.md`,
  `docs/technical-design.md`, `docs/terms-of-reference.md`, ADR 0001,
  `docs/developers-guide.md`, `docs/repository-layout.md`,
  `docs/documentation-style-guide.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`, and
  `docs/users-guide.md`.
- [x] (2026-07-01T11:50+01:00) Read `src/diagnostics/rule-catalogue.ts`,
  `src/diagnostics/types.ts`, `src/diagnostics/schema.ts`,
  `tests/diagnostics/rule-catalogue.test.ts`,
  `tests/diagnostics/rule-catalogue-docs.test.ts`,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`, and invalid
  fixture manifest types.
- [x] (2026-07-01T11:52+01:00) Installed locked dependencies with
  `make build`; Bun installed `typescript@5.9.3`, `bun-types@1.3.14`,
  `@biomejs/biome@2.5.1`, `oxlint@1.71.0`, and `fast-check@4.8.0`.
- [x] (2026-07-01T11:53+01:00) Verified official Bun test, TypeScript
  `satisfies`, and Biome CLI documentation with Firecrawl.
- [x] (2026-07-01T11:54+01:00) Verified locked local Bun test declarations in
  `node_modules/bun-types/test.d.ts` and
  `node_modules/bun-types/vendor/expect-type/index.d.ts`, plus locked package
  versions from installed package manifests.
- [x] (2026-07-01T11:55+01:00) Read sibling ODW source files
  `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts`,
  `/data/leynos/Projects/open-dynamic-workflows/src/dual-compat.ts`,
  `/data/leynos/Projects/open-dynamic-workflows/src/primitives.ts`, and
  `/data/leynos/Projects/open-dynamic-workflows/src/index.ts` to confirm this
  task must not use ODW runtime loader paths.
- [x] (2026-07-01T11:57+01:00) Drafted this initial ExecPlan.
- [x] (2026-07-01T13:10+01:00) Revised the ExecPlan for planning round 2 after
  verifying the current branch-local invalid fixture messages:
  `Workflow body must not add top-level imports or exports.` and
  `Workflow body must be syntactically complete after ODW normalization.`
- [x] (2026-07-01T13:12+01:00) Confirmed `docs/repository-layout.md` is a
  source-of-truth document for `src/diagnostics/`, `tests/diagnostics/`, and
  `tests/static-analysis/` ownership, and must be updated when
  `RuleDefinition.messages` is added.
- [x] (2026-07-01T13:15+01:00) Ran Firecrawl scrapes for the official Bun test
  runner, TypeScript `satisfies`, and Biome CLI documentation used by this
  plan. The results support the focused `bun test` commands, snapshot update
  flag, `satisfies` typing pattern, and file-scoped Biome formatting commands.
- [x] (2026-07-01T15:02+01:00) Revised the ExecPlan for planning round 3 so
  the `messages` field contract consistently allows released rules to have an
  empty array until fixture diagnostics exist, while requiring fixture-emitting
  released rules to have at least one reviewed message. Also removed the work
  item 2 recovery path that edited `src/diagnostics/rule-catalogue.ts`, keeping
  catalogue corrections in work item 1 and keeping work item 2's formatter
  commands path-safe.
- [x] (2026-07-01T12:23+01:00) Work item 1: added diagnostic message
  contracts to the rule catalogue, updated catalogue contract tests and
  source-of-truth docs, and validated with
  `bun test tests/diagnostics/rule-catalogue.test.ts`, `make all`,
  `make markdownlint`, `make nixie`, and `coderabbit review --agent`.
- [x] (2026-07-01T12:29+01:00) Work item 2: replaced the duplicated invalid
  fixture rule list with catalogue-derived rule, release status, default
  severity, message, and docs-path parity checks. Proved the message check with
  a temporary stale-message sabotage, restored it, and validated with
  `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts`,
  `make all`, `make markdownlint`, `make nixie`, and
  `coderabbit review --agent`.
- [x] (2026-07-01T12:33+01:00) Work item 3: ran pre-closeout `make all`,
  `make markdownlint`, and `make nixie` on a clean tree, marked roadmap task
  2.1.7 complete, updated this ExecPlan's final state, and prepared the
  documentation closeout commit. The closeout `coderabbit review --agent` run
  completed with zero findings.
- [x] (2026-07-01T12:42+01:00) Fix round 1: verified the blocking review
  findings against current branch-local files, then aligned the remaining
  public `odw/meta-required` examples in `docs/technical-design.md`,
  `docs/users-guide.md`, `tests/diagnostics/public-consumer.test.ts`,
  `tests/diagnostics/types.test.ts`, and the public-consumer snapshot with the
  catalogue message `Workflow source must export literal metadata.`.
- [x] (2026-07-01T12:58+01:00) Fix round 1 validation: focused diagnostic
  tests passed locally; `scrutineer` reported `make all`, `make markdownlint`,
  and `make nixie` green; a subsequent `coderabbit review --agent` completed
  with zero findings and no tracked-file changes.

## Surprises & discoveries

- Observation: `src/diagnostics/rule-catalogue.ts` currently owns rule IDs,
  categories, default severities, config keys, docs slugs, and release status,
  but not diagnostic messages.
  Evidence: branch-local inspection of `RuleDefinition`.
  Impact: message parity cannot be implemented without extending the catalogue;
  a test-only message map would preserve the parallel source of truth this task
  is meant to remove.

- Observation: invalid fixture manifests already include exact reviewer-facing
  `message` strings on every expected diagnostic.
  Evidence: branch-local inspection of
  `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts` and the
  generated family manifests.
  Impact: the first message contract can be exact and finite; no message
  template mechanism is needed in this task.

- Observation: `tests/static-analysis/invalid-workflow-fixtures.test.ts`
  contains a hard-coded `EXPECTED_RULES` list that duplicates catalogue rule
  identifiers.
  Evidence: branch-local inspection of the test.
  Impact: work item 2 should remove this duplicate rule list and assert each
  fixture diagnostic directly against `RULE_CATALOGUE`.

- Observation: the round-1 plan named stale message strings for
  `odw/no-import-export` and `odw/body-syntax`.
  Evidence: branch-local exact text search found the fixture manifests use
  `Workflow body must not add top-level imports or exports.` and
  `Workflow body must be syntactically complete after ODW normalization.`
  Impact: work item 1 now copies those exact strings into the catalogue
  message contract.

- Observation: `docs/repository-layout.md` describes the rule catalogue fields
  without diagnostic message contracts.
  Evidence: branch-local inspection of the `Source boundaries` section.
  Impact: work item 1 now updates `docs/repository-layout.md` and includes it
  in the file-scoped Markdown formatter command.

- Observation: the fixture refresh source preserves `diagnostic.message` while
  refreshing SHA-256 hashes and span fields.
  Evidence: `tests/static-analysis/fixtures/refresh-manifest-source.ts`
  generates `message: ${literal(diagnostic.message)}` and recomputes only span
  data through `refreshedDiagnosticSpan`.
  Impact: this task should not change the refresh writer unless implementation
  discovers a stale generated-source snapshot after the catalogue field is
  added.

- Observation: ODW's runtime `loadWorkflowScript` compiles workflow bodies with
  `new AsyncFunction`, and `createPrimitives().validate(source)` calls the
  loader path.
  Evidence:
  `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` and
  `/data/leynos/Projects/open-dynamic-workflows/src/primitives.ts`.
  Impact: fixture-catalogue parity must stay static and must not use ODW
  runtime helpers.

- Observation: the new catalogue test needed mutable matcher shapes even
  though the reviewed rows are readonly literal data.
  Evidence: `tsc --noEmit` rejected direct `toEqual(EXPECTED_RULE_ROWS)` calls
  and a readonly tuple passed to `toEqual`.
  Impact: work item 1 keeps readonly reviewed data and converts it to mutable
  matcher values in a test-local helper before comparison.

- Observation: work item 2's red sabotage failed exactly at the new
  catalogue-message assertion.
  Evidence: after temporarily changing one fixture manifest message to
  `stale fixture message`,
  `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts` failed
  with `Expected to contain: "stale fixture message"` and showed the matching
  catalogue message array.
  Impact: the fixture parity test now proves message drift against the
  production catalogue without executing raw fixture source.

- Observation: fix-round review found stale `odw/meta-required` examples
  outside the fixture parity surface.
  Evidence: exact branch-local search found `workflow must export const meta`
  in the technical design, users guide, public diagnostic consumer tests, and
  public-consumer snapshot while `src/diagnostics/rule-catalogue.ts` records
  `Workflow source must export literal metadata.`.
  Impact: public examples now use the same message string as the catalogue
  invariant in `docs/technical-design.md`.

## Decision log

- Decision: add exact diagnostic message strings to `RuleDefinition` as a
  readonly array field named `messages`.
  Rationale: the roadmap asks for fixture expectations to be checked against
  the typed rule catalogue for messages. Existing fixtures prove that one rule
  can have multiple valid messages, and exact strings are sufficient for the
  current fixture corpus. A test-only map or prose scraped from docs would keep
  message contracts outside the production catalogue.
  Date/Author: 2026-07-01, planning agent.

- Decision: require invalid fixture diagnostics to reference only released
  catalogue rules.
  Rationale: fixture diagnostics describe expected emitted findings. Planned
  orchestration-risk rules are reserved by design but not yet emitted.
  Date/Author: 2026-07-01, planning agent.

- Decision: validate fixture documentation parity by deriving
  `ruleDocsPath(rule)` and checking the page exists, not by adding docs paths
  to every fixture manifest.
  Rationale: the catalogue already owns docs slugs and rule-doc parity tests
  already keep `docs/rules/` synchronized. Adding a `docs` field to fixture
  manifests would create another source to refresh.
  Date/Author: 2026-07-01, planning agent.

- Decision: do not call ODW loader, `checkMeta`, `scanDualCompat`, or
  `validate(source)` for this task.
  Rationale: roadmap task 2.1.7 is static catalogue-to-fixture consistency.
  ADR 0001 allows ODW executable runtime APIs only in narrowly scoped trusted
  parity tests; this task can prove its contract with local catalogue and
  manifest data.
  Date/Author: 2026-07-01, planning agent.

- Decision: keep the first message-contract assertion inside
  `tests/diagnostics/rule-catalogue.test.ts` instead of reading invalid fixture
  manifests from the diagnostic package test.
  Rationale: work item 1 defines the reviewed catalogue rows. Fixture-manifest
  traversal belongs to work item 2, where invalid fixture expectations are the
  test subject.
  Date/Author: 2026-07-01T12:23+01:00, implementation agent.

- Decision: keep fixture-catalogue lookup helpers local to
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`.
  Rationale: work item 2 needs the lookup in one test file only, the file stays
  below the 400-line TypeScript guard, and a cross-module helper would add
  ownership policy without reuse.
  Date/Author: 2026-07-01T12:29+01:00, implementation agent.

- Decision: update the public-consumer snapshot with the representative
  `odw/meta-required` diagnostic message.
  Rationale: changing the public-consumer test fixture without the snapshot
  would leave the same stale public text preserved by snapshot review.
  Date/Author: 2026-07-01T12:42+01:00, fix-round agent.

## Outcomes & retrospective

Roadmap task 2.1.7 is complete. `RuleDefinition` now includes a readonly
`messages` array, `RULE_CATALOGUE` records exact reviewed messages for rules
already used by invalid fixture diagnostics, and source-of-truth documentation
now states that fixture message expectations must move with the catalogue.
Invalid fixture diagnostics now prove catalogue parity for rule identifiers,
release status, default severity, message contracts, and derived rule
documentation paths. Focused tests, full repository gates, Markdown lint,
Mermaid validation, and CodeRabbit reviews passed for the implementation work
items before their commits. The final closeout marked `docs/roadmap.md` task
2.1.7 complete after `make all`, `make markdownlint`, and `make nixie` passed
on a clean tree, then CodeRabbit completed with zero closeout findings. Fix
round 1 closed the remaining review blockers by replacing stale
`workflow must export const meta` public examples with the catalogued
`Workflow source must export literal metadata.` message.

## Addenda

- [x] 2.1.7.1. Guard representative diagnostic examples against catalogue
  message drift.

## Context and orientation

The current diagnostic model lives under `src/diagnostics/`. Rule identifiers
are branded in `src/diagnostics/rule-id.ts`, severities live in
`src/diagnostics/severity.ts`, diagnostic data shapes live in
`src/diagnostics/types.ts`, and JSON Schema support lives in
`src/diagnostics/schema.ts`.

Roadmap task 2.1.6 added `src/diagnostics/rule-catalogue.ts`. The catalogue
currently exports `RULE_CATALOGUE`, `RULE_IDS`, `RELEASED_RULE_IDS`,
`PLANNED_RULE_IDS`, categories, release statuses, the exported
`RuleDefinition` type, and `ruleDocsPath(rule)`. Each rule definition has
`id`, `category`, `defaultSeverity`, `configKey`, `docsSlug`, and
`releaseStatus`.

The rule documentation pages live under `docs/rules/`.
`tests/diagnostics/rule-catalogue-docs.test.ts` already proves that catalogue
docs slugs map to pages, pages start with the required metadata table, the
index links all pages, and no orphan pages exist.

`docs/repository-layout.md` is also a source-of-truth document for this task.
Its `Source boundaries` section describes the fields owned by
`src/diagnostics/rule-catalogue.ts`; its `Test and fixture boundaries` section
describes the diagnostic tests and invalid workflow fixture constraints. Adding
`RuleDefinition.messages` requires updating those sections in work item 1.

The invalid workflow fixture corpus lives under
`tests/static-analysis/fixtures/invalid-workflows/`. The raw `.js` fixtures are
deliberately invalid inputs and must not be executed. The TypeScript manifests
under `tests/static-analysis/fixtures/invalid-workflows/manifests/` record each
fixture's family, filename, SHA-256 hash, expected status, diagnostic rule,
severity, message, source span, and `spanText` anchor. The aggregate manifest is
`tests/static-analysis/fixtures/invalid-workflows.ts`.

`tests/static-analysis/invalid-workflow-fixtures.test.ts` currently checks
family order, runtime freezing, hostile fixture import safety, source hashes,
span positions, status coverage, a duplicated sorted `EXPECTED_RULES` list,
and a compact manifest snapshot. The new parity assertions belong in this file
because they are about invalid fixture diagnostic expectations, not about the
generic diagnostic package surface.

The sibling ODW checkout at
`/data/leynos/Projects/open-dynamic-workflows` is source-backed evidence for
ODW runtime behaviour. Its loader extracts `export const meta`, evaluates
metadata, and compiles the workflow body; its primitive `validate(source)` uses
that loader. Those facts support the non-execution boundary but are not a
mechanism for this task.

## Interfaces and dependencies

Use the existing TypeScript and Bun toolchain. Do not add dependencies.

The locked local dependency evidence after `make build` is:

- `typescript@5.9.3`, verified from
  `node_modules/typescript/package.json`;
- `bun-types@1.3.14`, verified from
  `node_modules/bun-types/package.json`; and
- `@biomejs/biome@2.5.1`, verified from
  `node_modules/@biomejs/biome/package.json`.

The official documentation verified with Firecrawl is:

- Bun test runner documentation at <https://bun.sh/docs/cli/test>, which
  documents `bun test`, TypeScript test files, positional file filters,
  non-zero exit on failed tests, and snapshot testing with
  `toMatchSnapshot`.
- TypeScript 4.9 release notes at
  <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html>,
  which document the `satisfies` operator preserving specific inferred types
  while checking a target type.
- Biome CLI documentation at <https://biomejs.dev/reference/cli/>, which
  documents `biome check`, `biome format`, `biome ci`, positional paths, and
  `--write`.

The locked local declaration evidence is:

- `node_modules/bun-types/test.d.ts` declares `toMatchSnapshot`,
  `toBeTrue`, and the Bun test API used by existing tests.
- `node_modules/bun-types/vendor/expect-type/index.d.ts` declares
  `expectTypeOf().toEqualTypeOf`, which existing catalogue tests already use.

At the end of work item 1, `RuleDefinition` must have this additional public
field:

```ts
readonly messages: readonly string[];
```

The field contains exact diagnostic messages that a rule may emit in fixture
expectations. Planned rules must keep `messages` empty until a later task
releases them. Released rules may also keep `messages` empty while no invalid
fixture diagnostic exists for that rule. Once a released rule appears in an
invalid fixture diagnostic, its catalogue entry must contain at least one
reviewed exact message, and the fixture diagnostic message must match one of
those strings.

Do not add a public helper unless implementation proves the lookup is needed
outside tests. A test-local helper in
`tests/static-analysis/invalid-workflow-fixtures.test.ts` may find the matching
catalogue entry by comparing `String(rule.id)` with `String(diagnostic.rule)`.

## Plan of work

### Work item 1: Add diagnostic message contracts to the rule catalogue

This work item extends the production catalogue with reviewed exact diagnostic
messages and updates the tests and documentation that define catalogue
metadata. It implements:

- `docs/roadmap.md` task 2.1.7, especially "messages ... do not become
  parallel sources of truth";
- `docs/technical-design.md` section 8, because messages are part of the
  diagnostic JSON contract;
- `docs/technical-design.md` section 9, because the catalogue is the source of
  rule metadata;
- `docs/developers-guide.md` sections "Tests" and "Workflow Fixture Corpus",
  because they define the rule catalogue and invalid manifest fields;
- `docs/repository-layout.md` sections "Source boundaries" and "Test and
  fixture boundaries";
- ADR 0001, because the catalogue must stay inert and must not import ODW
  runtime paths.

Skills to load before editing: `execplans` because this file must remain a
living plan, `grepai` for main-branch intent search, and `biome-typescript` for
the TypeScript and Biome formatting path. No dedicated TypeScript router skill
is available in this session; if one is available in the implementation
session, load it before touching TypeScript code. Otherwise record that and
follow the TypeScript guidance in `AGENTS.md`.

Red step: update `tests/diagnostics/rule-catalogue.test.ts` first so the
"contains the reviewed rule metadata in taxonomy order" assertion includes the
new `messages` field for each entry. Use exact message arrays copied from the
current invalid manifests:

- `odw/meta-required`: `Workflow source must export literal metadata.`
- `odw/meta-object`: `Workflow metadata must be an object literal.` and
  `Workflow metadata object literal must be complete.`
- `odw/meta-statically-unprovable`: `Workflow metadata must remain statically
  provable without evaluation.`
- `odw/meta-name`: `Workflow metadata must include a non-empty name string.`
- `odw/meta-description`: `Workflow metadata must include a non-empty
  description string.` and `Workflow metadata description must be a string.`
- `odw/no-import-export`: `Workflow body must not add top-level imports or
  exports.`
- `odw/body-syntax`: `Workflow body must be syntactically complete after ODW
  normalization.`

Use empty arrays for released rules that currently have no invalid fixture
diagnostics, such as `odw/claude-pure-meta`, `odw/no-date-now`,
`odw/no-math-random`, `odw/no-argless-new-date`, and
`odw/no-odw-only-validate`. Use empty arrays for planned rules. Add a separate
assertion that every released rule with fixture diagnostics has at least one
message, rather than requiring every released rule to have one before its
fixtures exist.

Run the focused red command from the repository root:

```sh
bun test tests/diagnostics/rule-catalogue.test.ts
```

Expect a TypeScript or assertion failure because `RuleDefinition.messages` does
not exist yet or because the catalogue rows do not include message arrays.

Green step: update `src/diagnostics/rule-catalogue.ts` so
`RuleDefinition` includes `messages: readonly string[]`. Update
`ruleDefinition` to accept an options object:

```ts
type RuleDefinitionInput = {
  readonly id: string;
  readonly category: RuleCategory;
  readonly defaultSeverity: DiagnosticSeverity;
  readonly releaseStatus: RuleReleaseStatus;
  readonly messages?: readonly string[];
};
```

Keep the function private to the module. Freeze the `messages` array when
building each rule definition so callers cannot mutate it. Preserve
`configKey: ruleId` and `docsSlug: id.slice("odw/".length)`.

Update `docs/technical-design.md` section 9 so it states the catalogue also
owns diagnostic message contracts. Update section 8's diagnostic-contract
invariants to state that a diagnostic message must match one of the catalogue
messages for its rule unless the rule implementation task explicitly extends
the catalogue in the same change.

Update `docs/developers-guide.md` in the rule catalogue and invalid workflow
fixture corpus paragraphs so maintainers know to update catalogue messages
when fixture `message` expectations change. Do not duplicate the entire message
list in prose.

Update `docs/repository-layout.md` in `Source boundaries` so it lists
diagnostic message contracts among the catalogue-owned fields. Update `Test and
fixture boundaries` so it states that invalid fixture diagnostic expectations
are checked against the catalogue for rule, default severity, message contract,
and docs path parity.

Run:

```sh
bun test tests/diagnostics/rule-catalogue.test.ts
```

Expect the catalogue test to pass.

Refactor step: keep helper names explicit and local. Do not create a
cross-module message lookup helper unless work item 2 proves repeated lookup
logic would be unclear. Run file-scoped formatting for the files changed in
this work item:

```sh
bunx @biomejs/biome format --write \
  src/diagnostics/rule-catalogue.ts \
  tests/diagnostics/rule-catalogue.test.ts
mdtablefix docs/technical-design.md docs/developers-guide.md docs/repository-layout.md docs/execplans/roadmap-2-1-7.md
bunx markdownlint-cli2 --fix \
  docs/technical-design.md \
  docs/developers-guide.md \
  docs/repository-layout.md \
  docs/execplans/roadmap-2-1-7.md
```

Then run:

```sh
bun test tests/diagnostics/rule-catalogue.test.ts
make all
make markdownlint
make nixie
```

Commit this work item only after all commands pass.

### Work item 2: Enforce fixture diagnostics against the catalogue

This work item makes invalid workflow fixture expectations prove rule,
severity, message, and documentation parity against `RULE_CATALOGUE`. It
implements:

- `docs/roadmap.md` task 2.1.7 success text;
- `docs/technical-design.md` sections 8, 9, 11.1, 11.2, and 11.5;
- `docs/developers-guide.md` sections "Tests", "Workflow Fixture Corpus", and
  "Source-span helpers";
- `docs/repository-layout.md` section "Test and fixture boundaries";
- ADR 0001's prohibition on executing source during ordinary tests.

Skills to load before editing: `execplans`, `grepai`, and `biome-typescript`.
If a dedicated TypeScript router skill is available in the implementation
session, load it before touching TypeScript code. If the implementation agent
introduces generated-data or property-style tests beyond the prescribed
assertions, also load the smallest relevant verification skill first; this plan
does not require Hypothesis, CrossHair, mutmut, or Fast-check.

Red step: update `tests/static-analysis/invalid-workflow-fixtures.test.ts`
first. Import `RULE_CATALOGUE`, `ruleDocsPath`, and `type RuleDefinition` from
`odw-lint`. Add small local helpers:

- `catalogueRuleForFixtureDiagnostic(diagnostic)` returns the matching
  catalogue entry or throws an error that names the fixture rule.
- `fixtureDiagnostics()` returns `{ fixture, diagnostic, rule }` triples for
  all invalid fixture diagnostics.

Replace the hard-coded `EXPECTED_RULES` assertion with catalogue-derived
checks:

- every fixture diagnostic rule exists in `RULE_CATALOGUE`;
- every fixture diagnostic rule has `releaseStatus === "released"`;
- every fixture diagnostic `severity` equals `rule.defaultSeverity`;
- every fixture diagnostic `message` is included in `rule.messages`;
- `existsSync(ruleDocsPath(rule))` is true for every fixture diagnostic rule;
- the sorted rule list still comes from actual fixtures, but no longer compares
  against a duplicated string array.

To prove the new test is real, temporarily change one fixture diagnostic
message in a manifest to a stale string, run the focused test, and confirm it
fails because the message is not in the catalogue. Restore the temporary
change before continuing. The temporary sabotage must not be committed.

Focused red command:

```sh
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts
```

Expected red failure after the temporary sabotage:

```text
Expected: ArrayContaining [...]
Received: "stale fixture message"
```

Green step: restore the temporary manifest edit. If work item 1 copied all
current messages exactly, the focused test should pass without production code
changes. If it does not, stop work item 2 and correct work item 1 before
continuing. Work item 2 must not edit
`src/diagnostics/rule-catalogue.ts`; the catalogue message contract belongs to
the independently committable catalogue work item.

After restoring the temporary manifest edit, rerun:

```sh
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts
```

Expect the invalid fixture test to pass.

Snapshot step: if the compact invalid manifest snapshot changes only because
the test output shape intentionally changed, update it with:

```sh
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts -u
```

Do not list optional snapshot files in formatter commands. If no snapshot file
changes, do not touch snapshots.

Refactor step: keep helpers in
`tests/static-analysis/invalid-workflow-fixtures.test.ts` unless the file would
exceed the 400-line TypeScript file limit. If it would exceed the limit,
extract only the new catalogue parity helpers to
`tests/static-analysis/invalid-fixture-catalogue-parity.ts` with a `/** @file
... */` header and focused JSDoc. Do not move unrelated existing span helpers.

Run file-scoped formatting for files changed in this work item. If no helper
file was created, run:

```sh
bunx @biomejs/biome format --write \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
mdtablefix docs/execplans/roadmap-2-1-7.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-7.md
```

If the helper file was created, include only that existing path:

```sh
bunx @biomejs/biome format --write \
  tests/static-analysis/invalid-workflow-fixtures.test.ts \
  tests/static-analysis/invalid-fixture-catalogue-parity.ts
mdtablefix docs/execplans/roadmap-2-1-7.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-7.md
```

Then run:

```sh
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts
make all
make markdownlint
make nixie
```

Commit this work item only after all commands pass.

### Work item 3: Close documentation and roadmap state after implementation

This work item records completion after code and tests have landed. It
implements:

- `docs/roadmap.md` task 2.1.7 status;
- `docs/developers-guide.md` documentation upkeep guidance;
- `docs/documentation-style-guide.md` roadmap and Markdown style rules;
- this ExecPlan's mandatory living sections.

Skills to load before editing: `execplans`, `changelog` only if the roadmap
workflow asks for release-note style wording, and `commit-message` before the
commit.

Red step: there is no product red test for a status-only documentation closeout.
Before editing, run:

```sh
make all
make markdownlint
make nixie
```

Expect all gates to pass on the completed implementation from work items 1 and
2.

Green step: update this ExecPlan:

- mark work items 1 and 2 complete in `Progress` with command evidence;
- add any implementation discoveries to `Surprises & Discoveries`;
- add any final implementation decisions to `Decision log`;
- update `Outcomes & Retrospective`; and
- set `Implementation status: Complete`.

Update `docs/roadmap.md` by changing task 2.1.7 from `[ ]` to `[x]` only after
the full gate passes. Do not mark later roadmap tasks complete.

Format the touched Markdown files only:

```sh
mdtablefix docs/execplans/roadmap-2-1-7.md docs/roadmap.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-7.md docs/roadmap.md
```

Then run:

```sh
make all
make markdownlint
make nixie
```

Commit the closeout only after all commands pass.

## Concrete steps

All commands run from:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-7
```

Before implementation, refresh branch-local context:

```sh
git status --short --branch
grepai search --workspace 'Projects' --project 'odw-lint' \
  "rule catalogue parity checks fixture diagnostics" --toon --compact
leta files || true
sem diff
```

If `leta files` fails in an implementation session, record the exact failure
under `Surprises & Discoveries` and use precise file inspection for the files
named in each work item. Do not mark the plan blocked solely because Leta is
unavailable.

Implement work items in order. Each work item has its own focused red command,
focused green command, file-scoped formatter commands, and repository gates.
Do not batch work items into one commit.

## Validation and acceptance

The full acceptance bar is:

- `RuleDefinition` exposes a readonly `messages` array.
- `RULE_CATALOGUE` contains exact message contracts for the invalid fixture
  diagnostics that currently exist.
- `tests/diagnostics/rule-catalogue.test.ts` fails when catalogue message
  arrays diverge from the reviewed rule rows.
- `tests/static-analysis/invalid-workflow-fixtures.test.ts` fails when an
  invalid fixture diagnostic uses an uncatalogued rule, a planned rule, a
  severity different from the rule default, a message not present in the rule
  catalogue entry, or a rule whose docs path cannot be derived from an existing
  rule page.
- Raw invalid workflow JavaScript fixtures are never imported, evaluated,
  executed, or formatted.
- The final implementation passes:

  ```sh
  make all
  make markdownlint
  make nixie
  ```

`make all` currently includes `build`, `check-fmt`, `whitespace-hygiene`,
`lint`, `typecheck`, and `test`. `make markdownlint` and `make nixie` are
required in addition because Markdown changes are part of this plan and are not
included in `make all`.

## Idempotence and recovery

All planned test and documentation edits are ordinary file edits. They can be
re-run safely after reviewing `git diff`.

If the red-stage temporary sabotage in work item 2 is left in the tree, restore
it by reviewing the manifest diff and removing only the intentionally stale
diagnostic message. Do not use `git reset --hard` or `git checkout --` unless a
human explicitly requests that destructive operation.

If file-scoped Markdown formatting touches unrelated Markdown files, inspect
the diff. Park unrelated formatter churn with:

```sh
git stash push -m 'df12-stash v1 task=2.1.7 kind=discard reason="formatter churn"'
```

If `make build` updates `node_modules`, no commit action is needed because
`node_modules` is ignored. If it updates `bun.lock`, stop and investigate
before committing; this plan does not include dependency changes.

## Artifacts and notes

Planning evidence:

```text
grepai search --workspace 'Projects' --project 'odw-lint' \
  "rule catalogue parity checks fixture diagnostics" --toon --compact --limit 8
```

returned main-branch hits for `docs/issues/audit-2.1.6.md`,
`docs/roadmap.md`, ADR 0001, and `docs/rules/index.md`.

```text
leta files
```

succeeded in planning round 2 and listed the branch-local source tree,
including `src/diagnostics/rule-catalogue.ts`,
`tests/diagnostics/rule-catalogue.test.ts`,
`tests/static-analysis/invalid-workflow-fixtures.test.ts`, invalid workflow
fixture manifests, and `docs/repository-layout.md`.

```text
make build
```

installed:

```text
typescript@5.9.3
bun-types@1.3.14
@biomejs/biome@2.5.1
oxlint@1.71.0
fast-check@4.8.0
```

`sem diff` reported the ExecPlan document as added in this branch:

```text
docs/execplans/roadmap-2-1-7.md [added]
```

## Revision note

Planning round 2 revision. This plan now uses the current branch-local fixture
message contracts for `odw/no-import-export` and `odw/body-syntax`, updates
work item 1 so `docs/repository-layout.md` is revised and formatted with the
other changed Markdown files, corrects the Leta and `sem diff` evidence, and
keeps roadmap task 2.1.7 decomposed into three ordered, independently
committable work items.

Planning round 3 revision. This plan now uses one consistent `messages`
contract: released rules may have an empty `messages` array until fixture
diagnostics exist, and fixture-emitting released rules must have at least one
reviewed exact message. Work item 2 no longer has a recovery path that edits
`src/diagnostics/rule-catalogue.ts`; if fixture messages diverge after work
item 1, the implementer must correct work item 1 before proceeding. This keeps
the work item 2 formatter commands path-safe without conditional catalogue
formatting.

Fix round 1 revision. This plan now records the blocking review follow-up that
aligned remaining public `odw/meta-required` documentation, representative
diagnostic tests, and snapshot text with the rule-catalogue message contract.
