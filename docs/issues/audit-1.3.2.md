# Post-step audit after roadmap task 1.3.2

- Status: Proposed findings
- Scope: `origin/main` inspected from the `audit-1.3.2-post-audit`
  git-donkey worktree

This audit was run after the invalid workflow fixture families landed on
`origin/main`. It used `grepai` for canonical main-branch intent search,
`leta` for branch-local symbol, reference, and call-graph verification, and
`sem` for entity-level diff, graph, and blame inspection.

## Finding 1: The build target still ignores `bun.lock`

- Category: ergonomics
- Severity: Medium
- Location: `Makefile:7`

The `node_modules` target depends on `package.json` only:

```make
node_modules: package.json
```

That leaves `make build`, `make lint`, `make typecheck`, `make test`, and
`make all` vulnerable to stale installed packages when a dependency change only
updates `bun.lock`. The repository commits the lockfile deliberately, and the
roadmap already reserves task 1.4.1 for this hardening.

Proposed fix:

- Make the dependency-install marker depend on both `package.json` and
  `bun.lock`.
- Prefer a stamp file under `node_modules`, such as
  `node_modules/.bun-install-stamp`, if touching the directory itself proves
  too coarse.
- Keep `make clean` removing the marker together with `node_modules`.

## Finding 2: Source line indexing omits JavaScript line separators

- Category: test-gap
- Severity: Medium
- Location: `src/static-analysis/source-file.ts:360`,
  `tests/static-analysis/source-file-line-fixtures.ts:20`

`scanOriginalSource` treats LF, CRLF, and CR as source line terminators. It does
not treat U+2028 line separator or U+2029 paragraph separator as line breaks,
even though workflow bodies are JavaScript-like source that future SWC-backed
diagnostics will parse as JavaScript or TypeScript.

That can make parser-backed diagnostics disagree with the original-source line
and column model for uncommon but valid JavaScript line terminators. The
current source-file fixtures cover LF, CRLF, CR, trailing newlines, and Unicode
code points, but they do not cover U+2028 or U+2029.

Proposed fix:

- Extend `isLineTerminator` to cover U+2028 and U+2029, while keeping CRLF as a
  single display line break.
- Add line-metadata, position, and span fixtures for U+2028 and U+2029.
- Add at least one future parser-backed span snapshot that proves SWC and the
  source mapper agree on these line separators.

## Finding 3: The invalid fixture manifest is near the file-size limit

- Category: complexity
- Severity: Medium
- Location: `tests/static-analysis/fixtures/invalid-workflows.ts:125`

The invalid workflow manifest is already 348 lines after task 1.3.2. Roadmap
tasks 1.3.3 and 1.3.4 will add masking and hostile-metadata fixtures, and the
project convention in `AGENTS.md` says no single code file should exceed 400
lines. Adding the next fixture families to the same manifest is likely to push
this file over that limit.

The file also mixes manifest types, fixture construction helpers, diagnostic
construction helpers, and every family entry. That makes the next fixture
slice more likely to add large data blocks to a file that already has multiple
responsibilities.

Proposed fix:

- Split fixture data by family, for example under
  `tests/static-analysis/fixtures/invalid-workflows/manifest/`.
- Keep shared manifest types and builders in one small index module.
- Re-export the existing `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` array so current
  tests and future parser work keep the same import surface.

## Finding 4: Fixture I/O helpers are duplicated across corpus tests

- Category: duplication
- Severity: Low
- Location: `tests/static-analysis/odw-example-fixtures.test.ts:27`,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts:65`

The valid ODW example corpus test and the invalid workflow corpus test both
define local SHA-256 helpers, copied-file listing helpers, and fixture-source
readers. The invalid corpus needs recursive listing, while the valid corpus is
flat, but the shared behaviour is otherwise the same: read committed fixture
text through repository-relative manifest data and compare it with a pinned
hash.

The duplication is small today. It will grow when masking, hostile metadata,
loader parity, and refresh automation add more corpus checks.

Proposed fix:

- Extract a test-only fixture I/O helper with `sha256`, `readFixtureSource`,
  flat listing, and recursive listing operations.
- Keep corpus-specific ordering and family assertions in the individual test
  files.
- Add the helper under `tests/static-analysis/fixtures/` or
  `tests/static-analysis/support/` so it is clearly test-owned.

## Finding 5: Invalid fixture span maintenance is manual

- Category: ergonomics
- Severity: Medium
- Location: `tests/static-analysis/fixtures/invalid-workflows.ts:125`,
  `docs/developers-guide.md:127`

Each invalid fixture entry manually records the file name, SHA-256 digest,
expected diagnostics, byte offsets, line and column values, and reviewer-facing
`spanText`. The tests recompute hashes and verify that the explicit spans match
the raw fixture text, but there is no command or checklist for deriving those
values when adding or refreshing fixtures.

This is easy to get wrong because the span contract uses UTF-8 byte offsets,
while JavaScript strings use UTF-16 indexes. The 1.3.2 tests caught that risk
for the current ASCII fixture set, but future Unicode, masking, and hostile
metadata cases will be harder to maintain by hand.

Proposed fix:

- Add a small Bun script or documented Make target that accepts a fixture path,
  expected rule data, and a unique span text, then prints the SHA-256 digest
  and UTF-8 `SourceSpan`.
- Reuse the existing source-file helpers or the independent source-file test
  oracle so generated coordinates follow the same offset contract.
- Document the refresh workflow in `docs/developers-guide.md`, including the
  validation commands and the rule that raw fixture files must not be executed
  or formatted.

## Finding 6: The source-file module is carrying too many responsibilities

- Category: separation-of-concerns
- Severity: Low
- Location: `src/static-analysis/source-file.ts:43`,
  `src/static-analysis/source-file.ts:189`, `src/static-analysis/source-file.ts:281`

`src/static-analysis/source-file.ts` owns source-record construction, line
scanning, private lookup tables, offset validation, span validation, slicing,
snippet creation, line-text lookup, and immutable value construction. The file
is still under the 400-line project limit, but at 393 lines it has little room
left before parser, mapper, and reporter work start to use this code more
heavily.

The current functions are covered well. The maintainability risk is that later
span-mapper changes may add more private helpers to the same file rather than
keeping scanning, validation, and snippet presentation separate.

Proposed fix:

- Split the module into focused internal files such as `source-scan.ts`,
  `source-span.ts`, and `source-snippet.ts`, with
  `src/static-analysis/source-file.ts` or `index.ts` preserving the public
  exports.
- Keep the `WeakMap`-backed private indexes owned by the construction path, and
  document which helper modules may access them.
- Run the existing source-file unit and property tests before and after the
  refactor to prove the public API remains unchanged.

## Proposed roadmap items

- Keep roadmap task 1.4.1 as the build-gate fix for `bun.lock` sensitivity.
- Add a fixture-manifest split before tasks 1.3.3 and 1.3.4 add more fixture
  families.
- Add Unicode JavaScript line-separator coverage to the source-position helper
  work before parser-backed diagnostics depend on it.
- Add fixture metadata generation or refresh tooling before the next invalid
  corpus expansion.
- Consider a small source-file module split before the span mapper and parser
  adapter broaden the static-analysis source model.

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
- `docs/issues/audit-1.3.1.md`
- `grepai` skill
- `leta` skill
- `sem` skill
- `code-review` skill
- `biome-typescript` skill
- `en-gb-oxendict-style` skill
- `commit-message` skill
