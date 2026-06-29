# Audit after roadmap task 2.1.6

This post-step audit was run after roadmap task 2.1.6 merged into
`origin/main`. The audit used `grepai` against the canonical `main` index for
intent search, then verified branch-local facts in this worktree with `leta`,
direct file inspection, and `sem` entity history.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`
- `docs/issues/audit-1.5.3.md`

Skills and tools used:

- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level history for the task 2.1.6 merge and audited helpers.
- `code-review`: audit dimensions and finding structure.

## Finding 1: Package-entry parsing still has parallel interpreters

Category: duplication

Severity: medium

Location:

- `tests/diagnostics/public-api-surface.test.ts:126`
- `tests/diagnostics/public-api-surface.test.ts:187`
- `tests/diagnostics/public-api-surface.test.ts:219`
- `tests/diagnostics/architecture.test.ts:142`
- `tests/diagnostics/architecture.test.ts:155`
- `tests/diagnostics/import-architecture.ts:365`

Description:

Roadmap task 2.1.6 extracted the reviewed public export list and architecture
pin lists, but package-entry interpretation remains split. The public API
surface test owns robust unknown-to-record manifest validation, package target
normalization, and named facade export extraction. The architecture test still
casts `package.json` to a local `PackageJson` type and reuses a separate export
fact path from `tests/diagnostics/import-architecture.ts`.

The result is two related package-entry contracts with different parsing and
failure messages. A future package condition, facade shape, or export style
change can update one interpreter while leaving the other stale.

Proposed fix:

Extract a test-only `tests/diagnostics/package-entry-support.ts` module that
owns repository file reading, unknown manifest validation, root target
normalization, package entry resolution, TypeScript source parsing, explicit
named re-export extraction, and facade-shape rejection. Keep the existing test
files as separate assertion surfaces: `public-api-surface.test.ts` should assert
the reviewed public names, while `architecture.test.ts` should assert module
boundary and package-entry module-specifier policy.

## Finding 2: Import architecture support has reached the file-size ceiling

Category: complexity

Severity: medium

Location:

- `tests/diagnostics/import-architecture.ts:1`
- `tests/diagnostics/import-architecture.ts:200`
- `tests/diagnostics/import-architecture.ts:365`
- `tests/diagnostics/import-architecture.ts:397`

Description:

`tests/diagnostics/import-architecture.ts` is exactly 400 lines, which leaves no
room for ordinary maintenance under the repository convention that code files
stay manageable and do not exceed 400 lines. The helper currently combines four
responsibilities: TypeScript source parsing, import-like edge extraction,
forbidden ODW runtime import classification, and package facade export facts.

That concentration makes future architecture-test work awkward. Any additional
case for roadmap 2.2 parser imports, package-entry policy, or ODW path
classification is likely to force a larger refactor during an otherwise focused
behavioural change.

Proposed fix:

Split the helper by responsibility before the next architecture-guard change.
For example, keep source parsing and import edge extraction in
`import-architecture.ts`, move forbidden ODW import classification to
`odw-import-policy.ts`, and move export declaration facts to the proposed
`package-entry-support.ts`. Preserve the existing architecture test behaviour
with a no-behaviour-change refactor commit and run `make all`,
`make markdownlint`, and `make nixie`.

## Finding 3: Rule documentation parser mixes parsing with assertions

Category: cqs

Severity: low

Location:

- `tests/diagnostics/rule-catalogue-docs.test.ts:61`
- `tests/diagnostics/rule-catalogue-docs.test.ts:69`
- `tests/diagnostics/rule-catalogue-docs.test.ts:85`
- `tests/diagnostics/rule-catalogue-docs.test.ts:118`

Description:

The rule documentation parity test helper `readRulePageMetadata` parses a rule
page and also calls `expect(Object.keys(metadata)).toEqual(...)` before casting
the parsed object to `RulePageMetadata`. That makes the helper both a query and
an assertion, and the cast hides the fact that malformed rows are only proven
through test side effects.

The nearby `ruleIndexRows` parser also reads every later line that starts with
`|` after the index table header. If `docs/rules/index.md` later gains another
Markdown table below the rule index, the parser will silently treat those rows
as rule metadata and fail with an unrelated index-shape error.

Proposed fix:

Return explicit parse results from the Markdown table helpers and keep
`expect(...)` calls in the tests. Add a small `readFixedTableRows` helper that
starts at a known header, consumes contiguous table rows only, validates cell
counts, and returns either typed metadata or a project-owned parse error. This
keeps command/query separation clear and makes future rule documentation
failures point at the violated Markdown contract.

## Finding 4: Fixture diagnostics are not yet tied to the rule catalogue

Category: test-gap

Severity: medium

Location:

- `tests/static-analysis/invalid-workflow-fixtures.test.ts:28`
- `tests/static-analysis/invalid-workflow-fixtures.test.ts:262`
- `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts:94`
- `tests/static-analysis/fixtures/invalid-workflows/manifests/missing-metadata.ts:17`
- `docs/roadmap.md:308`

Description:

Invalid workflow fixture manifests now validate diagnostic rule strings through
`makeRuleId`, but their expected severities, messages, and rule coverage remain
parallel fixture data. `EXPECTED_RULES` duplicates a sorted list of expected
rule identifiers, and the fixture tests do not yet compare each diagnostic
severity with the catalogue default or require the diagnostic to point at the
catalogued documentation slug.

This is already recognized by roadmap task 2.1.7, but after 2.1.6 the typed
catalogue exists and the remaining gap is concrete: fixture expectations can
drift from `RULE_CATALOGUE` without a focused failure until parser-backed
diagnostics are implemented.

Proposed fix:

Implement the planned 2.1.7 parity check. Add a catalogue lookup helper for
fixture tests, assert that every fixture diagnostic rule exists in
`RULE_CATALOGUE`, assert default severity parity unless the fixture explicitly
documents an override, and include the expected `ruleDocsPath(rule)` or docs
slug in the manifest contract before diagnostic emitters start consuming these
fixtures.

## Finding 5: The new rule reference has weak top-level navigation

Category: docs-gap

Severity: low

Location:

- `docs/rules/index.md:1`
- `docs/developers-guide.md:139`
- `docs/documentation-style-guide.md:82`
- missing `docs/contents.md`
- missing `docs/users-guide.md`

Description:

Roadmap task 2.1.6 added a useful `docs/rules/index.md` reference, but it is
currently discoverable mainly by knowing the path or by reading maintainer
documentation. The documentation style guide calls for a contents file and a
user's guide, and earlier audits already noted that those surfaces are absent.
The gap is sharper now because rule identifiers, severities, release status,
configuration keys, and documentation paths are no longer only internal design
material.

Users and integrators will need a stable path from the documentation entry
points to the rule reference before the first `odw-lint check` vertical slice
starts emitting these diagnostics.

Proposed fix:

Add `docs/rules/index.md` to the first top-level navigation surface created for
the project. If `docs/contents.md` and `docs/users-guide.md` are still deferred,
add an interim link from `docs/developers-guide.md` near the rule catalogue
section and reference it from the future user guide when the CLI surface lands.
Keep maintainer-only catalogue implementation details in the developer guide,
but make the rule reference itself discoverable from user-facing documentation.

## Proposed roadmap items

These are proposals only. Editing `docs/roadmap.md` is reserved to the root
workflow agent.

### Extract shared package-entry support

Rationale: package manifest parsing and package facade export extraction still
exist in parallel across the public API surface and architecture tests. A shared
test-support module would remove divergent interpreters before more public
exports or package conditions are added.

Severity: medium

### Split import architecture helpers

Rationale: `tests/diagnostics/import-architecture.ts` is exactly 400 lines and
mixes source parsing, import-edge extraction, ODW import policy, and export
facts. Splitting it now keeps later architecture checks focused and avoids
file-size pressure.

Severity: medium

### Implement fixture-to-catalogue parity

Rationale: roadmap 2.1.7 is now unblocked by the typed catalogue. Fixture
diagnostics should prove rule, default severity, and documentation-slug parity
before parser-backed diagnostics start consuming the fixture manifests.

Severity: medium

### Surface the rule reference in user navigation

Rationale: `docs/rules/index.md` is now a durable reference, but top-level
navigation is still weak. Link it from the first contents or user's guide
surface, with an interim developer-guide link if those documents remain
deferred.

Severity: low
