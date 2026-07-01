# Canonicalize diagnostic rule documentation links

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: Complete

Implementation status: All work items are complete and committed.

This is planning round 2. Do not begin implementation until the roadmap
workflow approves this plan.

## Purpose / big picture

Roadmap task 2.1.10 chooses one contract for the `docs` reference attached to
diagnostic rule metadata. The current repository still describes competing
shapes: `docs/technical-design.md` section 8 shows an absolute GitHub URL,
`src/diagnostics/types.ts` calls `Diagnostic.docs` a documentation URL, and
`src/diagnostics/rule-catalogue.ts` already exposes `ruleDocsPath(rule)` as a
repository-relative path such as `docs/rules/meta-required.md`.

After this task, diagnostic metadata has one canonical rule-documentation
reference format: a repository-relative Markdown path under `docs/rules/`. The
observable result is a type, schema, catalogue, fixture and snapshot test set
that fails if code or documentation reintroduces an absolute URL, a filesystem
absolute path, or another emitted docs-link shape.

## Constraints

- Work only in the assigned `roadmap-2-1-10` git-donkey worktree for this
  repository.
- Do not edit any root or control checkout of the repository; implementation
  edits belong only in the assigned roadmap worktree.
- Treat `origin/main` as the canonical integration branch.
- Before implementation, run `git fetch origin main` and rebase or merge the
  task branch onto `origin/main`. Re-run the branch-local verification in this
  plan after that refresh. A stale branch is a plan defect, not an
  implementation tolerance.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' \
    "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact inside
  this worktree with `leta`, exact text search, or file inspection before
  editing.
- Use `leta` for branch-local symbol navigation when it works. If Leta fails,
  record the exact command and failure in `Surprises & Discoveries`, then use
  bounded branch-local file inspection for the named files.
- Use `sem` instead of raw Git history commands for entity-level diffs, blame,
  history or change-impact navigation.
- Keep the task to diagnostic rule-documentation reference shape. Do not
  implement CLI reporters, file discovery, configuration, parser-backed rules,
  ODW loader parity, fixture refresh behaviour, or hosted documentation URL
  generation.
- The canonical diagnostic documentation reference is the
  repository-relative Markdown path returned by `ruleDocsPath(rule)`, matching
  `docs/rules/<docsSlug>.md`. Absolute hosted URLs are out of scope for the
  diagnostic object. Future hosted layers may convert this path to a URL at
  display time.
- `src/diagnostics/rule-catalogue.ts` remains the production source of truth
  for rule identifiers, categories, default severities, configuration keys,
  documentation slugs, messages and release status.
- Production code must stay inert and must not import executable ODW runtime
  paths. ADR
  [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  forbids imports that evaluate metadata, compile workflow bodies, start runs,
  dispatch agents, or call runtime `validate(source)`.
- Do not add a dependency. The locked repository already provides Bun,
  TypeScript, Biome, Oxlint, Fast-check and Node compatibility types.
- Every source module starts with a `/** @file ... */` block. Public and
  private declarations need useful JSDoc because Oxlint loads the local
  `df12-lints` plugin.
- Use Red-Green-Refactor for code changes. Tests that specify the new contract
  must be added or changed before production code changes.
- Format only files changed in the current work item. Do not run global
  mutating formatters such as `make fmt`, `bun fmt`, `mdformat-all`, or a
  repository-wide Markdown fixer.
- For Markdown changes, run file-scoped formatting on the changed paths, then
  run repository gates `make markdownlint` and `make nixie`.
- If a formatter rewrites unrelated files, park that churn with a named discard
  stash:

  ```sh
  git stash push -m 'df12-stash v1 task=2.1.10 kind=discard reason="formatter churn"'
  ```

- Each implementation work item below is independently committable. Run its
  focused red check, focused green check, file-scoped formatter commands,
  `make all`, `make markdownlint`, and `make nixie` before committing that item.
- Run `make branch-freshness` only after the implementation commits are ready
  and the worktree is clean. The target intentionally fails on dirty roadmap
  task worktrees.
- Use the `commit-message` skill and `git commit -F <message-file>` for each
  implementation commit. Do not use `git commit -m`.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs more than three production
  TypeScript files, six test TypeScript files, or four edited documentation
  files. The documentation budget covers this ExecPlan,
  `docs/technical-design.md`, `docs/developers-guide.md`, and the final
  `docs/roadmap.md` closure. Other source-of-truth documents named in this plan
  are read-only signposts unless a new decision requires an explicit tolerance
  update.
- Public API: stop and escalate if an existing public export from `odw-lint`
  must be renamed, removed, or moved to a package subpath. Adding a readonly
  exported type alias for the canonical documentation path is in scope because
  the package is private and the field shape is being tightened before reporter
  exposure.
- Dependencies: stop and escalate before adding any package dependency,
  invoking an unpinned external code generator, or adding a JSON Schema
  validator.
- Schema version: stop and escalate if the JSON diagnostic object shape must
  change beyond constraining `docs` from an unconstrained optional string to
  the existing repository-relative optional path field. This plan assumes no
  `schemaVersion` bump is required because the field remains optional and
  string-valued.
- Documentation shape: stop and escalate if the task requires committing
  absolute host-specific URLs or root-specific filesystem paths to diagnostic
  output.
- Fixture scope: stop and escalate if parity needs to execute fixture source,
  import raw JavaScript workflow fixtures, or add literal `docs` paths to every
  invalid fixture manifest entry.
- Tests: if `make all` still fails after three focused fix attempts in one work
  item, record the failing command and options in `Decision Log` before
  continuing.
- Time: stop and escalate if one implementation work item takes more than four
  hours of focused implementation after dependencies are installed.

## Risks

- Risk: tightening `Diagnostic.docs` from `string` to a template-literal type
  breaks an unintended consumer. Severity: medium. Likelihood: low. Mitigation:
  the package is private, `tests/diagnostics/public-api-surface.test.ts` pins
  the export surface, and this change happens before CLI reporters expose the
  field.
- Risk: JSON Schema pattern checks drift from `ruleDocsPath(rule)`. Severity:
  medium. Likelihood: medium. Mitigation: add schema tests that pin the docs
  pattern and fixture tests that derive expected paths from `RULE_CATALOGUE`
  through `ruleDocsPath(rule)`.
- Risk: fixture manifests duplicate docs paths and become a second catalogue.
  Severity: medium. Likelihood: medium. Mitigation: change the
  `diagnostic(...)` input type to omit both `rule` and derived `docs`, then
  make the builder derive `docs` from the production catalogue.
- Risk: reviewers interpret repository-relative paths as user-facing hosted
  links. Severity: low. Likelihood: medium. Mitigation: update the diagnostic
  design text to say reporters or hosted documentation layers may convert paths
  to URLs later, while diagnostic objects carry repository-relative paths.
- Risk: Markdown tooling churn touches unrelated files. Severity: low.
  Likelihood: medium. Mitigation: run `mdtablefix` and
  `markdownlint-cli2 --fix` only on paths edited by the current work item, then
  use `make markdownlint` as the repository-wide validation gate.

## Progress

- [x] (2026-07-01T15:54Z) Planning round 1 wrote the initial ExecPlan.
- [x] (2026-07-01T16:42Z) Planning round 2 loaded the `execplans`,
  `grepai`, `firecrawl-mcp`, `biome-typescript`, `en-gb-oxendict-style`, and
  `commit-message` skills.
- [x] (2026-07-01T16:43Z) Refreshed the branch with
  `git fetch origin main && git rebase origin/main`;
  `git status --short --branch` then reported `## roadmap-2-1-10...origin/main`.
- [x] (2026-07-01T16:44Z) Re-ran
      `sem diff --from origin/main --to HEAD --format json`; it reported
      `No changes detected.`
- [x] (2026-07-01T16:45Z) Used
      `sem diff --from origin/main~1 --to origin/main --format json` to verify
      the current upstream addendum: 2.1.7.1
      is now complete, and representative diagnostic examples use
      catalogue-backed messages and `ruleDocsPath(rule)`.
- [x] (2026-07-01T16:46Z) Re-ran GrepAI intent searches for diagnostic docs
  field, repository-relative rule path, schema and fixture parity.
- [x] (2026-07-01T16:47Z) Re-ran Leta branch-local symbol checks for
  `ruleDocsPath`, `InvalidWorkflowFixtureDiagnostic`, `Diagnostic`, and fixture
  diagnostics, then inspected exact files where symbols were ambiguous.
- [x] (2026-07-01T16:48Z) Verified the focused baseline test command shown in
  `Artifacts and Notes`; it passed with 28 tests and 2 snapshots.
- [x] (2026-07-01T16:49Z) Verified external and locked tooling facts for
  TypeScript template-literal types, Bun test filtering, snapshots,
  `expectTypeOf`, Biome file arguments, `mdtablefix`, `markdownlint-cli2`, and
  locked package versions.
- [x] (2026-07-01T16:50Z) Revised this ExecPlan for planning round 2.
- [ ] Implementation approved by the roadmap workflow.
- [x] (2026-07-01T16:22Z) Work item 1 red tests failed for the expected
  reasons: the schema still lacked the `docs` path pattern, report snapshots
  did not yet include `docs/rules/meta-required.md`, and the public package
  entry did not export `RuleDocumentationPath`.
- [x] (2026-07-01T16:22Z) Work item 1 focused green checks passed after adding
  `RuleDocumentationPath`, constraining `Diagnostic.docs`, updating the JSON
  Schema pattern, refreshing reviewed snapshots, and updating the diagnostic
  contract docs.
- [x] (2026-07-01T16:22Z) Work item 1 deterministic gates passed through
  `scrutineer`: `make all`, `make markdownlint`, and `make nixie`.
- [x] (2026-07-01T18:54Z) Work item 1 final review evidence rerun in this
      worktree:
  `make all`, `make markdownlint`, and `make nixie` all exited 0.
- [x] (2026-07-01T16:22Z) CodeRabbit reported one major concern about
  host-specific absolute paths in this ExecPlan; the plan now uses assigned
  worktree placeholders and root/control checkout wording instead.
- [x] (2026-07-01T16:22Z) CodeRabbit reported minor ExecPlan consistency
  concerns about the top-level status, documentation-file tolerance, and
  docs-path guidance. The status now reflects completed work-item 1 gates and
  review, the tolerance names the actual editable documentation files, and the
  path guidance distinguishes the TypeScript prefix/suffix type from the
  stricter dash-slug JSON Schema pattern.
- [x] (2026-07-01T18:17Z) After a CodeRabbit rate limit and the required
  `vsleep` backoff, the retried CodeRabbit review completed successfully with
  no findings.
- [x] (2026-07-01T18:17Z) Work item 1 complete and committed.
- [x] (2026-07-01T18:20Z) Work item 2 red tests failed for the expected
  reasons: fixture diagnostics initially had `docs: undefined`, manifest
  callers were still typed as if they needed to pass `docs`, and the compact
  manifest snapshot lacked documentation paths.
- [x] (2026-07-01T18:20Z) Work item 2 focused green checks passed after the
  invalid fixture `diagnostic(...)` builder started deriving `docs` from
  `RULE_CATALOGUE` through `ruleDocsPath(rule)`, the parity test asserted exact
  equality, the builder-input type test proved callers cannot pass `docs`, and
  the compact manifest snapshot was refreshed.
- [x] (2026-07-01T18:20Z) `make all` then exposed that the envelope scanner's
  unsupported import/export diagnostics still omitted `docs`, while fixture
  expectations now included it. The scanner's diagnostic builders now derive
  docs paths from the catalogue, and the envelope fixture test compares that
  field.
- [x] (2026-07-01T18:27Z) Work item 2 deterministic gates passed through
  `scrutineer`: `make all`, `make markdownlint`, and `make nixie`.
- [x] (2026-07-01T18:27Z) Work item 2 CodeRabbit review completed with zero
  findings and no rate-limit or deferred-review condition.
- [x] (2026-07-01T18:27Z) Work item 2 complete and committed.
- [x] (2026-07-01T18:29Z) Work item 3 focused closure checks passed:
  diagnostic type, schema, report, public consumer, public API surface, and
  invalid fixture tests all passed, followed by `bun run check:types`.
- [x] (2026-07-01T18:29Z) Marked `docs/roadmap.md` task 2.1.10 complete after
  work items 1 and 2 had passed gates and CodeRabbit review.
- [x] (2026-07-01T18:29Z) Work item 3 closure gates passed locally because
  `scrutineer` was temporarily unavailable due to its fixed Codex Spark quota:
  `make all`, `make markdownlint`, and `make nixie` all exited 0.
- [x] (2026-07-01T18:29Z) Work item 3 CodeRabbit review was run directly from
  the assigned worktree because `scrutineer` remained quota-blocked; it
  completed with zero findings.
- [x] (2026-07-01T18:29Z) Work item 3 complete and committed.
- [ ] Final clean-worktree review gates, including `make branch-freshness`,
  complete.

## Surprises & Discoveries

- Observation: the original planning branch was stale, exactly matching the
  design-review concern. Evidence: before refresh,
  `git status --short --branch` reported
  `## roadmap-2-1-10...origin/main [behind 1]`. After
  `git fetch origin main && git rebase origin/main`, it reported
  `## roadmap-2-1-10...origin/main`, and
  `sem diff --from origin/main --to HEAD --format json` reported no changes.
  Impact: this plan is now based on the current `origin/main`.
- Observation: current `origin/main` includes the 2.1.7.1 closure that was
  missing from planning round 1. Evidence:
  `sem diff --from origin/main~1 --to origin/main --format json` shows
  `docs/roadmap.md` marking 2.1.7.1 complete and representative diagnostic
  tests deriving messages and docs paths from the catalogue. Impact: work item
  1 must preserve those catalogue-backed examples while tightening the remaining
  `docs` type and schema contract.
- Observation: the remaining competing contract is live in design prose and in
  the public diagnostic type. Evidence: `docs/technical-design.md` section 8
  still shows
  `"docs": "https://github.com/leynos/odw-lint/docs/rules/meta-required.md"`,
  while `src/diagnostics/types.ts` describes `Diagnostic.docs` as an optional
  documentation URL. In contrast, `ruleDocsPath(rule)` returns
  `docs/rules/<slug>.md`. Impact: the implementation must update TypeScript
  types, JSON Schema, representative tests, snapshots and design prose together.
- Observation: the current invalid fixture parity test checks that the rule
  page exists but does not store or assert `diagnostic.docs`. Evidence:
  `tests/static-analysis/invalid-workflow-fixtures.test.ts` asserts
  `existsSync(ruleDocsPath(rule))`, and the compact snapshot omits docs.
  Impact: work item 2 must add a catalogue-derived `docs` field to fixture
  diagnostics and assert exact equality to `ruleDocsPath(rule)`.
- Observation: `leta show diagnostic` failed with
  `Error: EOF while parsing a value at line 1 column 0` because the symbol name
  is ambiguous, but Leta successfully found `InvalidWorkflowFixtureDiagnostic`,
  `ruleDocsPath`, and references. Impact: exact file inspection is acceptable
  for the ambiguous `diagnostic(...)` builder after recording this failure.
- Observation: CodeRabbit treats host-specific absolute paths in committed
  ExecPlans as a major portability concern. Impact: this ExecPlan now describes
  the assigned worktree and root/control checkout boundary without embedding
  workstation-specific filesystem paths.
- Observation: CodeRabbit rate-limited the third work-item 1 review attempt
  before analysing files and reported an 8-minute included-review wait. Impact:
  the workflow still required the configured random 45-90 minute backoff; the
  retried review completed with no findings.
- Observation: adding `docs` to invalid fixture expectations surfaced a
  production parity gap in `scanWorkflowEnvelope`: unsupported import/export
  diagnostics did not yet carry the catalogue-derived docs path. Impact: work
  item 2 needed one narrow production update in
  `src/static-analysis/workflow-envelope.ts` and a fixture comparison update in
  `tests/static-analysis/workflow-envelope-fixtures.test.ts` so emitted and
  expected diagnostics remain aligned.
- Observation: a final work-item 2 pre-commit attempt to use `scrutineer`
  failed because the fixed Codex Spark quota was exhausted until later in the
  evening. Impact: the same deterministic gates and the work-item 3 CodeRabbit
  command were run directly from the assigned worktree, and this deviation is
  recorded here rather than treating the quota failure as a code blocker.

## Decision Log

- Decision: canonical diagnostic rule documentation references are
  repository-relative Markdown paths under `docs/rules/`, not absolute GitHub
  URLs. Rationale: `ruleDocsPath(rule)` already returns repository-relative
  paths, fixture parity can derive the path from the catalogue without
  host-specific state, and hosted URL conversion can happen later in
  display/reporting layers. Date/Author: 2026-07-01T15:54Z, planning agent.
- Decision: keep `DIAGNOSTIC_SCHEMA_VERSION` at `1` unless implementation
  discovers an already-emitted report contract that consumers depend on.
  Rationale: the field remains optional and string-valued; the change narrows
  the documented and tested format before a CLI reporter exposes it.
  Date/Author: 2026-07-01T15:54Z, planning agent.
- Decision: do not add a production lookup helper from rule ID to rule
  definition in this task. Rationale: production code can use
  `ruleDocsPath(rule)` when it has a catalogue entry, and fixture metadata can
  use a test-local lookup without adding a premature public helper.
  Date/Author: 2026-07-01T15:54Z, planning agent.
- Decision: work item 2 must change the `diagnostic(...)` input type to omit
  both `rule` and derived `docs`, then re-add `rule` as an unbranded string.
  Rationale: if `InvalidWorkflowFixtureDiagnostic` gains required `docs` while
  the input remains `Omit<InvalidWorkflowFixtureDiagnostic, "rule">`, every
  manifest caller would have to pass a literal docs path, contradicting the
  catalogue-derived source-of-truth design. Date/Author: 2026-07-01T16:50Z,
  planning agent.

## Outcomes & Retrospective

Work item 1 canonicalized production diagnostic documentation references. The
package now exports `RuleDocumentationPath`, `Diagnostic.docs` uses that type,
`DIAGNOSTIC_REPORT_SCHEMA` constrains emitted `docs` values to
`docs/rules/<dash-slug>.md`, and representative diagnostics plus reviewed
snapshots carry `docs/rules/meta-required.md`.

Focused diagnostic tests and `bun run check:types` passed before repository
gates. `scrutineer` then reported `make all`, `make markdownlint`, and
`make nixie` green. Final review rerun in this worktree also reported
`make all` (386 tests), `make markdownlint` (0 error(s)), and `make nixie` (all
Mermaid diagrams validated successfully). CodeRabbit initially found ExecPlan
portability and consistency issues; after those were fixed and the rate-limit
backoff elapsed, the final CodeRabbit review completed with no findings.

Work item 2 added catalogue-derived documentation paths to invalid workflow
fixture diagnostics without making individual manifest entries a second source
of truth. The shared `diagnostic(...)` builder now brands the input rule,
locates the matching catalogue rule, and freezes `docs: ruleDocsPath(rule)` in
the resulting expected diagnostic. Fixture parity tests assert exact docs-path
equality and the compact manifest snapshot now includes the derived paths. The
full gate exposed that live envelope diagnostics also needed the same field, so
the envelope scanner now derives `docs` for its missing-metadata and
unsupported import/export diagnostics from the rule catalogue. After the
scanner parity fix, `scrutineer` reported `make all`, `make markdownlint`, and
`make nixie` green. CodeRabbit then completed with zero findings.

Work item 3 closed the roadmap task after the behaviour was pinned by work
items 1 and 2. The closure reran the focused diagnostic and invalid fixture
contract tests, passed type checking, and marked `docs/roadmap.md` task 2.1.10
complete. Because `scrutineer` was temporarily quota-blocked, final closure
gates and the closure CodeRabbit review were run directly from the assigned
worktree. Those commands passed: `make all`, `make markdownlint`, `make nixie`,
and `coderabbit review --agent` all completed successfully, with CodeRabbit
reporting zero findings.

## Context and Orientation

The diagnostic model lives under `src/diagnostics/`. Rule identifiers are
branded in `src/diagnostics/rule-id.ts`, severities live in
`src/diagnostics/severity.ts`, diagnostic data shapes live in
`src/diagnostics/types.ts`, JSON Schema support lives in
`src/diagnostics/schema.ts`, report construction lives in
`src/diagnostics/report.ts`, and text formatting lives in
`src/diagnostics/text.ts`.

The rule catalogue lives in `src/diagnostics/rule-catalogue.ts`. It exports
`RULE_CATALOGUE`, `RULE_IDS`, `RELEASED_RULE_IDS`, `PLANNED_RULE_IDS`,
`RuleDefinition`, and `ruleDocsPath(rule)`. The helper currently returns a
repository-relative Markdown path such as `docs/rules/meta-required.md`.

The package entry point is `src/index.ts`. Its reviewed public export list is
pinned by `tests/diagnostics/public-api-surface.test.ts` and
`tests/diagnostics/public-api-fixtures.ts`. If this task exports a new
`RuleDocumentationPath` type alias, update that public fixture list in the same
work item.

Rule documentation pages live under `docs/rules/`. The rule index is
`docs/rules/index.md`, and every catalogue `docsSlug` maps to one page. The
parity tests in `tests/diagnostics/rule-catalogue-docs.test.ts` already prove
that rule pages, metadata tables, index links and orphan-page checks match the
catalogue.

Deliberately invalid workflow fixture expectations live under
`tests/static-analysis/fixtures/invalid-workflows/`. Shared manifest
types/builders live in
`tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts`. These
fixtures are expected diagnostic metadata, but the raw `.js` files must never
be executed or imported.

The exact competing strings found during planning are:

- absolute URL shape:
  `https://github.com/leynos/odw-lint/docs/rules/meta-required.md`;
- canonical repository-relative shape: `docs/rules/meta-required.md`.

Use the second shape everywhere diagnostic metadata is stored or tested.

## Interfaces and Dependencies

Use the existing TypeScript and Bun toolchain. Do not add dependencies.

Locked local dependency evidence from `bun.lock` and local commands:

- `bun --version` reported `1.3.11`.
- `bunx tsc --version` reported `Version 5.9.3`.
- `bunx @biomejs/biome --version` reported `Version: 2.5.1`.
- `bun.lock` pins `@biomejs/biome@2.5.1`, `bun-types@1.3.14`,
  `df12-lints` at commit `08ca59b`, `fast-check@4.8.0`, `oxlint@1.71.0`, and
  `typescript@5.9.3`.
- `node_modules/bun-types/vendor/expect-type/index.d.ts` declares
  `expectTypeOf(...).toEqualTypeOf(...)` and
  `expectTypeOf(...).not.toHaveProperty(...)`.

Official documentation verified with Firecrawl in planning round 2:

- TypeScript's template-literal type documentation says template literal types
  are used in type positions and can constrain string forms by concatenating
  literal components.
- Bun's test runner documentation says `bun test` accepts positional file
  filters, exits non-zero when a test fails, supports snapshots, and updates
  snapshots with `--update-snapshots`.
- Bun's writing-tests documentation says `expectTypeOf` type assertions must
  be checked with `bunx tsc --noEmit`.
- Biome's CLI reference says `biome format` accepts file paths and `--write`
  writes formatted files.

Local tool evidence:

- `mdtablefix --version` reported `mdtablefix 0.4.0`, and `mdtablefix --help`
  documents `mdtablefix [OPTIONS] [FILES]...`, `--in-place`, and `--wrap`.
- `bunx markdownlint-cli2 --help` reported `markdownlint-cli2 v0.20.0` and
  documents `--fix` plus `:`-prefixed literal file paths.

At the end of work item 1, `src/diagnostics/rule-catalogue.ts` should export a
template-literal type for repository-relative rule documentation paths:

```ts
export type RuleDocumentationPath = `docs/rules/${string}.md`;
```

This type pins the emitted `docs/rules/` prefix and `.md` suffix at compile
time. The narrower slug contract is enforced by the JSON Schema pattern below
and by catalogue parity tests: current slugs are lower-case dash-separated
names derived from `RuleId` values. `ruleDocsPath(rule)` should return
`RuleDocumentationPath`, and `Diagnostic.docs` in `src/diagnostics/types.ts`
should be:

```ts
readonly docs?: RuleDocumentationPath;
```

The JSON Schema should keep `docs` optional but constrain emitted diagnostics
to the canonical repository-relative dash-slug path family:

```json
{
  "type": "string",
  "pattern": "^docs/rules/[a-z0-9]+(?:-[a-z0-9]+)*\\.md$"
}
```

The pattern deliberately matches current rule slugs, which are lower-case
dash-separated names derived from `RuleId` values. No diagnostic contract in
this task should describe hosted URLs or filesystem-absolute paths as emitted
`docs` values.

## Plan of Work

### Work item 1: Canonicalize the production diagnostic docs field

This work item tightens the production diagnostic data shape, schema and
representative diagnostic tests so `docs` means one repository-relative rule
documentation path. It implements:

- `docs/roadmap.md` task 2.1.10, especially "diagnostic metadata exposes one
  tested rule-documentation reference format";
- `docs/terms-of-reference.md` sections 6 and 8, because diagnostics need
  stable machine-readable fields for humans, CI and future editor tooling;
- `docs/technical-design.md` section 8, because it defines the diagnostic JSON
  contract and currently contains the competing URL example;
- `docs/technical-design.md` section 9, because it makes the catalogue the
  source of rule metadata and documentation slugs;
- `docs/developers-guide.md` sections "Tests", "Workflow Fixture Corpus" and
  "Documentation Upkeep";
- ADR
  [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md),
  because the catalogue and diagnostic contracts must stay inert.

Skills to load before editing: `execplans`, `grepai`, `leta`, `sem`,
`biome-typescript`, `en-gb-oxendict-style`, and `commit-message`. No Python or
Rust router skill is required. Hypothesis, CrossHair and mutmut are not
applicable because this is TypeScript work.

Red step: update tests before production code:

- In `tests/diagnostics/types.test.ts`, import `RuleDocumentationPath`,
  `RULE_CATALOGUE`, and `ruleDocsPath`. Keep the representative diagnostic
  catalogue-backed, assert its `docs` value is `docs/rules/meta-required.md`,
  update the `Diagnostic` type expectation to
  `readonly docs?: RuleDocumentationPath`, and add a `@ts-expect-error`
  assignment showing that the old absolute GitHub URL is not a
  `RuleDocumentationPath`.
- In `tests/diagnostics/schema.test.ts`, assert that
  `diagnosticItemSchema.properties.docs` equals the pattern object shown in
  `Interfaces and Dependencies`.
- In `tests/diagnostics/report.test.ts` and
  `tests/diagnostics/fixtures.ts`, make the shared representative diagnostic
  fixture include `docs: ruleDocsPath(RULE_CATALOGUE[0] as RuleDefinition)`, so
  report snapshots exercise the canonical field.
- In `tests/diagnostics/public-consumer.test.ts`, update the public consumer
  type expectation so `Diagnostic.docs` is `RuleDocumentationPath`.
- In `tests/diagnostics/public-api-fixtures.ts`, add
  `RuleDocumentationPath` to the reviewed export list.

Run the red commands from the repository root and expect failures for the
missing exported type, the old schema shape, stale snapshots, and the typecheck
assertion:

```sh
bun test ./tests/diagnostics/types.test.ts \
  ./tests/diagnostics/schema.test.ts \
  ./tests/diagnostics/report.test.ts \
  ./tests/diagnostics/public-consumer.test.ts \
  ./tests/diagnostics/public-api-surface.test.ts
bun run check:types
```

Green step: make the smallest production and documentation changes:

- In `src/diagnostics/rule-catalogue.ts`, add
  `RuleDocumentationPath` and make `ruleDocsPath(rule)` return it.
- In `src/diagnostics/types.ts`, import the type and change the `docs` JSDoc
  from "documentation URL" to "repository-relative documentation path".
- In `src/diagnostics/schema.ts`, replace the unconstrained
  `docs: stringSchema` entry with the pattern object from
  `Interfaces and Dependencies`.
- In `src/index.ts`, re-export `type RuleDocumentationPath` from the catalogue
  module.
- In `docs/technical-design.md`, change the JSON example and invariant prose
  in section 8 from the absolute GitHub URL shape to
  `docs/rules/meta-required.md`, and state that hosted URL conversion belongs
  to reporter or documentation presentation layers.
- In `docs/developers-guide.md`, clarify that fixture and diagnostic contracts
  use catalogue-derived repository-relative documentation paths.

Then run the focused green commands:

```sh
bun test ./tests/diagnostics/types.test.ts \
  ./tests/diagnostics/schema.test.ts \
  ./tests/diagnostics/report.test.ts \
  ./tests/diagnostics/public-consumer.test.ts \
  ./tests/diagnostics/public-api-surface.test.ts
bun run check:types
```

If only reviewed snapshots fail, update the affected snapshots with:

```sh
bun test --update-snapshots ./tests/diagnostics/schema.test.ts \
  ./tests/diagnostics/report.test.ts
```

Refactor and formatting:

```sh
bunx @biomejs/biome format --write \
  src/diagnostics/rule-catalogue.ts \
  src/diagnostics/types.ts \
  src/diagnostics/schema.ts \
  src/index.ts \
  tests/diagnostics/types.test.ts \
  tests/diagnostics/schema.test.ts \
  tests/diagnostics/report.test.ts \
  tests/diagnostics/fixtures.ts \
  tests/diagnostics/public-consumer.test.ts \
  tests/diagnostics/public-api-fixtures.ts
mdtablefix --in-place --wrap \
  docs/technical-design.md \
  docs/developers-guide.md \
  docs/execplans/roadmap-2-1-10.md
bunx markdownlint-cli2 --fix \
  :docs/technical-design.md \
  :docs/developers-guide.md \
  :docs/execplans/roadmap-2-1-10.md
make all
make markdownlint
make nixie
```

Commit this work item only after all commands pass.

### Work item 2: Add catalogue-derived docs paths to invalid fixture diagnostics

This work item makes deliberately invalid fixture diagnostic expectations carry
the same canonical documentation path as production diagnostics, without
duplicating literal paths in every manifest entry. It implements:

- `docs/roadmap.md` task 2.1.10 success criteria, because fixture diagnostic
  metadata becomes a tested carrier for the one docs format;
- `docs/developers-guide.md` "Workflow Fixture Corpus", because it says
  fixture expectations are checked against the catalogue for documentation path
  parity;
- `docs/technical-design.md` sections 8 and 9, because the diagnostic object
  and rule catalogue remain aligned.

Skills to load before editing: `execplans`, `grepai`, `leta`, `sem`,
`biome-typescript`, `en-gb-oxendict-style`, and `commit-message`.

Red step: update tests and fixture types first:

- In
  `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts`, add
  `readonly docs: RuleDocumentationPath` to `InvalidWorkflowFixtureDiagnostic`.
- In `tests/static-analysis/invalid-workflow-fixtures.test.ts`, change
  "matches fixture diagnostics to the rule catalogue" to assert
  `diagnostic.docs === ruleDocsPath(rule)` for every fixture diagnostic.
- In the same test file, update the compact invalid manifest snapshot
  projection to include `docs: diagnostic.docs`, so snapshot review catches
  future shape drift.
- Add a type-level assertion, preferably in
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`, that the
  manifest-builder input type does not expose `docs`:

  ```ts
  expectTypeOf<Parameters<typeof diagnostic>[0]>().not.toHaveProperty("docs");
  ```

  This is the explicit guard that manifest callers cannot preserve literal docs
  paths as fixture source of truth.

Run the red commands and expect type and assertion failures because the builder
does not yet populate `docs` and still exposes the wrong input shape:

```sh
bun test ./tests/static-analysis/invalid-workflow-fixtures.test.ts
bun run check:types
```

Green step:

- In
  `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts`, import
  `RULE_CATALOGUE`, `type RuleDocumentationPath`, `type RuleDefinition`, and
  `ruleDocsPath` from `odw-lint`.
- Introduce a local input type that omits both the branded rule and derived
  docs field:

  ```ts
  type InvalidWorkflowFixtureDiagnosticInput = Omit<
    InvalidWorkflowFixtureDiagnostic,
    "rule" | "docs"
  > & {
    readonly rule: string;
  };
  ```

- Change `diagnostic(...)` to accept
  `InvalidWorkflowFixtureDiagnosticInput`.
- Add a small test-local lookup helper that finds the `RuleDefinition` matching
  the branded diagnostic rule. If no catalogue entry exists, throw an error
  naming the rule. Keep this helper inside the test fixture module; do not add
  a production public helper in this task.
- Make the `diagnostic(...)` builder derive `docs: ruleDocsPath(rule)` after
  branding the rule, so individual manifest files remain focused on source
  spans, severity and message.

Then run:

```sh
bun test ./tests/static-analysis/invalid-workflow-fixtures.test.ts
bun run check:types
```

If only the compact manifest snapshot fails for the intentional new `docs`
field, update it with:

```sh
bun test --update-snapshots ./tests/static-analysis/invalid-workflow-fixtures.test.ts
```

Refactor and formatting:

```sh
bunx @biomejs/biome format --write \
  tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
mdtablefix --in-place --wrap docs/execplans/roadmap-2-1-10.md
bunx markdownlint-cli2 --fix :docs/execplans/roadmap-2-1-10.md
make all
make markdownlint
make nixie
```

Commit this work item only after all commands pass.

### Work item 3: Close the roadmap task and final documentation state

This work item records task completion after the contract and tests are in
place. It implements:

- `docs/roadmap.md` task 2.1.10 closure;
- `docs/documentation-style-guide.md` "Roadmap task writing guidelines",
  because the roadmap must reflect the completed work in a concise,
  GIST-aligned form;
- `docs/developers-guide.md` "Documentation Upkeep", because design and
  roadmap docs must stay aligned when diagnostic contracts change.

Skills to load before editing: `execplans`, `grepai`, `leta`, `sem`,
`en-gb-oxendict-style`, and `commit-message`. `biome-typescript` is not needed
unless this closure discovers a code correction.

Red step: no new failing unit test is required for this documentation-only
closure. The behaviour is already pinned by work items 1 and 2. Before editing
closure docs, rerun the focused tests to prove the behavioural contract is
green:

```sh
bun test ./tests/diagnostics/types.test.ts \
  ./tests/diagnostics/schema.test.ts \
  ./tests/diagnostics/report.test.ts \
  ./tests/diagnostics/public-consumer.test.ts \
  ./tests/diagnostics/public-api-surface.test.ts \
  ./tests/static-analysis/invalid-workflow-fixtures.test.ts
bun run check:types
```

Green step:

- In `docs/roadmap.md`, mark roadmap task 2.1.10 complete only after work
  items 1 and 2 have passed their gates.
- In this ExecPlan, update `Status`, `Implementation status`, `Progress`,
  `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`
  with the exact implementation evidence.

Formatting and gates:

```sh
mdtablefix --in-place --wrap \
  docs/roadmap.md \
  docs/execplans/roadmap-2-1-10.md
bunx markdownlint-cli2 --fix \
  :docs/roadmap.md \
  :docs/execplans/roadmap-2-1-10.md
make all
make markdownlint
make nixie
```

Commit this work item only after all commands pass.

After all implementation commits are ready and `git status --short` shows a
clean worktree, run the final review-only freshness gate:

```sh
make branch-freshness
```

If `make branch-freshness` fails because `origin/main` changed again, rebase or
merge `origin/main`, rerun the branch-local verification and full gates, then
update this ExecPlan before requesting review.

## Concrete Steps

Run all commands from:

```sh
cd <assigned-roadmap-2-1-10-worktree>
```

Before each work item, refresh branch-local orientation:

```sh
git fetch origin main
git status --short --branch
grepai search --workspace 'Projects' --project 'odw-lint' \
  "diagnostic rule documentation path contract" --toon --compact
leta files
sem diff --from origin/main --to HEAD --format json
```

If the branch is behind `origin/main`, rebase or merge before editing. If
`leta files` or later Leta commands fail, copy the exact error into
`Surprises & Discoveries` and use precise branch-local inspection for the named
files in that work item.

For each work item:

1. Update this ExecPlan progress entry for the starting work item.
2. Apply the red test edit first.
3. Run the focused red command and confirm it fails for the expected reason.
4. Apply the smallest production or documentation change.
5. Run the focused green command and update snapshots only when the diff is the
   intentional reviewed contract change.
6. Run the item-specific file-scoped formatters.
7. Run `make all`, `make markdownlint`, and `make nixie`.
8. Review `sem diff --from origin/main --to HEAD --format json` for the
   entity-level change summary and `git status --short` for the exact files
   changed.
9. Commit with the `commit-message` skill and `git commit -F <message-file>`.

Expected focused baseline on the refreshed planning-round-2 branch:

```plaintext
28 pass
0 fail
2 snapshots, 524 expect() calls
```

## Validation and Acceptance

The task is complete when all of these acceptance checks hold:

- `Diagnostic.docs` is typed as the canonical repository-relative
  `RuleDocumentationPath`, not an unconstrained URL string.
- `DIAGNOSTIC_REPORT_SCHEMA` constrains `docs` to
  `docs/rules/<dash-slug>.md`.
- Representative diagnostic test fixtures and report snapshots include
  `docs/rules/meta-required.md`.
- Invalid workflow fixture diagnostic metadata includes a catalogue-derived
  `docs` path and fixture parity asserts it equals `ruleDocsPath(rule)`.
- The `diagnostic(...)` manifest-builder input type omits both `rule` and
  derived `docs`, then accepts an unbranded `rule: string`; type-level tests
  prove callers cannot treat literal docs paths as fixture source of truth.
- `docs/technical-design.md` no longer documents the absolute GitHub URL as
  the emitted diagnostic `docs` shape.
- No code or documentation introduced by this task describes a competing
  emitted URL/path shape.
- `make all`, `make markdownlint`, and `make nixie` pass after the final
  closure work item.
- After all commits are ready and the worktree is clean,
  `make branch-freshness` passes before review.

Test coverage required by `AGENTS.md`:

- Unit tests: update diagnostic type, schema, report, public consumer, public
  API, and fixture parity unit tests named in the work items.
- Snapshot tests: update Bun snapshots for the diagnostic schema, diagnostic
  report, and invalid fixture manifest only after confirming the diffs are the
  intended docs-path contract changes.
- Behavioural tests: none required. There is no CLI reporter surface in this
  task, and the externally observable CLI behaviour has not yet landed.
- Property tests: none required. The path domain is finite and
  catalogue-backed for current rules; exact unit and schema assertions are
  clearer than generated data here.
- End-to-end tests: none required. Reporter exposure and CLI integration are
  later roadmap tasks.

Repository validation commands:

```sh
make all
make markdownlint
make nixie
make branch-freshness
```

`make all` includes build, formatting validation, whitespace hygiene, lint,
type checking, and Bun tests in the current `Makefile`. Run
`make branch-freshness` after commits are ready and the worktree is clean,
because the target performs a network fetch and fails on dirty roadmap task
worktrees.

## Idempotence and Recovery

The planned edits are deterministic. Re-running the focused tests, Biome
formatter, `mdtablefix`, `markdownlint-cli2 --fix`, and repository gates is
safe.

Do not edit generated or copied raw workflow `.js` fixtures. Work item 2
derives docs paths in the TypeScript fixture builder so individual fixture
manifests do not need hand-edited `docs` literals.

If a snapshot command updates more snapshots than named in the current work
item, inspect the diff. Keep only snapshots whose changed fields are the
intentional docs-path contract; revert unrelated snapshot churn before
committing.

If `make branch-freshness` fails after a clean implementation because
`origin/main` changed, rebase or merge `origin/main`, rerun the focused tests,
`make all`, `make markdownlint`, `make nixie`, and `make branch-freshness`,
then update this ExecPlan with the new evidence.

If `make markdownlint` or `make nixie` fails on unrelated pre-existing files,
rerun once to rule out transient tooling failure. If it still fails, record the
exact command and failure in `Surprises & Discoveries`; do not broaden the
implementation patch to unrelated documentation.

## Artifacts and Notes

Planning-round-2 commands and evidence:

```plaintext
git fetch origin main && git rebase origin/main
```

completed successfully and removed the `[behind 1]` branch status.

```plaintext
sem diff --from origin/main --to HEAD --format json
```

reported:

```plaintext
No changes detected.
```

```plaintext
sem diff --from origin/main~1 --to origin/main --format json
```

showed the current upstream 2.1.7.1 closure and representative diagnostic test
updates that derive messages and docs paths from the catalogue.

```plaintext
bun test tests/diagnostics/schema.test.ts tests/diagnostics/types.test.ts
  tests/diagnostics/rule-catalogue.test.ts
  tests/static-analysis/invalid-workflow-fixtures.test.ts
```

passed with:

```plaintext
28 pass
0 fail
2 snapshots, 524 expect() calls
```

## Documentation and Skill Trail

Read these repository documents before implementing:

- `AGENTS.md`
- `docs/terms-of-reference.md` sections 6, 8 and 9
- `docs/technical-design.md` sections 8 and 9
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/developers-guide.md` sections "Commit Gate", "Tests", "Workflow
  Fixture Corpus", "Markdown" and "Documentation Upkeep"
- `docs/scripting-standards.md` sections "Language and runtime",
  "Pathlib: robust path manipulation" and "Operational guidelines" if an
  implementation script is considered
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4 and
  5 for keeping any helper extraction small and justified
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  "Developer's guide", "Design document, ADR, and RFC" and "Roadmap task
  writing guidelines"
- `docs/roadmap.md` task 2.1.10
- `docs/rules/index.md` and one representative rule page, such as
  `docs/rules/meta-required.md`

Load these skills as signposted by the work items:

- `execplans`
- `grepai`
- `firecrawl-mcp` when refreshing external documentation evidence
- `biome-typescript`
- `en-gb-oxendict-style`
- `commit-message`

Use these tools as signposted by the work items:

- `leta` for branch-local symbol navigation
- `sem` for entity-level diffs and history navigation

No Python, Rust, Hypothesis, CrossHair, mutmut, Zod, or protobuf skill is
needed for the planned implementation.

## Revision Note

Planning round 2 refreshed the branch onto current `origin/main`, reran
branch-local verification, incorporated the upstream 2.1.7.1 closure, added the
clean-worktree `make branch-freshness` review gate, and corrected work item 2
so the invalid fixture `diagnostic(...)` builder omits both `rule` and derived
`docs` from its input while deriving docs paths from the rule catalogue.
