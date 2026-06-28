# Post-step audit after roadmap task 1.2.3

- Status: Proposed findings
- Scope: `origin/main` inspected from the `audit-1-2-3` git-donkey worktree

This audit was run after the diagnostic contract split landed on
`origin/main`. It used `grepai` for canonical main-branch intent search,
`leta` for branch-local symbol, reference, and call-graph verification, and
`sem` for entity-level history and blame.

## Finding 1: The diagnostic JSON Schema repeats nested object shapes

- Category: duplication
- Severity: Low
- Location: `src/diagnostics/schema.ts:14`

`DIAGNOSTIC_REPORT_SCHEMA` now lives in its own focused module, but the schema
literal still repeats the same source-position object under both `span.start`
and `span.end`. It also repeats the non-negative integer count shape for every
summary counter.

The current duplication is small. The risk grows with roadmap task 1.2.2,
because source positions become a central invariant for line, column, offset,
snippet, and newline handling. A future schema change could update the start
position but miss the end position, or update one summary counter while leaving
the others behind.

Proposed fix:

- Extract private, narrowly scoped schema constants or builders for:
  - non-negative integer counts;
  - source positions;
  - source spans; and
  - diagnostic suggestions.
- Keep the helpers private to `src/diagnostics/schema.ts` unless another
  module has a concrete need for them.
- Add a schema test that asserts `span.start` and `span.end` share the same
  required keys, type declarations, and numeric minimums.

## Finding 2: Rule identifiers are still test-local rather than catalogued

- Category: inconsistency
- Severity: Medium
- Location: `tests/diagnostics/fixtures.ts:11`, `docs/roadmap.md:149`

The diagnostic split moved the rule-id fixture tuple from the old monolithic
test file into `tests/diagnostics/fixtures.ts`, but branch-local verification
still found no production rule catalogue. Planned rule identifiers are copied
into tests, while the technical design and roadmap describe future rule
categories, default severities, configuration keys, and rule documentation.

That leaves three sources of truth ready to drift as soon as real rules land:
the design taxonomy, the test fixture tuple, and any future rule
implementation. The roadmap already contains task 2.1.6 for a typed rule
catalogue and rule-doc parity checks; this audit confirms that it remains the
right next structural fix before envelope diagnostics broaden.

Proposed fix:

- Implement a production rule catalogue before the first real rule
  implementation.
- Store each rule identifier, category, default severity, documentation slug,
  release status, and configuration key in one module.
- Drive rule-id grammar tests from the catalogue instead of a test-local
  tuple.
- Add parity checks so released catalogue entries have matching `docs/rules/`
  pages before diagnostics can emit documentation links.

## Finding 3: Rule documentation links point at a missing documentation family

- Category: docs-gap
- Severity: Low
- Location: `docs/technical-design.md:297`, `tests/diagnostics/types.test.ts:27`

The diagnostic contract example and representative diagnostic test both use a
`docs/rules/meta-required.md` URL, but the worktree has no `docs/rules/`
directory. No shipped rule currently emits that URL, so this is not a
user-visible broken link yet.

It is still an adoption gap to close before the first rule becomes
user-facing. The diagnostic model has already reserved a documentation field,
and the roadmap expects rule documentation parity once the catalogue exists.

Proposed fix:

- Add a `docs/rules/` index and a short rule-page template with the first rule
  catalogue slice.
- Require every released rule to map to an existing rule page.
- Keep unreleased or placeholder rule identifiers out of user-facing
  diagnostic links until their pages exist.

## Finding 4: The static-analysis trust boundary has no import guard yet

- Category: test-gap
- Severity: Medium
- Location: `tests/static-analysis/boundary.test.ts:13`,
  `docs/technical-design.md:445`

The accepted ADR and technical design state that production code must not
import executable ODW runtime paths such as `loadWorkflowScript`,
`createPrimitives`, runtime `validate(source)`, launcher paths, or worker
paths. The current boundary tests only assert passive exported labels and a
workflow source fixture. Branch-local symbol search found no architecture test
that scans production imports for forbidden ODW runtime paths.

This is not an immediate defect in the current passive scaffold, but it is a
security-boundary test gap. The next dialect tasks will add parser and
envelope code, which is exactly when accidental runtime parity shortcuts become
tempting.

Proposed fix:

- Implement the planned forbidden-import architecture test before production
  static-analysis code starts importing parser or ODW-adjacent helpers.
- Scan `src/**/*.ts` imports structurally where practical, rather than with a
  loose string search.
- Keep trusted loader-parity tests narrowly scoped so they may import ODW
  runtime APIs without permitting those imports in production modules.

## Finding 5: Architecture-test query helpers also assert

- Category: cqs
- Severity: Low
- Location: `tests/diagnostics/architecture.test.ts:114`

`exportedModuleSpecifiers` is named like a pure query helper, but it also makes
`expect` assertions about export declarations while collecting module
specifiers. That mixes a data query with test assertions and makes failures
less direct: callers cannot choose whether they want to inspect specifiers or
validate declaration shape.

The helper is test-only and currently small, so this is not urgent. As the
architecture tests grow to cover rule catalogues, forbidden imports, and
documentation parity, separating query helpers from assertion helpers will keep
test failures easier to understand.

Proposed fix:

- Split the helper into a pure `exportedModuleSpecifiers` query and a separate
  assertion helper for package-entry export declaration shape.
- Return structured parse facts from query helpers, then assert on those facts
  inside the relevant `it` blocks.
- Apply the same pattern to future architecture-test helpers that inspect
  imports, rule catalogue entries, or documentation paths.

## Finding 6: Documentation navigation remains deferred while docs accumulate

- Category: docs-gap
- Severity: Low
- Location: `docs/`, `docs/roadmap.md:392`

The repository now has design documents, an ADR, three execution plans, three
post-step issue audit files, a developer guide, scripting standards,
documentation standards, and the roadmap. The documentation style guide
describes canonical navigation documents, but the worktree still lacks
`docs/contents.md` and `docs/repository-layout.md`.

The roadmap already contains task 4.4.1 for these files, and this audit does
not suggest changing ownership. The growing `docs/issues/` and
`docs/execplans/` trees do make the navigation gap more visible after task
1.2.3.

Proposed fix:

- Keep roadmap task 4.4.1, or pull it forward if future audit and execution
  plan files make handoff more expensive.
- Add `docs/contents.md` that links each document family once and names the
  intended audience.
- Add `docs/repository-layout.md` that maps source, tests, issue audits,
  execution plans, ADRs, and tooling files to their responsibilities.

## Proposed roadmap items

- Pull the typed rule catalogue and rule-documentation parity checks forward
  before the first real lint rule, or keep task 2.1.6 as the blocking point for
  rule implementation.
- Treat the forbidden-import architecture test as a prerequisite for the first
  production parser or envelope-scanner code, not merely as later hardening.
- Consider a small follow-up refactor for diagnostic schema shape helpers and
  architecture-test query/assertion separation before source-span work expands
  those surfaces.
- Keep documentation navigation task 4.4.1 visible as issue audits and
  execution plans continue to accumulate.

## Documentation and skills relied on

- `AGENTS.md`
- `docs/terms-of-reference.md`
- `docs/technical-design.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/developers-guide.md`
- `docs/roadmap.md`
- `docs/documentation-style-guide.md`
- `docs/scripting-standards.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/issues/audit-1.1.1.md`
- `docs/issues/audit-1.2.1.md`
- `grepai` skill
- `leta` skill
- `sem` skill
- `code-review` skill
- `commit-message` skill
