# Post-step audit after roadmap task 1.3.4

- Status: Proposed findings
- Scope: `origin/main` inspected from the
  `df12/audit-1.3.4-20260628143452` git-donkey worktree

This audit was run after the hostile metadata fixture corpus landed on
`origin/main`. It used `grepai` for canonical main-branch intent search,
`leta` for branch-local symbol, reference, and call-graph verification, and
`sem` for entity-level diff and blame inspection.

## Finding 1: The build target still ignores `bun.lock`

- Category: ergonomics
- Severity: Medium
- Location: `Makefile:7`

The `node_modules` target still depends on `package.json` only:

```make
node_modules: package.json
```

That leaves `make build`, `make lint`, `make typecheck`, `make test`, and
`make all` vulnerable to stale installed dependencies when a change updates
only `bun.lock`. The repository commits the lockfile deliberately, and roadmap
task 1.4.1 already reserves this build-gate hardening.

Proposed fix:

- Make the dependency-install marker depend on both `package.json` and
  `bun.lock`.
- Prefer a stamp file under `node_modules`, such as
  `node_modules/.bun-install-stamp`, if touching the directory itself proves
  too coarse.
- Keep `make clean` removing the marker together with `node_modules`.

## Finding 2: The developer guide contradicts the package entry point

- Category: inconsistency
- Severity: Medium
- Location: `docs/developers-guide.md:24`, `package.json:6`,
  `src/index.ts:1`

The developer guide still says roadmap task 1.1.1 exposed the static-analysis
boundary through `src/index.ts` but did not add package-level `exports`,
`types`, `main`, or `bin` fields while the package remains private. The
current package manifest has `main`, `types`, and `exports`, and the
architecture test pins that package entry shape.

The public entry file also still describes itself as the "Public diagnostic
contract", even though it now exports diagnostics and static-analysis source
helpers. A maintainer following the guide could treat package exports as out
of scope or miss that static-analysis helpers are part of the current package
surface.

Proposed fix:

- Update the developer guide's static-analysis boundary section to describe
  the current private package entry shape.
- Change the `src/index.ts` file-level documentation to describe the complete
  package contract, not only diagnostics.
- Keep the architecture test as the executable source of truth for the
  current package entry while the package remains private.

## Finding 3: JavaScript line separators are not covered by source spans

- Category: test-gap
- Severity: Medium
- Location: `src/static-analysis/source-file.ts:360`,
  `tests/static-analysis/source-file-property-oracle.ts:262`

`scanOriginalSource` and the independent property-test oracle both treat LF,
CRLF, and CR as source line terminators. They do not treat U+2028 line
separator or U+2029 paragraph separator as line breaks, even though workflow
bodies are JavaScript-like source that future SWC-backed diagnostics will parse
as JavaScript or TypeScript.

The current fixtures cover LF, CRLF, CR, trailing newlines, and Unicode code
points, but they do not cover JavaScript's additional line terminators. Parser
diagnostics could therefore disagree with the original-source line and column
model for uncommon but valid workflow source.

Proposed fix:

- Extend the production source scanner and independent property-test oracle to
  treat U+2028 and U+2029 as line terminators.
- Add line-metadata, position, and span fixtures for both characters.
- Add at least one future parser-backed span test that proves SWC and the
  source mapper agree on these line separators.

## Finding 4: The invalid fixture manifest is at the module-size cliff

- Category: separation-of-concerns
- Severity: Medium
- Location: `tests/static-analysis/fixtures/invalid-workflows.ts:102`,
  `tests/static-analysis/fixtures/invalid-workflows.ts:131`

The invalid workflow manifest is now 386 lines after task 1.3.4. The project
convention keeps code files below 400 lines, and this module mixes manifest
types, path derivation, diagnostic construction, all invalid fixture families,
and every expected diagnostic span.

The hostile metadata family made the file close enough to the limit that the
next invalid fixture family or span-heavy case will probably force a rushed
split. The current shape also makes review harder because fixture-family
changes are interleaved with shared manifest construction helpers.

Proposed fix:

- Split invalid fixture data by family, for example under
  `tests/static-analysis/fixtures/invalid-workflows/manifest/`.
- Keep shared manifest types and builders in a small index module.
- Preserve the existing exported `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` array so
  downstream tests do not need to know the storage layout.

## Finding 5: Fixture corpus I/O helpers remain duplicated across tests

- Category: duplication
- Severity: Low
- Location: `tests/static-analysis/odw-example-fixtures.test.ts:32`,
  `tests/static-analysis/masking-fixtures.test.ts:35`,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts:76`

The ODW example, masking, and invalid workflow corpus tests each define local
SHA-256 helpers, fixture-file listing helpers, and fixture-source readers. The
invalid corpus needs recursive listing and span checks, but the shared
behaviour is otherwise the same: read committed fixture text through manifest
data and compare it with pinned hashes.

Task 1.3.4 added another hostile metadata check on top of the same local
invalid-fixture I/O helpers. The repeated code is still small, but it will
grow when loader parity, fixture refresh automation, and actual lint execution
tests add more corpus checks.

Proposed fix:

- Extract a test-owned fixture I/O helper with `sha256`, fixture-source
  reading, flat listing, and recursive listing operations.
- Keep corpus-specific ordering, family, context, marker, and span assertions
  in the individual test files.
- Place the helper under `tests/static-analysis/support/` or a similarly clear
  test-only path so it cannot be mistaken for production fixture logic.

## Finding 6: Hostile metadata coverage is passive until the analyser exists

- Category: test-gap
- Severity: Medium
- Location: `tests/static-analysis/invalid-workflow-fixtures.test.ts:191`,
  `docs/roadmap.md:209`

The new hostile metadata fixtures are represented safely as passive source
text. The test clears the global marker, reads each fixture with
`readFileSync`, verifies the fixture text and SHA-256 digest, validates the
expected diagnostic span text, and confirms that reading the file did not set
the marker.

That is the right level for the current fixture-only phase, but it does not yet
prove the eventual static analysis pipeline can classify hostile metadata
without evaluating it. Roadmap task 2.1.5 reserves that regression, and the
security boundary makes it release-blocking once metadata classification lands.

Proposed fix:

- Keep the current passive fixture test as the corpus contract.
- When task 2.1.3 introduces metadata classification, add the task 2.1.5
  regression that runs the real lint path over hostile metadata and asserts
  both diagnostics and absence of marker side effects.
- Ensure that regression imports only the static analyser entry point, not any
  ODW runtime helper that can evaluate metadata.

## Finding 7: Fixture metadata maintenance is still manual

- Category: ergonomics
- Severity: Medium
- Location: `docs/developers-guide.md:127`,
  `tests/static-analysis/fixtures/odw-examples.ts:77`,
  `tests/static-analysis/fixtures/invalid-workflows.ts:131`,
  `tests/static-analysis/fixtures/masking.ts:73`

The fixture corpus now has three manifest families. Each family records
hand-maintained SHA-256 digests, and the invalid corpus also records byte
offsets, line and column positions, and reviewer-facing `spanText` values. The
tests verify those values after the fact, but the repository does not provide a
command or checklist for deriving them when adding or refreshing fixtures.

That maintenance path is easy to get wrong because fixture sources are raw
inputs that must not be imported, executed, or formatted, and source spans use
UTF-8 byte offsets rather than JavaScript string indexes. Hostile metadata
raises the cost of mistakes because the fixtures are intentionally unsafe to
evaluate.

Proposed fix:

- Add a small Bun script or documented Make target that prints SHA-256 values
  and, for invalid fixtures, derives `SourceSpan` coordinates from a unique
  selected span.
- Reuse the existing source-file helpers or the independent source-file test
  oracle so generated coordinates follow the repository offset contract.
- Document the fixture refresh workflow in the developer guide, including the
  validation commands and the rule that raw fixture files must not be executed
  or formatted.

## Finding 8: Maintainer documentation navigation is missing

- Category: docs-gap
- Severity: Low
- Location: `docs/documentation-style-guide.md:67`, `docs/roadmap.md:468`,
  `docs/`

The repository now has terms of reference, a technical design, an ADR, a
developer guide, scripting standards, seven issue audits, and eight execution
plans, but no `docs/contents.md`, `docs/repository-layout.md`, user's guide,
or `README.md`. Roadmap tasks 4.2.1 and 4.4.1 reserve the larger user and
maintainer documentation work, but the audit trail is already large enough
that maintainers must infer document families from filenames.

This is not a release blocker before the CLI exists, but it is a navigation
cost for roadmap agents and reviewers today.

Proposed fix:

- Pull forward a minimal `docs/contents.md` that indexes current design docs,
  ADRs, issue audits, execution plans, and maintainer references.
- Add `docs/repository-layout.md` once the parser and rule modules expand
  beyond the current diagnostics and static-analysis spine.
- Keep the full user's guide deferred until `odw-lint check` has executable
  user-facing behaviour to document.

## Proposed roadmap items

- Keep roadmap task 1.4.1 as the build-gate fix for `bun.lock` sensitivity.
- Add a documentation sync task for the private package entry point and public
  `src/index.ts` contract.
- Add JavaScript U+2028 and U+2029 source-span coverage before parser-backed
  diagnostics depend on original-source line mapping.
- Add a fixture-manifest split before the next invalid fixture family pushes
  `invalid-workflows.ts` over the file-size convention.
- Add a fixture-corpus support helper before loader parity and real lint
  execution tests duplicate more fixture I/O code.
- Keep task 2.1.5 as the real hostile-metadata no-execution regression once
  metadata classification exists.
- Add fixture metadata generation or refresh tooling before the fixture corpus
  grows further.
- Pull forward a minimal documentation contents page before the issue-audit
  and execution-plan trail becomes harder to navigate.

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
- `leta` skill
- `sem` skill
- `code-review` skill
