# Audit after roadmap task 1.5.1

This post-step audit was run after roadmap task 1.5.1 merged into
`origin/main`. The audit used `grepai` against the canonical `main` index for
intent search, then verified branch-local facts in this worktree with `leta`,
direct file inspection, and `sem` entity history.

Normative references used:

- `AGENTS.md`
- `docs/terms-of-reference.md`
- `docs/technical-design.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/developers-guide.md`
- `docs/scripting-standards.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/contents.md`
- `docs/repository-layout.md`

Skills and tools used:

- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level history for the task 1.5.1 merge and audited helpers.
- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict-style`: Oxford British documentation prose.
- `commit-message`: file-based commit workflow.

## Finding 1: Refresh URL normalization is duplicated

Category: similarity

Severity: low

Location:

- `tests/static-analysis/fixtures/refresh-metadata.ts:94`
- `tests/static-analysis/fixtures/refresh-writers.ts:328`

Description:

The fixture refresh path has two identical `normalizeDirectoryUrl` helpers. One
is exported from `refresh-metadata.ts` for checkout resolution and test
coverage, while `refresh-writers.ts` keeps a private copy for report and
filesystem path resolution. Both clone the URL, clear search and hash
components, and force a trailing slash.

The duplication is small, but it sits on a boundary that controls fixture
refresh safety. A future change to URL treatment, report paths or worktree
checkout resolution can easily update one copy and leave the other stale.

Proposed fix:

Move the helper to the existing refresh-target/path support boundary, for
example `tests/static-analysis/fixtures/refresh-targets.ts`, and import it from
both callers. Keep the public re-export from `refresh-metadata.ts` if tests or
maintainer scripts still need that entry point. Add one focused unit test for
query, fragment and trailing-slash behaviour so the shared helper remains the
single source of truth.

## Finding 2: Refresh failures repeat report object literals

Category: duplication

Severity: medium

Location:

- `tests/static-analysis/fixtures/refresh-writers.ts:111`
- `tests/static-analysis/fixtures/refresh-writers.ts:138`
- `tests/static-analysis/fixtures/refresh-writers.ts:172`

Description:

`refresh-writers.ts` constructs `FixtureRefreshFailure` objects inline for the
same classes of checkout and upstream-example errors. The
`missing-odw-reference-checkout` path repeats the code, nullable metadata
fields and remediation text in three branches. The missing-example branch has
the same object shape with a different code and remediation.

That makes failure reporting awkward to evolve. Adding a field to
`FixtureRefreshFailure`, changing remediation wording or splitting checkout
failure causes will require editing several object literals and keeping their
null placeholders synchronized by hand.

Proposed fix:

Introduce small report constructors, such as
`missingOdwReferenceCheckoutFailure(message, path)` and
`missingUpstreamExampleFailure(fileName, upstreamSource)`. Keep the existing
`invalidArgumentsFailure` helper for argument-shape failures and route all
non-argument refresh failures through the same constructor style. Add table
coverage for the three checkout states and one missing-example state so the
failure code, path and remediation stay stable.

## Finding 3: The diagnostic architecture suite mixes distinct contracts

Category: separation-of-concerns

Severity: medium

Location:

- `tests/diagnostics/architecture.test.ts:1`
- `tests/diagnostics/architecture.test.ts:77`
- `tests/diagnostics/architecture.test.ts:110`
- `tests/diagnostics/architecture.test.ts:258`
- `tests/diagnostics/architecture.test.ts:358`
- `tests/diagnostics/architecture.test.ts:367`

Description:

`architecture.test.ts` is 376 lines and now covers several separate contracts:
public diagnostic imports, public static-analysis imports, package-entry shape,
TypeScript import-edge extraction, forbidden ODW runtime import policy,
production source scanning, diagnostic module inventory and parseability of
selected files. The file remains under the 400-line guard added by task 1.5.1,
but it is close enough that the next architecture rule is likely to force a
split during unrelated work.

The blended scope also makes review harder because package facade assertions,
production import policy and public type-import smoke tests fail from the same
suite even though they represent different maintenance boundaries.

Proposed fix:

Split the suite by contract before adding the next architecture guard. Keep
public package importability in `public-consumer.test.ts` or a dedicated
`package-entry.test.ts`, keep forbidden ODW import policy beside
`odw-import-policy.ts`, and leave `architecture.test.ts` for high-level module
inventory and production boundary assertions. Preserve the existing helper
exports so this can be a no-behaviour-change refactor, then run `make all`,
`make markdownlint` and `make nixie`.

## Finding 4: Fixture metadata refresh coverage is a near-limit omnibus

Category: complexity

Severity: medium

Location:

- `tests/static-analysis/fixture-metadata-refresh.test.ts:1`
- `tests/static-analysis/fixture-metadata-refresh.test.ts:80`
- `tests/static-analysis/fixture-metadata-refresh.test.ts:183`
- `tests/static-analysis/fixture-metadata-refresh.test.ts:212`
- `tests/static-analysis/fixture-metadata-refresh.test.ts:327`
- `tests/static-analysis/fixture-metadata-refresh.test.ts:357`

Description:

`fixture-metadata-refresh.test.ts` is 381 lines and exercises multiple layers
in one file: SHA-256 derivation, anchored span derivation, URL resolution,
dry-run reports, write-mode behaviour, idempotence, upstream allow-list
failures, CLI stdout/stderr contracts and hostile metadata import safety.

The coverage is valuable, but the file is now a broad integration suite rather
than a focused test module. Future fixture refresh work will be pressured by
the 400-line guard and may mix low-level span derivation cases with CLI or
workspace cases to avoid creating new files.

Proposed fix:

Split the coverage into focused suites while retaining the same helper
workspace:

- `fixture-metadata-refresh-derivation.test.ts` for digest, URL and anchored
  span derivation;
- `fixture-metadata-refresh-workspace.test.ts` for dry-run, write-mode,
  idempotence and upstream allow-list behaviour;
- `fixture-metadata-refresh-cli.test.ts` for CLI stdout/stderr contracts; and
- a small hostile-metadata import-safety test near the fixture safety helpers.

This keeps each suite below the size cliff and lets future changes add cases to
the layer they affect.

## Finding 5: User-facing documentation is still absent

Category: docs-gap

Severity: low

Location:

- `docs/documentation-style-guide.md:103`
- `docs/contents.md:1`
- missing `docs/users-guide.md`

Description:

The repository now has a contents page, repository layout, rule reference,
developer guide, technical design, ADR, issue audits and execution plans. The
documentation style guide still identifies a user's guide as part of the
canonical documentation set, but `docs/users-guide.md` is absent.

That gap is acceptable while the project is mostly a private implementation
scaffold, yet the rule catalogue and package-entry guards are already
user-visible contract work. As soon as `odw-lint check` starts behaving as a
CLI, users will need one task-oriented place for command usage, exit codes,
JSON output shape, rule reference navigation and current limitations without
reading maintainer documents.

Proposed fix:

Add a minimal `docs/users-guide.md` before the first executable CLI vertical
slice lands. Keep it intentionally short at first: document the intended
`odw-lint check` command shape, the current diagnostic report contract, links
to `docs/rules/index.md`, configuration placeholders and known non-goals.
Update `docs/contents.md` and `docs/repository-layout.md` when the guide is
created.

## Proposed roadmap items

These are proposals only. Editing `docs/roadmap.md` is reserved to the root
workflow agent.

### Centralize fixture refresh path helpers

Rationale: duplicated URL normalization and repeated refresh failure
construction are small today, but they sit on the fixture refresh safety path.
Centralizing them avoids divergent path and report semantics before more
fixture families or checkout modes are added.

Severity: medium

### Split architecture and fixture refresh test suites

Rationale: `tests/diagnostics/architecture.test.ts` and
`tests/static-analysis/fixture-metadata-refresh.test.ts` are both broad
near-limit suites. Splitting by contract keeps future architecture and fixture
refresh changes below the file-size guard without mixing unrelated assertions.

Severity: medium

### Add the first user's guide

Rationale: top-level documentation navigation now exists, but there is still
no user-facing guide. A minimal guide should land before the first CLI slice so
workflow authors can find command, diagnostic and rule-reference behaviour
without reading maintainer-only design documents.

Severity: low
