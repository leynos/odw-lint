# Audit after roadmap task 1.5.3

This post-step audit was run after roadmap task 1.5.3 merged into
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

Skills and tools used:

- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level history for the task 1.5.3 merge.
- `code-review`: audit dimensions and finding structure.
- `commit-message`: file-based commit workflow.

## Finding 1: Package-entry guard logic is duplicated

Category: duplication

Severity: medium

Location:

- `tests/diagnostics/public-api-surface.test.ts:169`
- `tests/diagnostics/public-api-surface.test.ts:280`
- `tests/diagnostics/architecture.test.ts:68`
- `tests/diagnostics/architecture.test.ts:110`
- `tests/diagnostics/architecture.test.ts:149`
- `tests/diagnostics/architecture.test.ts:207`

Description:

The new public API removal guard and the older diagnostic architecture test
both parse repository TypeScript files, inspect `ExportDeclaration` nodes, and
validate package-entry shape. The newer test owns runtime checks for
`package.json` root targets, while the older test casts `package.json` to its
local `PackageJson` type and hard-codes the expected root export object.

That creates two parallel package-entry interpreters. A future package shape or
facade-rule change can update one guard while leaving the other stale, or make
the two tests fail with different explanations for the same underlying
contract change.

Proposed fix:

Extract a test-only package-entry support module, for example
`tests/diagnostics/package-entry-support.ts`, that owns:

- repository-relative UTF-8 file reading;
- unknown-to-record package manifest validation;
- root export condition target normalization;
- TypeScript source parsing;
- explicit named re-export extraction; and
- facade-shape rejection for wildcard, namespace, direct, and default exports.

Keep the current tests as separate assertion surfaces: the architecture test
should assert module boundaries and allowed internals, while
`public-api-surface.test.ts` should assert the reviewed public name list. The
shared helper should have focused unit coverage so package-entry parsing has
one source of truth.

## Finding 2: Public API surface test is at the file-size limit

Category: complexity

Severity: medium

Location:

- `tests/diagnostics/public-api-surface.test.ts:15`
- `tests/diagnostics/public-api-surface.test.ts:131`
- `tests/diagnostics/public-api-surface.test.ts:169`
- `tests/diagnostics/public-api-surface.test.ts:258`
- `tests/diagnostics/public-api-surface.test.ts:351`
- `docs/roadmap.md:214`

Description:

`tests/diagnostics/public-api-surface.test.ts` is 390 physical lines, ten lines
under the project convention that source and test files stay below 400 lines.
The file combines the reviewed export list, export-shape fixtures, manifest
fixtures, package-manifest parsing, TypeScript facade parsing, and three test
groups.

This is not a functional defect, but it makes the next ordinary public API
addition brittle: adding one or two exports plus coverage can push the file
over the convention before roadmap task 1.5.1 makes the limit executable.

Proposed fix:

Split the suite before the next public export change. A small structure would
keep review scope clear:

- `tests/diagnostics/public-api-surface.test.ts` for the reviewed export list
  assertion;
- `tests/diagnostics/public-api-surface-fixtures.ts` for expected names and
  table cases; and
- `tests/diagnostics/package-entry-support.ts` for package and facade parsing.

Prioritize roadmap task 1.5.1 soon after this split so the file-size
convention is enforced by `make all`.

## Finding 3: User-facing documentation navigation is incomplete

Category: docs-gap

Severity: low

Location:

- `docs/documentation-style-guide.md:82`
- `docs/documentation-style-guide.md:103`
- `docs/documentation-style-guide.md:131`
- missing `docs/contents.md`
- missing `docs/users-guide.md`
- missing `docs/repository-layout.md`
- `docs/developers-guide.md:24`
- `docs/developers-guide.md:128`

Description:

The documentation style guide defines canonical documentation surfaces for a
contents file, user's guide, developer's guide, and repository layout. The
repository currently has strong terms, design, ADR, roadmap, and developer
documentation, but it does not yet have `docs/contents.md`,
`docs/users-guide.md`, or `docs/repository-layout.md`.

That gap is tolerable while the project remains an implementation scaffold, but
roadmap task 1.5.3 now pins a private package entry and reviewed public export
surface. As the checker moves into the first CLI vertical slice, users and
consumer-style integrators will need a task-focused place to find the command
contract, diagnostic JSON shape, import surface, and repository navigation
without reading maintainer-only roadmap or architecture tests.

Proposed fix:

Add the missing documentation surfaces before or alongside the first
user-facing `odw-lint check` implementation:

- `docs/contents.md` as the index for terms, design, ADRs, roadmap, guides,
  and issue audits;
- `docs/repository-layout.md` as the path-responsibility map; and
- `docs/users-guide.md` with the current CLI contract, diagnostic output
  contract, configuration placeholders, and public import examples that are
  expected to survive v1.

Then update `docs/developers-guide.md` to link to those documents early,
matching its own style-guide guidance.

## Proposed roadmap items

These are proposals only. Editing `docs/roadmap.md` is reserved to the root
workflow agent.

### Extract shared package-entry test support

Rationale: roadmap task 1.5.3 added a strong public export guard, but it now
duplicates package-entry and TypeScript facade parsing already present in the
diagnostic architecture test. A small test-support extraction would remove
parallel interpreters before more public API or package condition work lands.

Severity: medium

### Split the public API surface suite before export growth

Rationale: the new test file is already 390 lines. Splitting fixtures, helper
logic, and assertions keeps future public API reviews under the 400-line
convention and reduces pressure to combine unrelated guard behaviour.

Severity: medium

### Add the missing user documentation spine

Rationale: the repository's style guide expects contents, user's guide, and
repository-layout documents. Adding them before the first CLI vertical slice
will give workflow authors and API consumers a stable entry point that is not
buried in maintainer design documents.

Severity: low
