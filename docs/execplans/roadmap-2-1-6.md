# Introduce the typed rule catalogue

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: DRAFT

Implementation status: Complete.

This is planning round 2. Do not begin implementation until the plan is
approved by the roadmap workflow. This revision resolves the previous
design-review blockers by making the architecture pin update part of work item
1, completing the work item 1 formatter list, and updating the diagnostic
contract section when the schema rule enum is introduced.

## Purpose / big picture

Roadmap task 2.1.6 introduces one production rule catalogue before ODW
envelope diagnostics broaden. After the task is implemented, every rule
identifier, category, default severity, configuration key, documentation slug,
and release status used by diagnostics and rule documentation comes from one
typed TypeScript module.

The observable result is not a new lint rule. The observable result is drift
prevention: adding, renaming, releasing, or documenting a rule fails tests
unless the production catalogue, JSON diagnostic schema, configuration-key
surface, and `docs/rules/` pages stay in sync.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-6`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project "$(get-project)" \
    "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact with
  `leta`, exact text search, or file inspection inside this worktree before
  editing.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  code-shape verification. Use exact text search only for literal strings,
  Markdown, JSON snapshots, and raw fixture content.
- Use `sem` instead of raw Git history commands if implementation needs
  history, entity-level diffs, blame, or change impact analysis.
- Keep the task to the typed rule catalogue, rule documentation, and parity
  tests. Do not implement the ODW envelope scanner, rule engine, CLI
  configuration loader, fixture-diagnostic parity from roadmap 2.1.7, hostile
  metadata execution checks from roadmap 2.1.5, or loader parity from roadmap
  2.3.
- Production code must not import executable ODW runtime paths. ADR
  [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  forbids imports that evaluate metadata, compile workflow bodies, start runs,
  dispatch agents, or call runtime `validate(source)`.
- Do not add a package dependency. The locked repository already provides Bun,
  TypeScript, Biome, Oxlint, Fast-check, and Node compatibility types. This
  task must not add a Markdown parser, YAML parser, JSON Schema validator, or
  rule-doc generator dependency.
- Use the production catalogue as the source of truth for rule metadata once
  work item 1 lands. Documentation remains the reviewed source of truth for
  intent and policy, and parity tests keep the catalogue and rule pages aligned.
- Configuration keys are exactly the rule identifiers for this task. The
  example in `docs/technical-design.md` section 10 already uses
  `"odw/bounded-loop"` as a configuration key. Do not introduce aliases or a
  separate configuration-key grammar in this task.
- Rule documentation slugs are exactly the rule identifier suffix after
  `odw/`, for example `odw/meta-required` maps to
  `docs/rules/meta-required.md`.
- Initial `releaseStatus` values are:
  - `released` for the dialect-error rules in
    `docs/technical-design.md` section 9.1.
  - `released` for the Claude compatibility rules in
    `docs/technical-design.md` section 9.2.
  - `planned` for orchestration-risk rules in
    `docs/technical-design.md` section 9.3, because section 9.3 requires a
    per-rule quality gate before heuristic rules are released.
- Every source module starts with a `/** @file ... */` block. Public and
  private declarations need useful JSDoc because Oxlint loads the local
  `df12-lints` plugin.
- Keep functions small and table-driven. The existing Oxlint configuration
  enforces low complexity, low nesting depth, and complex-conditional limits.
- Work item 1 must update `tests/diagnostics/architecture.test.ts` because it
  pins the package-entry module specifiers and the exact
  `src/diagnostics/*.ts` file list. The file is already 396 lines, so do not
  add inline list entries there. Extract only the three final package-entry
  pin lists to a new `tests/diagnostics/architecture-fixtures.ts` helper, then
  update the existing architecture test to import those constants. This keeps
  the architecture guard current while reducing the oversized test file.
- Do not edit `tests/diagnostics/import-architecture.ts`; it is already 400
  lines and the rule-catalogue task does not require changes to its import
  parser helpers.
- If `tests/diagnostics/public-api-surface.test.ts` needs public catalogue
  exports, first move its long expected-export list into a new helper file
  `tests/diagnostics/public-api-fixtures.ts`. This is mandatory because the
  current file is 390 lines and direct additions would predictably breach the
  local 400-line file-size convention.
- Format only files changed in the current work item. Do not run global
  mutating formatters such as `make fmt`, `bun fmt`, or `mdformat-all`.
- For Markdown changes, run file-scoped Markdown formatting on the changed
  paths, then run repository gates `make markdownlint` and `make nixie`.
- If a formatter rewrites unrelated files, park that churn with a named discard
  stash:

  ```sh
  git stash push -m 'df12-stash v1 task=2.1.6 kind=discard reason="formatter churn"'
  ```

- Each work item below is independently committable. Run its focused red test,
  focused green test, formatter commands, `make all`, `make markdownlint`, and
  `make nixie` before committing that item.
- Use the `commit-message` skill and `git commit -F <message-file>` for each
  implementation commit. Do not use `git commit -m`.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if the implementation needs more than four
  production TypeScript files, ten test TypeScript files, the rule docs
  directory, this ExecPlan, `docs/technical-design.md`,
  `docs/developers-guide.md`, and the final `docs/roadmap.md` closure. The
  planned test files include the architecture pin helper and public API helper
  needed to keep existing oversized tests under the project line limit.
- Public API: stop and escalate if an existing public export from `odw-lint`
  must be renamed, removed, or moved to a package subpath.
- Dependencies: stop and escalate before adding any package dependency or
  invoking an unpinned external code generator.
- Rule taxonomy: stop and escalate if the implementer finds a rule in
  `docs/technical-design.md` section 9 that cannot be represented with the
  planned fields `id`, `category`, `defaultSeverity`, `configKey`, `docsSlug`,
  and `releaseStatus`.
- Documentation parser: stop and escalate if the rule pages need more than a
  deliberately constrained Markdown metadata-table parser in the test suite.
  Do not add YAML front matter or a Markdown AST parser in this task.
- Fixture parity: stop if work drifts into checking invalid workflow fixture
  diagnostics against rule messages, spans, or docs slugs. Roadmap 2.1.7 owns
  fixture diagnostic parity.
- Schema contract: stop and escalate if JSON Schema consumers require
  arbitrary future rule identifiers instead of the catalogued rule enum. That
  would change the diagnostic contract in `docs/technical-design.md` section
  8. Work item 3 must update section 8 to state the versioning rule for future
  catalogue additions.
- Tests: if `make all` still fails after three focused fix attempts in one
  work item, record the failing command and options in `Decision Log` before
  continuing.
- Time: stop and escalate if one work item takes more than four hours of
  focused implementation after dependencies are installed.

## Risks

- Risk: rule metadata remains split between the technical design, test
  fixtures, JSON Schema, and docs pages.
  Severity: high.
  Likelihood: medium.
  Mitigation: work item 1 creates the production catalogue, work item 2 checks
  rule docs against it, and work item 3 makes the diagnostic schema rule enum
  derive from it.

- Risk: a public export update pushes
  `tests/diagnostics/public-api-surface.test.ts` beyond the 400-line project
  convention.
  Severity: medium.
  Likelihood: high.
  Mitigation: work item 1 must extract the expected export list to
  `tests/diagnostics/public-api-fixtures.ts` before adding catalogue exports.

- Risk: a docs parity test becomes a brittle Markdown parser.
  Severity: medium.
  Likelihood: medium.
  Mitigation: rule pages use one fixed metadata table. The test reads only
  that table, checks exact field names, and ignores prose below the metadata.
  No Markdown or YAML dependency is introduced.

- Risk: released and planned rule states become unclear before the CLI exists.
  Severity: medium.
  Likelihood: medium.
  Mitigation: the initial status policy is explicit in `Constraints`. Dialect
  and Claude compatibility rules are released because their identifiers are
  already part of the first dialect slice; orchestration-risk rules stay
  planned until their section 9.3 quality gates exist.

- Risk: adding `rule` enums to the diagnostic JSON Schema makes planned rules
  look user-visible.
  Severity: low.
  Likelihood: medium.
  Mitigation: work item 3 uses all catalogued rule IDs for schema validity but
  keeps release status in the catalogue and docs pages. Consumers can validate
  rule strings while still distinguishing released from planned rules.

- Risk: the work drifts into generated documentation.
  Severity: low.
  Likelihood: medium.
  Mitigation: create hand-authored rule pages plus tests. Do not add a
  generator until a future task can own the command, templates, and update
  workflow.

## Progress

- [x] (2026-06-29T10:11Z) Confirmed the worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-6` on branch
  `roadmap-2-1-6`.
- [x] (2026-06-29T10:11Z) Read the ExecPlan, GrepAI, Firecrawl, Leta,
  Biome TypeScript, en-GB Oxford style, Sem, and commit-message skills.
- [x] (2026-06-29T10:11Z) Added this worktree to Leta and used `leta files`,
  `leta grep`, and `leta show` for branch-local code-shape verification.
- [x] (2026-06-29T10:11Z) Used GrepAI intent search against the canonical
  `odw-lint` main-branch index for typed rule catalogues, rule docs, public
  exports, and diagnostic rule metadata. Branch-local facts were verified
  directly in this worktree.
- [x] (2026-06-29T10:11Z) Read `docs/roadmap.md`,
  `docs/technical-design.md`, ADR 0001, `docs/developers-guide.md`,
  `docs/documentation-style-guide.md`, `docs/scripting-standards.md`,
  `docs/terms-of-reference.md`, audit 1.2.1, and neighbouring ExecPlans.
- [x] (2026-06-29T10:11Z) Installed locked dependencies with `make build` to
  inspect local library declarations and source.
- [x] (2026-06-29T10:11Z) Verified official Bun test, TypeScript
  `satisfies`, and Node `fs` documentation with Firecrawl.
- [x] (2026-06-29T10:11Z) Verified locked local evidence for
  `typescript@5.9.3`, `bun-types@1.3.14`, and Node type declarations under
  `node_modules/`.
- [x] (2026-06-29T10:11Z) Confirmed `docs/rules/` does not exist on this
  branch, current test-local `documentedRuleIds` lives in
  `tests/diagnostics/fixtures.ts`, and `DIAGNOSTIC_REPORT_SCHEMA` currently
  treats `rule` as a plain string.
- [x] (2026-06-29T10:11Z) Drafted this initial ExecPlan.
- [x] (2026-06-29T13:07Z) Re-read the ExecPlan, GrepAI, Firecrawl, Leta, Sem,
  Biome TypeScript, en-GB Oxford style, and commit-message skills for planning
  round 2.
- [x] (2026-06-29T13:07Z) Used GrepAI intent search against the canonical
  main-branch index for the diagnostic architecture pin surface, then verified
  branch-local facts with Leta and direct file inspection in this worktree.
- [x] (2026-06-29T13:07Z) Confirmed
  `tests/diagnostics/architecture.test.ts` pins the exact package-entry
  specifiers and diagnostic file list in the final architecture test, so work
  item 1 must update it.
- [x] (2026-06-29T13:07Z) Confirmed work item 1's formatter list omitted
  `tests/diagnostics/rule-id.test.ts` even though that item changes the file.
- [x] (2026-06-29T13:07Z) Confirmed `docs/technical-design.md` section 8 owns
  the diagnostic JSON contract and `schemaVersion` compatibility rule, so work
  item 3 must update section 8 as well as section 9.
- [x] (2026-06-29T13:07Z) Revised this ExecPlan to resolve all three
  blocking design-review points.
- [x] (2026-06-29T13:31Z) Completed work item 1 by adding
  `src/diagnostics/rule-catalogue.ts`, exporting the catalogue through
  `src/index.ts`, deriving test-local documented rule IDs from `RULE_IDS`,
  and extracting the public API and architecture pin lists into helper
  fixtures.
- [x] (2026-06-29T13:31Z) Ran work item 1 focused tests:
  `bun test tests/diagnostics/rule-catalogue.test.ts
  tests/diagnostics/rule-id.test.ts tests/diagnostics/architecture.test.ts
  tests/diagnostics/public-api-surface.test.ts`.
- [x] (2026-06-29T13:31Z) Ran work item 1 file-scoped formatters:
  `bunx @biomejs/biome format --write` on the changed TypeScript files,
  `mdtablefix --in-place docs/technical-design.md
  docs/execplans/roadmap-2-1-6.md`, and `bunx markdownlint-cli2 --fix` on
  the same Markdown files.
- [x] (2026-06-29T13:31Z) Scrutineer reran `make all`, `make markdownlint`,
  and `make nixie` until all three deterministic gates passed for work item 1.
- [x] (2026-06-29T13:31Z) Scrutineer ran `coderabbit review --agent` for work
  item 1. The review was not rate-limited and reported one major finding
  about mutable rule entry objects plus one trivial request for negative type
  assertions; both were addressed before rerunning gates.
- [x] (2026-06-29T13:44Z) Completed work item 2 by adding
  `docs/rules/index.md`, one page for every catalogue `docsSlug`, and
  `tests/diagnostics/rule-catalogue-docs.test.ts`.
- [x] (2026-06-29T13:44Z) Confirmed the work item 2 red step:
  `bun test tests/diagnostics/rule-catalogue-docs.test.ts` failed because
  `docs/rules/` and the rule index did not exist.
- [x] (2026-06-29T13:44Z) Added the developer-guide rule-page metadata table
  contract and ran the work item 2 file-scoped TypeScript and Markdown
  formatters.
- [x] (2026-06-29T13:44Z) Scrutineer reran `make all`, `make markdownlint`,
  and `make nixie` until all three deterministic gates passed for work item 2.
- [x] (2026-06-29T13:44Z) Scrutineer ran `coderabbit review --agent` for work
  item 2. The review was not rate-limited and reported two low-severity test
  hardening findings; both were addressed before rerunning gates.
- [x] (2026-06-29T13:48Z) Completed work item 3 by changing
  `DIAGNOSTIC_REPORT_SCHEMA.properties.diagnostics.items.properties.rule` to a
  catalogue-derived enum, adding the schema parity assertion, and refreshing
  the reviewed schema snapshot.
- [x] (2026-06-29T13:48Z) Confirmed the work item 3 red step:
  `bun test tests/diagnostics/schema.test.ts` failed because `rule.enum` was
  undefined before the production schema imported `RULE_IDS`.
- [x] (2026-06-29T13:48Z) Updated `docs/technical-design.md` section 8 to
  describe the `RULE_IDS` enum and the schema-version policy for future rule
  additions, removals, renames, and meaning or shape changes.
- [x] (2026-06-29T13:48Z) Ran the work item 3 focused snapshot update and
  regression tests: `bun test tests/diagnostics/schema.test.ts -u` and
  `bun test tests/diagnostics/schema.test.ts tests/diagnostics/types.test.ts`.
- [x] (2026-06-29T13:48Z) Scrutineer ran `make all`, `make markdownlint`, and
  `make nixie`; all deterministic gates passed for work item 3 before the
  CodeRabbit review.
- [x] (2026-06-29T13:51Z) Scrutineer ran `coderabbit review --agent` for work
  item 3. The review was not rate-limited and reported no findings.
- [x] (2026-06-29T13:51Z) Completed work item 4 by updating
  `docs/developers-guide.md`, `docs/technical-design.md`, `docs/roadmap.md`,
  and this ExecPlan to record catalogue ownership and roadmap completion.

## Surprises & Discoveries

- Observation: `docs/rules/` does not exist yet.
  Evidence: branch-local `find docs -maxdepth 3 -path '*/rules/*'` returned
  no paths.
  Impact: work item 2 must create the directory, index, per-rule pages, and
  docs parity tests together.

- Observation: the rule list currently appears in a test-local tuple rather
  than production code.
  Evidence: `tests/diagnostics/fixtures.ts` exports `documentedRuleIds`; Leta
  showed no production catalogue symbol under `src/diagnostics/`.
  Impact: work item 1 must move the source of truth into production and keep
  tests derived from it.

- Observation: `tests/diagnostics/architecture.test.ts` is 396 lines,
  `tests/diagnostics/public-api-surface.test.ts` is 390 lines, and
  `tests/diagnostics/import-architecture.ts` is exactly 400 lines.
  Evidence: `wc -l` over the three files, plus Leta showed the final
  architecture test at line 379 pins package-entry specifiers and the exact
  `src/diagnostics` file list.
  Impact: work item 1 must update `architecture.test.ts`, but only by moving
  the pin-list data to a new helper so the edited file stays under the
  400-line convention. Public API expected exports must likewise move to a
  helper before catalogue exports are added. `import-architecture.ts` remains
  untouched.

- Observation: existing invalid workflow fixture manifests already mention
  dialect rule IDs such as `odw/meta-required`,
  `odw/meta-statically-unprovable`, and `odw/body-syntax`.
  Evidence: exact text search in
  `tests/static-analysis/fixtures/invalid-workflows/manifests/`.
  Impact: this task must not change fixture diagnostic contracts; roadmap
  2.1.7 will wire those manifests to the catalogue.

- Observation: the locked TypeScript compiler supports the `satisfies`
  operator.
  Evidence: `node_modules/typescript/lib/typescript.d.ts` declares
  `SatisfiesExpression` and `isSatisfiesExpression`, and
  `node_modules/typescript/lib/typescript.js` parses
  `SatisfiesKeyword`.
  Impact: work item 1 can use `as const satisfies readonly RuleDefinition[]`
  to preserve literal metadata while checking the catalogue shape.

- Observation: the diagnostic schema contract is documented in section 8, not
  only section 9.
  Evidence: `docs/technical-design.md` section 8 defines the JSON example,
  contract invariants, and the rule that `schemaVersion` changes only when JSON
  consumers need compatibility logic.
  Impact: work item 3 must update section 8 in the same commit that changes
  `DIAGNOSTIC_REPORT_SCHEMA.properties.diagnostics.items.properties.rule` from
  a string schema to the catalogue-derived enum.

- Observation: freezing the catalogue array alone does not freeze the rule
  definitions it contains.
  Evidence: CodeRabbit reviewed work item 1 and flagged mutable entry objects
  in `src/diagnostics/rule-catalogue.ts`.
  Impact: `ruleDefinition` now freezes each entry before `RULE_CATALOGUE`,
  `RULE_IDS`, `RELEASED_RULE_IDS`, `PLANNED_RULE_IDS`, or `ruleDocsPath`
  expose derived metadata.

- Observation: `mdtablefix` aligns Markdown table columns, so tests must parse
  table cells rather than matching raw table spacing.
  Evidence: the initial work item 2 green test passed before formatting, then
  failed after `mdtablefix` rewrote `| Field | Value |` as an aligned table
  header.
  Impact: `tests/diagnostics/rule-catalogue-docs.test.ts` now splits table
  rows into cells and still checks the exact metadata field names.

## Decision Log

- Decision: add a production catalogue module
  `src/diagnostics/rule-catalogue.ts` and export it through `src/index.ts`.
  Rationale: roadmap 2.1.6 requires one production source for rule metadata
  before diagnostics broaden. Exporting a read-only catalogue keeps future
  reporters, configuration parsing, and consumers on the same package entry
  rather than importing private files.
  Date/Author: 2026-06-29T10:11Z / Codex.

- Decision: use `configKey: RuleId` and make the value equal to the rule ID.
  Rationale: `docs/technical-design.md` section 10 already models rule
  configuration as a map keyed by rule identifier. A separate key grammar would
  add a second naming surface without a current requirement.
  Date/Author: 2026-06-29T10:11Z / Codex.

- Decision: use `docsSlug` as the rule ID suffix after `odw/`.
  Rationale: this matches the diagnostic-contract example
  `docs/rules/meta-required.md` in `docs/technical-design.md` section 8 and
  keeps documentation paths predictable without a second slug registry.
  Date/Author: 2026-06-29T10:11Z / Codex.

- Decision: release dialect and Claude compatibility rules now, and leave
  orchestration-risk rules planned.
  Rationale: sections 9.1 and 9.2 define the first dialect and compatibility
  surface that phase 2 is about to emit. Section 9.3 explicitly requires
  quality gates for heuristic orchestration rules before release.
  Date/Author: 2026-06-29T10:11Z / Codex.

- Decision: do not add a Markdown parser or rule-doc generator.
  Rationale: no such dependency is locked, the docs metadata shape is small,
  and the project requires avoiding new dependencies unless justified. A strict
  test-only metadata-table parser is sufficient and keeps the behaviour pinned
  by tests.
  Date/Author: 2026-06-29T10:11Z / Codex.

- Decision: use Bun unit, type, and snapshot tests only.
  Rationale: this task changes a pure TypeScript library contract and
  documentation parity. There is no CLI behaviour yet, so behavioural Gherkin
  tests, end-to-end tests, property tests, CrossHair, Hypothesis, and mutmut do
  not apply.
  Date/Author: 2026-06-29T10:11Z / Codex.

- Decision: update the final diagnostic architecture pin in work item 1 and
  extract the pinned list data to
  `tests/diagnostics/architecture-fixtures.ts`.
  Rationale: adding `src/diagnostics/rule-catalogue.ts` and re-exporting it
  from `src/index.ts` otherwise fails the existing architecture test. The test
  file is already 396 lines, so extraction is the scoped way to keep the guard
  current without breaching the 400-line project convention.
  Date/Author: 2026-06-29T13:07Z / Codex.

- Decision: work item 1's direct Biome formatter command must include every
  TypeScript file it edits, including
  `tests/diagnostics/rule-id.test.ts`,
  `tests/diagnostics/architecture.test.ts`, and any new test helpers.
  Rationale: the roadmap workflow requires file-scoped formatting for changed
  files, and the previous plan omitted one changed test file.
  Date/Author: 2026-06-29T13:07Z / Codex.

- Decision: work item 3 updates `docs/technical-design.md` section 8 in the
  same commit as the schema enum.
  Rationale: section 8 owns the diagnostic JSON contract and `schemaVersion`
  compatibility rule. The contract must state that future catalogue additions
  expand the enum without a schema-version bump when the diagnostic object
  shape and existing rule meanings stay compatible; renames, removals, field
  changes, or meaning changes require schema-version review and compatibility
  handling.
  Date/Author: 2026-06-29T13:07Z / Codex.

- Decision: freeze each rule definition object at construction time.
  Rationale: `RULE_CATALOGUE` is a public read-only contract. Runtime freezing
  the array without freezing entries would still allow object mutation and
  could make derived lists or docs paths disagree with the catalogue.
  Date/Author: 2026-06-29T13:31Z / Codex.

- Decision: make the rule-doc parity test derive expected page paths from
  `docsSlug`, not `ruleDocsPath`.
  Rationale: `ruleDocsPath` is the production helper under test elsewhere. The
  docs parity test needs an independent path expectation so it can catch a
  helper/catalogue drift instead of repeating the same implementation.
  Date/Author: 2026-06-29T13:44Z / Codex.

- Decision: parse rule-index Markdown links structurally in the parity test.
  Rationale: a raw `toContain` check could pass on commented or malformed
  Markdown. Comparing discovered `*.md` targets with catalogue slugs gives a
  tighter contract without adding a Markdown parser dependency.
  Date/Author: 2026-06-29T13:44Z / Codex.

- Decision: schema-version stays at `1` when adding catalogued rule IDs that
  do not change diagnostic shape or existing rule meanings.
  Rationale: the JSON object structure and existing enum values remain
  compatible for consumers. The schema enum, catalogue, docs, and parity tests
  must still update together, while renames, removals, meaning changes, or
  object-shape changes require schema-version review.
  Date/Author: 2026-06-29T13:48Z / Codex.

## Outcomes & Retrospective

Work item 1 is implemented and ready to commit. The production catalogue now
owns the initial rule metadata and the public package entry exposes the
catalogue types, lists, and docs-path helper. The existing rule-id tests derive
documented identifiers from `RULE_IDS`, the architecture guard includes the new
diagnostic module, and the public API guard tracks the catalogue exports
through an extracted fixture.

The only deviation from the plan was reactive hardening from CodeRabbit:
individual rule definitions are frozen in addition to the exported catalogue
array, and the catalogue test now includes negative compile-time assertions for
invalid category, release-status, and unbranded rule-id assignments. The
deterministic gates `make all`, `make markdownlint`, and `make nixie` passed
after those fixes.

Work item 2 is implemented and ready to commit. The rule documentation
directory now has an index and one page per catalogue slug. Each page starts
with the fixed metadata table, explains the rule, and planned
orchestration-risk pages state that the current checker does not emit them
yet. The developer guide documents the metadata table contract for future
contributors.

The docs parity test deliberately remains test-local and dependency-free. It
parses only the first metadata table and the index links needed for this
contract. CodeRabbit's review tightened the test so it derives page paths
independently from `docsSlug` and compares parsed index link targets instead
of searching for raw link text.

Work item 3 is implemented and awaiting CodeRabbit review. The diagnostic JSON
Schema now constrains `rule` to the same `RULE_IDS` array exported by the
catalogue, and the schema test asserts object identity with that catalogue
list. The snapshot changed only by replacing `rule: { type: "string" }` with
the reviewed enum values. `docs/technical-design.md` section 8 now explains why
future additive rule IDs do not automatically bump `schemaVersion`, and which
rule or shape changes require compatibility review.

CodeRabbit passed work item 3 with no findings. Work item 4 closes the roadmap
task by documenting that the catalogue owns public exports, schema enum parity,
and rule documentation parity. `docs/roadmap.md` now marks task 2.1.6
complete. No open follow-up is needed for this task; roadmap 2.1.7 remains the
separate fixture-diagnostic parity task.

## Context and orientation

The repository is a Bun and TypeScript project. Production source lives under
`src/`, tests live under `tests/`, documentation lives under `docs/`, and the
full repository gate is `make all`. Markdown changes also require
`make markdownlint` and `make nixie`.

The current diagnostic model already has:

- branded rule identifiers in `src/diagnostics/rule-id.ts`;
- severities in `src/diagnostics/severity.ts`;
- diagnostic data shapes in `src/diagnostics/types.ts`;
- JSON report schema in `src/diagnostics/schema.ts`; and
- public package re-exports in `src/index.ts`.

The current source does not have a production rule catalogue. The only complete
rule tuple is `documentedRuleIds` in `tests/diagnostics/fixtures.ts`. The
technical design section 9 lists the intended rule taxonomy, but tests and
future production rules would still be able to drift without task 2.1.6.

The initial catalogue must contain the following entries.

Table 1: Initial rule catalogue rows.

| Rule ID                           | Category               | Default severity | Docs slug                     | Config key                        | Release status |
| --------------------------------- | ---------------------- | ---------------- | ----------------------------- | --------------------------------- | -------------- |
| `odw/meta-required`               | `dialect`              | `error`          | `meta-required`               | `odw/meta-required`               | `released`     |
| `odw/meta-object`                 | `dialect`              | `error`          | `meta-object`                 | `odw/meta-object`                 | `released`     |
| `odw/meta-statically-unprovable`  | `dialect`              | `warning`        | `meta-statically-unprovable`  | `odw/meta-statically-unprovable`  | `released`     |
| `odw/meta-name`                   | `dialect`              | `error`          | `meta-name`                   | `odw/meta-name`                   | `released`     |
| `odw/meta-description`            | `dialect`              | `error`          | `meta-description`            | `odw/meta-description`            | `released`     |
| `odw/no-import-export`            | `dialect`              | `error`          | `no-import-export`            | `odw/no-import-export`            | `released`     |
| `odw/body-syntax`                 | `dialect`              | `error`          | `body-syntax`                 | `odw/body-syntax`                 | `released`     |
| `odw/claude-pure-meta`            | `claude-compatibility` | `warning`        | `claude-pure-meta`            | `odw/claude-pure-meta`            | `released`     |
| `odw/no-date-now`                 | `claude-compatibility` | `warning`        | `no-date-now`                 | `odw/no-date-now`                 | `released`     |
| `odw/no-math-random`              | `claude-compatibility` | `warning`        | `no-math-random`              | `odw/no-math-random`              | `released`     |
| `odw/no-argless-new-date`         | `claude-compatibility` | `warning`        | `no-argless-new-date`         | `odw/no-argless-new-date`         | `released`     |
| `odw/no-odw-only-validate`        | `claude-compatibility` | `info`           | `no-odw-only-validate`        | `odw/no-odw-only-validate`        | `released`     |
| `odw/bounded-loop`                | `orchestration-risk`   | `warning`        | `bounded-loop`                | `odw/bounded-loop`                | `planned`      |
| `odw/bounded-fanout`              | `orchestration-risk`   | `warning`        | `bounded-fanout`              | `odw/bounded-fanout`              | `planned`      |
| `odw/no-promise-race`             | `orchestration-risk`   | `warning`        | `no-promise-race`             | `odw/no-promise-race`             | `planned`      |
| `odw/schema-for-structured-agent` | `orchestration-risk`   | `info`           | `schema-for-structured-agent` | `odw/schema-for-structured-agent` | `planned`      |
| `odw/worktree-isolation-note`     | `orchestration-risk`   | `info`           | `worktree-isolation-note`     | `odw/worktree-isolation-note`     | `planned`      |

## Research and verified dependencies

Use these findings as fixed inputs. Do not replace them with guesses during
implementation.

- GrepAI main-index search:
  `grepai search --workspace 'Projects' --project $(get-project) "typed rule
  catalogue and rule documentation parity checks" --toon --compact --limit 10`
  found roadmap, audit, and technical-design references to this task.
- Branch-local Leta verification showed no production rule catalogue under
  `src/diagnostics/`, while `src/diagnostics/rule-id.ts` provides
  `RuleId`, `parseRuleId`, `isRuleId`, and `makeRuleId`.
- Branch-local Leta verification showed the final test in
  `tests/diagnostics/architecture.test.ts` pins the package-entry module
  specifiers to this list:

  ```plaintext
  ./diagnostics/report
  ./diagnostics/rule-id
  ./diagnostics/schema
  ./diagnostics/severity
  ./diagnostics/text
  ./diagnostics/types
  ./static-analysis
  ```

  It also pins the exact diagnostic files to
  `report.ts rule-id.ts schema.ts severity.ts text.ts types.ts`.
  Work item 1 must update both lists for the new catalogue module.
- GrepAI and Leta found no existing helper dedicated to the final architecture
  pin lists. `tests/diagnostics/import-architecture.ts` owns import parsing,
  not the package-entry fixture data, and is already at the 400-line limit.
- `docs/roadmap.md` task 2.1.6 requires identifiers, categories, default
  severities, docs slugs, and release status to live in one production
  catalogue. Its success condition requires released rule identifiers, default
  severities, configuration keys, and `docs/rules/` pages to be checked
  against the catalogue.
- `docs/technical-design.md` section 8 defines the diagnostic JSON contract
  and currently models `rule` as a stable rule identifier. Section 9 defines
  dialect, Claude compatibility, and orchestration-risk rule categories and
  default severities. Section 10 uses rule identifiers as configuration keys.
- ADR 0001 and `docs/technical-design.md` sections 5, 6.4, 11.3, and 12.1
  forbid production imports of executable ODW runtime helpers.
- `bun.lock` pins `typescript@5.9.3`, `bun-types@1.3.14`,
  `@biomejs/biome@2.5.1`, `oxlint@1.71.0`, and `fast-check@4.8.0`.
- Locked Biome evidence: `bunx @biomejs/biome --version` reports 2.5.1, and
  `bunx @biomejs/biome format --help` shows `biome format [--write] [PATH]...`.
  The official Biome CLI reference at
  <https://biomejs.dev/reference/cli/#biome-format> also documents
  `biome format` as running the formatter on a set of files with positional
  `PATH` arguments. This supports direct file-scoped formatter commands.
- Locked TypeScript evidence:
  `node_modules/typescript/lib/typescript.d.ts` declares
  `SatisfiesExpression`, `createSatisfiesExpression`, and
  `isSatisfiesExpression`; `node_modules/typescript/lib/typescript.js` parses
  `SatisfiesKeyword`. The official TypeScript 4.9 release notes at
  <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator>
  state that `satisfies` validates expression compatibility while preserving
  the most specific inferred type. This supports a literal catalogue with
  `as const satisfies readonly RuleDefinition[]`.
- Locked Bun evidence:
  `node_modules/bun-types/test.d.ts` exports `describe`, `test`, `it`,
  `expect`, and `expectTypeOf` from `bun:test`; it also exposes
  `test.each`, `toEqual`, `toStrictEqual`, `toContain`, `toThrow`, and
  `toMatchSnapshot`. The official Bun test docs at
  <https://bun.com/docs/test/writing-tests> confirm tests use a Jest-like
  `bun:test` API, support `describe`, `test.each`, matchers, snapshots, and
  type assertions checked by `bunx tsc --noEmit`.
- Bun snapshot update evidence:
  `bun test --help` lists `-u, --update-snapshots`. Work item 3 may use this
  flag for the existing schema snapshot after the schema contract intentionally
  changes.
- Locked Node type evidence:
  `node_modules/@types/node/fs.d.ts` declares `readFileSync`, `readdirSync`,
  `statSync`, and `Dirent` overloads. The official Node file-system docs at
  <https://nodejs.org/api/fs.html#fsreadfilesyncpath-options> state that
  `fs.readFileSync(path, options)` returns a string when an encoding is
  specified, and the same file-system docs state that
  `fs.readdirSync(path, { withFileTypes: true })` returns directory entries.
  This is enough for a deterministic docs parity test.
- No locked Markdown parser exists. The plan therefore uses a small
  test-owned parser for one fixed metadata table in each rule page, with tests
  pinning the exact table field names.

## Plan of work

The implementation proceeds in four atomic work items. Each item follows
Red-Green-Refactor where code or test behaviour changes.

### Work item 1: Publish the typed rule catalogue contract

Implement the production source of truth for rule metadata.

Read before editing:
`docs/roadmap.md` task 2.1.6, `docs/technical-design.md` sections 8, 9, 10,
11.1, and 15, ADR 0001, `docs/developers-guide.md` sections
"Static-Analysis Boundary", "Tests", and "Documentation Upkeep", audit
1.2.1 finding 2, and this ExecPlan.

Skills to load:
`execplans`, `grepai`, `leta`, `biome-typescript`,
`en-gb-oxendict-style`, `sem`, and `commit-message`. No Python, Rust,
Hypothesis, CrossHair, or mutmut skill applies.

Tests to add or update:
add `tests/diagnostics/rule-catalogue.test.ts`; update
`tests/diagnostics/rule-id.test.ts` and `tests/diagnostics/fixtures.ts` so
documented rule IDs derive from the catalogue; update the final architecture
pin in `tests/diagnostics/architecture.test.ts` through a new
`tests/diagnostics/architecture-fixtures.ts` helper; update the public export
surface tests through a new `tests/diagnostics/public-api-fixtures.ts` helper.
These are unit and type tests. No behavioural, property, or end-to-end test is
needed because no CLI or broad input range is introduced.

Red step:
create the tests and public export expectations first. Run:

```sh
bun test \
  tests/diagnostics/rule-catalogue.test.ts \
  tests/diagnostics/rule-id.test.ts \
  tests/diagnostics/architecture.test.ts \
  tests/diagnostics/public-api-surface.test.ts
```

Expect failures because `RULE_CATALOGUE`, derived rule lists, the new
architecture pin entries, and public exports do not exist yet.

Green step:
create `src/diagnostics/rule-catalogue.ts` with these exported names:
`RULE_CATEGORIES`, `RuleCategory`, `RULE_RELEASE_STATUSES`,
`RuleReleaseStatus`, `RuleDefinition`, `RULE_CATALOGUE`, `RULE_IDS`,
`RELEASED_RULE_IDS`, `PLANNED_RULE_IDS`, and `ruleDocsPath`.
Export the public names from `src/index.ts`.
Create `tests/diagnostics/architecture-fixtures.ts` with
`EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`,
`EXPECTED_DIAGNOSTIC_MODULE_FILES`, and `EXPECTED_PARSEABLE_SOURCE_FILES`.
Move only the final architecture pin data into that helper and update
`tests/diagnostics/architecture.test.ts` to import and use the constants. The
updated lists must include `./diagnostics/rule-catalogue`,
`rule-catalogue.ts`, and `src/diagnostics/rule-catalogue.ts`.
Update `docs/technical-design.md` section 9 in the same commit so it names the
catalogue as the implementation source of truth for the metadata fields while
the design section remains the taxonomy rationale.

The catalogue must:

- use `makeRuleId` for `id` and `configKey`;
- use `DiagnosticSeverity` for `defaultSeverity`;
- use `as const satisfies readonly RuleDefinition[]`;
- be frozen or otherwise expose read-only arrays;
- include every row in Table 1 in the same order as the technical design; and
- expose only pure data and pure helpers.

Refactor step:
extract small local helpers if tests need duplicate uniqueness checks, but do
not add cross-module abstractions unless another production caller appears.

Validation for this item:

```sh
bunx @biomejs/biome format --write \
  src/diagnostics/rule-catalogue.ts \
  src/index.ts \
  tests/diagnostics/rule-catalogue.test.ts \
  tests/diagnostics/fixtures.ts \
  tests/diagnostics/rule-id.test.ts \
  tests/diagnostics/architecture-fixtures.ts \
  tests/diagnostics/architecture.test.ts \
  tests/diagnostics/public-api-fixtures.ts \
  tests/diagnostics/public-api-surface.test.ts
mdtablefix --in-place docs/technical-design.md docs/execplans/roadmap-2-1-6.md
bunx markdownlint-cli2 --fix docs/technical-design.md docs/execplans/roadmap-2-1-6.md
bun test \
  tests/diagnostics/rule-catalogue.test.ts \
  tests/diagnostics/rule-id.test.ts \
  tests/diagnostics/architecture.test.ts \
  tests/diagnostics/public-api-surface.test.ts
make all
make markdownlint
make nixie
```

The direct formatter paths all exist by the end of this item.

### Work item 2: Add rule documentation pages and parity checks

Create `docs/rules/` and make each rule page checkable against the catalogue.

Read before editing:
`docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
"Formatting", and "User's guide"; `docs/technical-design.md` sections 8, 9,
10, and 15; `docs/developers-guide.md` sections "Tests", "Markdown", and
"Documentation Upkeep"; and this ExecPlan.

Skills to load:
`execplans`, `grepai`, `leta`, `biome-typescript`,
`en-gb-oxendict-style`, `sem`, and `commit-message`.

Tests to add or update:
add `tests/diagnostics/rule-catalogue-docs.test.ts`. This is a unit-style
repository contract test over Markdown files. It must check:

- every catalogue `docsSlug` maps to `docs/rules/<docsSlug>.md`;
- every released rule has a rule page;
- every rule page metadata table has exactly these fields: `Rule ID`,
  `Category`, `Default severity`, `Configuration key`, and `Release status`;
- each metadata value matches the catalogue entry; and
- `docs/rules/index.md` links to every catalogue page.

Do not check fixture diagnostic messages or spans here; roadmap 2.1.7 owns
that parity.

Red step:
add `tests/diagnostics/rule-catalogue-docs.test.ts` first and run:

```sh
bun test tests/diagnostics/rule-catalogue-docs.test.ts
```

Expect failures because `docs/rules/` pages do not exist.

Green step:
create `docs/rules/index.md` and one page per `docsSlug` in Table 1. Each
page starts with this exact metadata shape before prose:

```markdown
# `odw/meta-required`

| Field | Value |
| --- | --- |
| Rule ID | `odw/meta-required` |
| Category | `dialect` |
| Default severity | `error` |
| Configuration key | `odw/meta-required` |
| Release status | `released` |
```

The prose below the table can be short, but it must explain what the rule
means, when it reports, and how a user normally fixes it. Planned
orchestration-risk pages must state that the rule is planned and not yet
emitted by the current checker.

Update `docs/developers-guide.md` with the fixed rule-page metadata table
format in the same item, because future contributors need the contract before
they add or release rules.

Refactor step:
keep the metadata parser local to
`tests/diagnostics/rule-catalogue-docs.test.ts`. Extract only small helpers
such as `readRulePageMetadata` and `rulePagePath`.

Validation for this item:

```sh
bunx @biomejs/biome format --write tests/diagnostics/rule-catalogue-docs.test.ts
mdtablefix --in-place docs/rules/*.md docs/developers-guide.md docs/execplans/roadmap-2-1-6.md
bunx markdownlint-cli2 --fix docs/rules/*.md docs/developers-guide.md docs/execplans/roadmap-2-1-6.md
bun test tests/diagnostics/rule-catalogue-docs.test.ts
make all
make markdownlint
make nixie
```

The `docs/rules/*.md` glob expands only after this item creates the rule page
files.

### Work item 3: Drive diagnostic schema rule IDs from the catalogue

Connect the existing diagnostic JSON Schema contract to the catalogue so JSON
diagnostics cannot drift to uncatalogued rule identifiers.

Read before editing:
`docs/technical-design.md` section 8, `docs/technical-design.md` section 9,
especially the section 8 `schemaVersion` invariant,
`docs/developers-guide.md` sections "Tests" and "Type Checking",
`docs/documentation-style-guide.md` section "Markdown rules", and this
ExecPlan.

Skills to load:
`execplans`, `grepai`, `leta`, `biome-typescript`,
`en-gb-oxendict-style`, `sem`, and `commit-message`.

Tests to add or update:
update `tests/diagnostics/schema.test.ts` to assert
`DIAGNOSTIC_REPORT_SCHEMA.properties.diagnostics.items.properties.rule.enum`
equals `RULE_IDS`. Update the reviewed schema snapshot. Update
`tests/diagnostics/types.test.ts` only if public type assertions need to
include the catalogue types. These are unit, type, and snapshot tests.

Red step:
update the schema test before changing production schema and run:

```sh
bun test tests/diagnostics/schema.test.ts
```

Expect a failure because the current schema has `rule: { type: "string" }`.

Green step:
update `src/diagnostics/schema.ts` so `rule` uses `{ enum: RULE_IDS }`.
Import `RULE_IDS` from `./rule-catalogue`. Keep severity enum derived from
`DIAGNOSTIC_SEVERITIES`.
Update `docs/technical-design.md` section 8 in the same commit so the JSON
contract says `rule` is constrained to the catalogue-derived `RULE_IDS` enum.
The same section must state the future versioning rule: adding a new
catalogued rule ID expands the enum and requires catalogue, schema, docs, and
parity-test updates, but does not by itself change `schemaVersion` when the
diagnostic object shape and existing rule meanings remain compatible. Renaming
or removing a released rule, changing an existing rule's meaning, or changing
the diagnostic object shape requires schema-version review and compatibility
handling. Keep the section 9 catalogue note aligned with this.

Refactor step:
if schema imports become noisy, extract only local schema constants in
`src/diagnostics/schema.ts`. Do not create a JSON Schema builder abstraction.

Snapshot update:
after confirming the focused schema failure is intentional, run:

```sh
bun test tests/diagnostics/schema.test.ts -u
```

Review the changed snapshot before continuing.

Validation for this item:

```sh
bunx @biomejs/biome format --write \
  src/diagnostics/schema.ts \
  tests/diagnostics/schema.test.ts
mdtablefix --in-place docs/technical-design.md docs/execplans/roadmap-2-1-6.md
bunx markdownlint-cli2 --fix docs/technical-design.md docs/execplans/roadmap-2-1-6.md
bun test tests/diagnostics/schema.test.ts tests/diagnostics/types.test.ts
make all
make markdownlint
make nixie
```

All direct formatter paths exist before this item starts and are edited by the
item. `tests/diagnostics/types.test.ts` is run as an existing regression test
but is not formatted unless the item actually edits it. The schema snapshot
file is changed by `bun test -u`; no separate formatter applies to the `.snap`
file, so the focused snapshot test and `make all` validate it.

### Work item 4: Record ownership and close roadmap 2.1.6

Update living project documentation after the catalogue, docs pages, schema,
and parity tests pass.

Read before editing:
`docs/developers-guide.md` section "Documentation Upkeep",
`docs/technical-design.md` sections 8, 9, 10, and 15,
`docs/roadmap.md` task 2.1.6,
`docs/documentation-style-guide.md`, and this ExecPlan.

Skills to load:
`execplans`, `grepai`, `en-gb-oxendict-style`, `sem`, and
`commit-message`. `biome-typescript` is not needed unless code is touched.

Tests to add or update:
no new tests. This item is documentation closure backed by the tests added in
work items 1 through 3.

Steps:

- Update `docs/developers-guide.md` so its rule-catalogue section reflects the
  completed catalogue, docs parity test, schema parity test, and release-status
  policy.
- Update `docs/technical-design.md` sections 8 and 9 so they reflect the
  completed catalogue-derived schema enum, schema-version policy, and rule docs
  parity checks after work items 1 through 3.
- Mark `docs/roadmap.md` task 2.1.6 complete only after `make all`,
  `make markdownlint`, and `make nixie` pass.
- Update this ExecPlan's `Progress`, `Surprises & Discoveries`,
  `Decision Log`, and `Outcomes & Retrospective`.

Validation for this item:

```sh
mdtablefix --in-place \
  docs/developers-guide.md \
  docs/technical-design.md \
  docs/roadmap.md \
  docs/execplans/roadmap-2-1-6.md
bunx markdownlint-cli2 --fix \
  docs/developers-guide.md \
  docs/technical-design.md \
  docs/roadmap.md \
  docs/execplans/roadmap-2-1-6.md
make all
make markdownlint
make nixie
```

All direct Markdown paths exist before this item starts.

## Concrete steps

All commands run from:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-6
```

Before any implementation work item, verify the branch and worktree:

```sh
git status --short --branch
get-project
```

Expected branch output includes:

```plaintext
## roadmap-2-1-6...origin/main
```

Use GrepAI before searching by intent:

```sh
grepai search --workspace 'Projects' --project "$(get-project)" \
  "typed diagnostic rule catalogue metadata docs parity" \
  --toon --compact --limit 10
```

Use Leta for branch-local symbols:

```sh
leta files src/diagnostics
leta grep "Rule|rule|Diagnostic|Severity" \
  "src/diagnostics|tests/diagnostics" \
  -k function,method,class,interface,type,variable,constant,enum \
  --head 200
```

Use Sem when reviewing the change before each commit:

```sh
sem diff --format json
```

For each work item, follow the work-item-specific Red-Green-Refactor commands
above, then commit only after gates pass.

## Validation and acceptance

The task is complete when these behaviours are true:

- `RULE_CATALOGUE` is the only production source of rule identifiers,
  categories, default severities, docs slugs, configuration keys, and release
  statuses.
- `RULE_IDS`, `RELEASED_RULE_IDS`, and `PLANNED_RULE_IDS` are derived from
  `RULE_CATALOGUE`, not hand-copied.
- Existing rule-id tests derive their valid IDs from `RULE_IDS`.
- The final architecture test pins include `./diagnostics/rule-catalogue`,
  `rule-catalogue.ts`, and `src/diagnostics/rule-catalogue.ts`, with the
  pin-list data extracted so `tests/diagnostics/architecture.test.ts` remains
  under 400 lines.
- `docs/rules/index.md` and every `docs/rules/<docsSlug>.md` page match the
  catalogue metadata.
- The diagnostic JSON Schema `rule` enum derives from `RULE_IDS`.
- `docs/technical-design.md` section 8 states that future rule additions update
  the catalogue-derived enum without a schema-version bump when existing
  diagnostic shape and meanings remain compatible, and states when
  schema-version review is required.
- The existing schema snapshot changes only to reflect the new rule enum.
- Public package export tests pass with catalogue exports included.
- The final documentation names the ownership rule for future contributors.

Required final validation:

```sh
make all
make markdownlint
make nixie
```

Expected result for each command is exit code 0. `make all` runs build,
format-check, lint, typecheck, and tests. `make markdownlint` checks all
Markdown files. `make nixie` validates Mermaid diagrams; this task should not
add Mermaid diagrams, but the repository gate remains required for Markdown
changes.

## Idempotence and recovery

All implementation steps are additive or narrow edits to known files. Re-run
focused Bun tests and repository gates as often as needed.

If a red test fails for a reason other than the missing planned behaviour,
fix the test before changing production code. If a formatter mutates unrelated
files, use the named discard stash pattern in `Constraints`, restore the
intended file set, and re-run only file-scoped formatters.

If a work item partially edits docs pages, it is safe to rerun
`mdtablefix --in-place docs/rules/*.md` after all rule pages exist. If the
shell glob does not expand because the directory was not created, create the
directory and pages before running the formatter; do not run a repo-global
formatter as a workaround.

## Interfaces and dependencies

At the end of work item 1, `src/diagnostics/rule-catalogue.ts` must expose
these interfaces and values through `src/index.ts`:

```typescript
export const RULE_CATEGORIES: readonly ["dialect", "claude-compatibility", "orchestration-risk"];
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_RELEASE_STATUSES: readonly ["planned", "released"];
export type RuleReleaseStatus = (typeof RULE_RELEASE_STATUSES)[number];

export type RuleDefinition = {
  readonly id: RuleId;
  readonly category: RuleCategory;
  readonly defaultSeverity: DiagnosticSeverity;
  readonly configKey: RuleId;
  readonly docsSlug: string;
  readonly releaseStatus: RuleReleaseStatus;
};

export const RULE_CATALOGUE: readonly RuleDefinition[];
export const RULE_IDS: readonly RuleId[];
export const RELEASED_RULE_IDS: readonly RuleId[];
export const PLANNED_RULE_IDS: readonly RuleId[];
export const ruleDocsPath: (rule: RuleDefinition) => `docs/rules/${string}.md`;
```

The exact `ruleDocsPath` return type may be a plain `string` if TypeScript
cannot preserve the template-literal return type cleanly without casts. If that
happens, keep the implementation simple and pin the string format with unit
tests.

No new external dependencies are permitted. The implementation may use:

- `bun:test` from the locked Bun runtime and `bun-types` declarations;
- `node:fs` and `node:path` for docs parity tests;
- existing `RuleId`, `makeRuleId`, and `DiagnosticSeverity` exports; and
- TypeScript `as const satisfies` for catalogue type checking.

## Artifacts and notes

The first implementation commit should not mark roadmap 2.1.6 complete. The
roadmap checkbox changes only in work item 4 after all tests, docs pages,
schema updates, and gates pass.

Do not add a `docs/rules/_template.md` file in this task. A template becomes a
third documentation artefact that must be kept in sync. The parity test and
developer guide are enough to document the metadata table format.

Do not make the rule docs test parse arbitrary Markdown tables. It only needs
to parse the first metadata table immediately after the H1 heading in each
rule page.

## Addenda

- [x] 2.1.6.1. Fail rule-doc parity on orphan rule pages.
  - Source: review:2.1.6; severity low.
  - Scope: enumerate `docs/rules/*.md`, excluding `index.md`, and fail the
    parity test when any page slug is absent from `RULE_CATALOGUE`.
  - Success: removing or renaming a catalogued rule cannot leave stale rule
    documentation behind without a focused rule-doc parity failure.
- [x] 2.1.6.2. Surface the rule reference in user navigation.
  - Source: audit:2.1.6; severity low.
  - Scope: link `docs/rules/index.md` from the first available user-facing
    navigation surface, using the developer guide as the interim surface while
    `docs/contents.md` or a user's guide remain deferred.
  - Success: readers can discover the rule reference from project
    documentation without already knowing the `docs/rules/` path.

## Revision note

Round 1 created `docs/execplans/roadmap-2-1-6.md` for the roadmap-2-1-6
branch. It recorded the researched implementation path, fixed the catalogue
field set and release-status policy, and deferred all implementation until the
plan is approved.

Round 2 revises the plan after design review. Work item 1 now updates the
existing architecture pin test through a small fixture extraction and includes
all changed TypeScript files in its direct Biome formatter command, including
`tests/diagnostics/rule-id.test.ts`. Work item 3 now updates
`docs/technical-design.md` section 8 when it changes the diagnostic schema
rule contract, and it states the future `schemaVersion` policy for catalogue
additions, rule changes, and diagnostic-shape changes. These changes make the
remaining implementation path concrete and gate-passable without starting the
implementation.

Round 3 records the fix for the blocking review findings after implementation.
The docs parity test now pins each rule page metadata table immediately after
the H1 heading, and it parses the rule index table rows so the displayed rule
identifier, category, default severity, and release status must match
`RULE_CATALOGUE`. This enforces the acceptance criterion that `docs/rules/`
metadata stays aligned with the production catalogue.
