# Post-step audit after roadmap task 1.3.1

- Status: Proposed findings
- Scope: `origin/main` inspected from the `df12-audit-1.3.1`
  git-donkey worktree

This audit was run after the ODW example workflow fixture snapshots landed on
`origin/main`. It used `grepai` for canonical main-branch intent search,
`leta` for branch-local symbol, reference, and call-graph verification, and
`sem` for entity-level history and blame.

## Finding 1: The build target ignores `bun.lock`

- Category: ergonomics
- Severity: Medium
- Location: `Makefile:7`

The `node_modules` target depends on `package.json` only:

```make
node_modules: package.json
```

That means a lockfile-only dependency change can leave `make build`,
`make lint`, `make typecheck`, `make test`, and `make all` using stale
installed packages. The repository commits `bun.lock`, and the dependency
policy in `AGENTS.md` treats the lockfile as deliberate state, so the build
gate should consider it part of the dependency input.

Proposed fix:

- Make the dependency-install marker depend on both `package.json` and
  `bun.lock`.
- Prefer a stamp file under `node_modules`, such as
  `node_modules/.bun-install-stamp`, if touching the directory itself proves
  too coarse.
- Keep `make clean` removing the marker together with `node_modules`.

## Finding 2: Fixture paths are repeated instead of derived

- Category: duplication
- Severity: Medium
- Location: `tests/static-analysis/fixtures/odw-examples.ts:17`,
  `tests/static-analysis/fixtures/odw-examples.ts:59`,
  `tests/static-analysis/fixtures/odw-examples.ts:72`

Each ODW example fixture entry repeats `fileName`, `fixturePath`, and
`upstreamPath`, even though both paths are deterministic functions of the file
name and the two fixture roots. The tests verify that `fileName` exists and
that its content matches the recorded SHA-256 digest, but they do not verify
that `fixturePath` or `upstreamPath` still match the file name.

This creates a small drift trap for the future fixture corpus. A copied file
could be checked and hashed correctly while the manifest path shown to source
readers, diagnostics, or drift tooling points at a different logical fixture.

Proposed fix:

- Change `odwExampleFixture` to accept `fileName`, `metaName`, and `sha256`,
  then derive `fixturePath` and `upstreamPath` inside the helper.
- Add a focused test that asserts each derived path is repository-relative and
  ends with the matching file name.
- Keep the public manifest shape unchanged if downstream tests already consume
  those fields.

## Finding 3: Fixture refresh remains manual and under-specified

- Category: docs-gap
- Severity: Medium
- Location: `docs/developers-guide.md:127`,
  `tests/static-analysis/fixtures/odw-examples.ts:72`,
  `tests/static-analysis/odw-example-fixtures.test.ts:58`

The developer guide says to refresh copied ODW example snapshots from the
source-backed sibling checkout identified by `ODW_REFERENCE_CHECKOUT`, and to
update the manifest hashes and no-error expectations. The repository does not
yet provide a command, script, or checklist that performs those steps.

That gap makes the corpus harder to maintain safely. A maintainer must infer
which upstream files to copy, how to preserve byte-for-byte fixture content,
how to recompute the SHA-256 values, and how to keep the exact nine-file
corpus aligned with the tests.

Proposed fix:

- Add a small Bun script or documented Make target that reads
  `ODW_REFERENCE_CHECKOUT`, copies the approved example list, computes hashes,
  and rewrites only `tests/static-analysis/fixtures/odw-examples.ts`.
- Keep the copied `.js` fixtures excluded from formatters and linters.
- Document the refresh command in `docs/developers-guide.md`, including the
  expected validation commands after a refresh.

## Finding 4: The static-analysis trust boundary still lacks an import guard

- Category: test-gap
- Severity: Medium
- Location: `tests/static-analysis/boundary.test.ts:13`,
  `docs/technical-design.md:445`, `docs/adr/0001-static-analysis-boundary.md:43`

The accepted ADR and technical design say production code must not import ODW
runtime helpers that evaluate metadata, compile workflow bodies, start runs,
or dispatch agents. The current boundary tests still only assert passive
static-analysis exports and a `WorkflowSource` fixture. Branch-local symbol
verification found no production-import guard for forbidden ODW runtime paths.

This is not a current production defect because the scaffold remains passive.
It is a release-risk gap for the next phase, where parser, envelope, and
loader-parity work will make runtime shortcut imports tempting.

Proposed fix:

- Implement the planned forbidden-import architecture test before adding
  production envelope or parser code.
- Parse `src/**/*.ts` imports structurally with the TypeScript compiler API or
  an equivalent project-owned helper.
- Permit trusted loader-parity imports only in narrowly scoped tests, never in
  production modules.

## Finding 5: Rule documentation links have no rule-documentation home

- Category: docs-gap
- Severity: Low
- Location: `docs/technical-design.md:278`,
  `tests/diagnostics/types.test.ts:17`, `docs/roadmap.md:149`

The diagnostic contract already models a `docs` field, and the design example
uses a rule-documentation URL under `docs/rules/`. The worktree still has no
`docs/rules/` directory, index, or rule-page template. No shipped rule emits
these links yet, so this is not user-visible today.

The gap should close before the first released rule catalogue entry. Otherwise
diagnostics can grow user-facing documentation links before the target pages
exist, and rule documentation will become another source of truth separate
from the catalogue.

Proposed fix:

- Add `docs/rules/index.md` and a short rule-page template with the typed rule
  catalogue slice.
- Require every released rule to map to an existing rule page.
- Keep placeholder or unreleased rule identifiers out of user-facing
  diagnostic `docs` URLs.

## Finding 6: Documentation navigation remains deferred while docs grow

- Category: docs-gap
- Severity: Low
- Location: `docs/`, `docs/roadmap.md:396`,
  `docs/documentation-style-guide.md:67`

The repository now contains the terms of reference, technical design, ADR,
developer guide, scripting standards, documentation style guide, roadmap,
execution plans, and four post-step issue audits. The documentation style guide
describes canonical navigation documents, but the worktree still lacks
`docs/contents.md` and `docs/repository-layout.md`.

The roadmap already reserves task 4.4.1 for this work. The additional issue
audit and fixture-maintenance documentation from task 1.3.1 make the
navigation gap more visible for future handoffs.

Proposed fix:

- Keep roadmap task 4.4.1 visible, or pull it forward if future audit files
  make handoff more expensive.
- Add `docs/contents.md` that links each document family once and names the
  intended audience.
- Add `docs/repository-layout.md` that maps source, tests, issue audits,
  execution plans, ADRs, and tooling files to their responsibilities.

## Proposed roadmap items

- Add a build-gate hardening task so dependency installation tracks both
  `package.json` and `bun.lock`.
- Add a fixture-manifest cleanup task that derives fixture paths from file
  names and tests path consistency.
- Add or pull forward fixture-refresh automation before the ODW example corpus
  needs a routine update.
- Treat the forbidden-import architecture test as a prerequisite for the first
  production parser or envelope-scanner code.
- Keep the typed rule catalogue, rule-documentation parity checks, and
  documentation navigation work visible before user-facing diagnostics ship.

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
- `docs/issues/audit-1.2.3.md`
- `grepai` skill
- `leta` skill
- `sem` skill
- `code-review` skill
