# Post-step audit after roadmap task 1.4.1

- Status: Proposed findings
- Scope: `origin/main` inspected from the `audit-1.4.1-codebase-audit`
  git-donkey worktree

This audit was run after the lockfile-sensitive build marker landed on
`origin/main`. It used `grepai` for canonical main-branch intent search,
`leta` for branch-local symbol, reference, call-graph, and file verification,
and `sem` for entity-level history and blame inspection.

## Finding 1: The developer guide still contradicts the package entry

- Category: inconsistency
- Severity: Medium
- Location: `docs/developers-guide.md:24`, `package.json:6`,
  `src/index.ts:1`

The developer guide still says the static-analysis scaffold is exposed through
`src/index.ts` but does not add package-level `exports`, `types`, `main`, or
`bin` fields while the package remains private. The current package manifest
does define `main`, `types`, and `exports`, and the package entry exports both
diagnostic and static-analysis source helpers.

`src/index.ts` also describes itself as the "Public diagnostic contract",
which is now narrower than the actual package surface. A maintainer following
the guide could wrongly treat the current package export map as out of scope,
or miss that original-source helpers are already part of the importable
contract.

Proposed fix:

- Update the developer guide's static-analysis boundary section to describe
  the current private package entry shape.
- Change the `src/index.ts` file-level documentation to describe the complete
  package contract, including diagnostics and static-analysis source helpers.
- Keep the package-entry architecture test as the executable source of truth
  while the package remains private.

## Finding 2: Source-file helpers still combine too many responsibilities

- Category: separation-of-concerns
- Severity: Low
- Location: `src/static-analysis/source-file.ts:48`,
  `src/static-analysis/source-file.ts:194`,
  `src/static-analysis/source-file.ts:286`

`src/static-analysis/source-file.ts` is 393 lines, just under the 400-line
project convention. It owns source-record construction, UTF-8 scanning, display
line metadata, private lookup indexes, offset validation, span validation,
slicing, snippet creation, and immutable value construction.

The code is well covered, but parser normalization and span-mapper work will
extend the same concepts. Keeping all of those responsibilities in one
near-limit file makes future changes more likely to mix scanner, validator,
and presentation concerns.

Proposed fix:

- Split the module into focused internals such as `source-scan.ts`,
  `source-span.ts`, and `source-snippet.ts`.
- Preserve the existing public exports through `src/static-analysis/index.ts`
  and `src/index.ts`.
- Keep the `WeakMap`-backed private indexes owned by the construction path,
  and document which helpers may access them.
- Run the existing unit and property tests before and after the refactor to
  prove source-span behaviour remains unchanged.

## Finding 3: JavaScript line separators remain outside source-span coverage

- Category: test-gap
- Severity: Medium
- Location: `src/static-analysis/source-file.ts:360`,
  `tests/static-analysis/source-file-line-fixtures.ts:18`,
  `tests/static-analysis/source-file-property-oracle.ts:262`

The production scanner and independent property-test oracle treat LF, CRLF,
and CR as line terminators. They do not treat U+2028 line separator or U+2029
paragraph separator as line breaks, even though future workflow bodies will be
parsed as JavaScript-like source.

Current fixtures cover ordinary newline forms, trailing newlines, and Unicode
code points, but not JavaScript's additional line terminators. Parser-backed
diagnostics could therefore disagree with the original-source line and column
model for uncommon but valid workflow source.

Proposed fix:

- Extend the production source scanner and independent property-test oracle to
  treat U+2028 and U+2029 as line terminators.
- Add line-metadata, position, and span fixtures for both characters.
- Add a parser-backed span test once the SWC adapter lands, proving SWC and
  the source mapper agree on these line separators.

## Finding 4: The invalid fixture manifest is still at the size cliff

- Category: separation-of-concerns
- Severity: Medium
- Location: `tests/static-analysis/fixtures/invalid-workflows.ts:101`,
  `tests/static-analysis/fixtures/invalid-workflows.ts:131`

The invalid workflow manifest is 386 lines. It mixes manifest types, path
derivation, diagnostic construction, all invalid fixture families, expected
statuses, rule identifiers, source spans, and reviewer-facing span text.

That leaves little room before the project file-size convention is breached.
The next invalid fixture family or span-heavy parser case is likely to force a
rushed split, and reviews already have to scan shared manifest logic and
fixture-family data in the same file.

Proposed fix:

- Split invalid fixture data by family, for example under
  `tests/static-analysis/fixtures/invalid-workflows/manifest/`.
- Keep shared manifest types and builders in a small index module.
- Preserve the exported `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` array so
  downstream tests do not learn the storage layout.

## Finding 5: Fixture corpus I/O helpers remain duplicated across tests

- Category: duplication
- Severity: Low
- Location: `tests/static-analysis/odw-example-fixtures.test.ts:27`,
  `tests/static-analysis/masking-fixtures.test.ts:30`,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts:71`

The ODW example, masking, and invalid workflow corpus tests each define a local
SHA-256 helper, fixture listing helper, and fixture source reader. The invalid
corpus needs recursive listing and span checks, but the shared behaviour is the
same: read committed fixture text through manifest data and compare it with a
pinned hash.

The repetition is still modest, but loader parity, fixture refresh automation,
and real lint execution tests will reuse the same I/O pattern. Leaving each
test to grow its own helper makes future corpus changes noisier and increases
the chance that one suite handles paths or encodings differently.

Proposed fix:

- Extract a test-owned fixture I/O helper with `sha256`, fixture-source
  reading, flat listing, and recursive listing operations.
- Keep corpus-specific ordering, family, context, marker, and span assertions
  inside the individual test files.
- Put the helper under `tests/static-analysis/support/` or another clearly
  test-only path.

## Finding 6: Fixture metadata maintenance remains manual

- Category: ergonomics
- Severity: Medium
- Location: `docs/developers-guide.md:132`,
  `tests/static-analysis/fixtures/odw-examples.ts:58`,
  `tests/static-analysis/fixtures/invalid-workflows.ts:131`,
  `tests/static-analysis/fixtures/masking.ts:61`

The fixture corpus now has valid, invalid, masking, and hostile metadata
families. Each family records hand-maintained SHA-256 digests, while the
invalid corpus also records UTF-8 offsets, display positions, and
reviewer-facing `spanText` values. Tests verify the values after the fact, but
the repository does not provide a command that derives them.

That maintenance path is awkward because raw fixture files must not be
formatted, imported, or executed, and span coordinates use UTF-8 byte offsets
rather than JavaScript string indexes. Hostile metadata increases the cost of
mistakes because the fixture source is intentionally unsafe to evaluate.

Proposed fix:

- Add a small Bun script or Make target that prints fixture SHA-256 values and,
  for invalid fixtures, derives `SourceSpan` coordinates from a selected span.
- Reuse either the production source-file helpers or the independent test
  oracle so generated coordinates follow the repository offset contract.
- Document the refresh workflow in the developer guide, including validation
  commands and the rule that raw fixtures must not be executed or formatted.

## Finding 7: Documentation navigation is missing while audits accumulate

- Category: docs-gap
- Severity: Low
- Location: `docs/documentation-style-guide.md:67`, `docs/roadmap.md:538`,
  `docs/`

The documentation style guide recommends canonical navigation documents such
as `docs/contents.md` and `docs/repository-layout.md`. The roadmap also has
task 4.4.1 for those files. The repository now has terms of reference, a
technical design, an ADR, a developer guide, scripting standards, eight issue
audits, and nine execution plans, but no contents page or repository-layout
map.

This is not a release blocker before the CLI exists, but it is already a
handoff cost for roadmap agents and reviewers because document families must
be inferred from filenames and directory scans.

Proposed fix:

- Pull forward a minimal `docs/contents.md` that indexes current design docs,
  ADRs, issue audits, execution plans, and maintainer references.
- Add `docs/repository-layout.md` once parser and rule modules expand beyond
  the current diagnostics and static-analysis spine.
- Keep the full user's guide deferred until `odw-lint check` has executable
  user-facing behaviour to document.

## Proposed roadmap items

- Keep task 1.2.3.2 visible as the package-entry documentation sync item, and
  include the `src/index.ts` file-level documentation in its acceptance
  criteria.
- Keep task 1.2.4 as the source-file helper split before parser span-mapping
  work broadens the module.
- Keep task 1.2.2.5 as a prerequisite for parser-backed source-span
  diagnostics so JavaScript line separators are handled deliberately.
- Keep task 1.3.4.1 before the next invalid fixture family pushes
  `invalid-workflows.ts` over the file-size convention.
- Keep task 1.3.4.2 before loader parity and real lint execution tests add more
  fixture I/O repetition.
- Keep task 1.3.5 as the fixture metadata generation and refresh tooling item.
- Consider pulling task 4.4.1 forward if additional post-step audits or
  execution plans land before phase 2 starts.

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
- `docs/issues/audit-1.3.3.md`
- `docs/issues/audit-1.3.4.md`
- `grepai` skill
- `leta` skill
- `sem` skill
- `code-review` skill
- `commit-message` skill
- `en-gb-oxendict-style` skill
