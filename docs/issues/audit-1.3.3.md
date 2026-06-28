# Post-step audit after roadmap task 1.3.3

- Status: Proposed findings
- Scope: `origin/main` inspected from the `df12-audit-1.3.3`
  git-donkey worktree

This audit was run after the masking fixture corpus landed on `origin/main`.
It used `grepai` for canonical main-branch intent search, `leta` for
branch-local symbol, reference, and call-graph verification, and `sem` for
entity-level diff and blame inspection.

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
  `tests/diagnostics/architecture.test.ts:182`, `src/index.ts:1`

The developer guide still says roadmap task 1.1.1 exposed the static-analysis
boundary through `src/index.ts` but did not add package-level `exports`,
`types`, `main`, or `bin` fields while the package remains private. The
current package manifest does have `main`, `types`, and `exports`, and the
architecture test now pins that package entry shape.

The public entry file also still describes itself as the "Public diagnostic
contract", even though it now exports diagnostics and static-analysis source
helpers. A maintainer following the guide could treat package exports as out of
scope or miss that static-analysis helpers are part of the current package
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
  `tests/static-analysis/source-file-line-fixtures.ts:19`,
  `tests/static-analysis/source-file-span-cases.ts:34`

`scanOriginalSource` treats LF, CRLF, and CR as source line terminators. It
does not treat U+2028 line separator or U+2029 paragraph separator as line
breaks, even though workflow bodies are JavaScript-like source that future
SWC-backed diagnostics will parse as JavaScript or TypeScript.

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

## Finding 4: Fixture corpus I/O helpers are duplicated across tests

- Category: duplication
- Severity: Low
- Location: `tests/static-analysis/odw-example-fixtures.test.ts:27`,
  `tests/static-analysis/masking-fixtures.test.ts:30`,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts:64`

The ODW example, masking, and invalid workflow corpus tests each define local
SHA-256 helpers, fixture-file listing helpers, and fixture-source readers. The
invalid corpus needs recursive listing and span checks, but the shared
behaviour is otherwise the same: read committed fixture text through manifest
data and compare it with pinned hashes.

Task 1.3.3 made this duplication visible by adding the third local copy of the
same fixture I/O pattern. The repeated code is still small, but it will grow
when hostile metadata, loader parity, and refresh automation add more corpus
checks.

Proposed fix:

- Extract a test-owned fixture I/O helper with `sha256`, fixture-source
  reading, flat listing, and recursive listing operations.
- Keep corpus-specific ordering, family, context, and span assertions in the
  individual test files.
- Place the helper under `tests/static-analysis/support/` or a similarly
  clear test-only path so it cannot be mistaken for production fixture logic.

## Finding 5: Source-file helpers sit at the file-size limit

- Category: separation-of-concerns
- Severity: Low
- Location: `src/static-analysis/source-file.ts:48`,
  `src/static-analysis/source-file.ts:194`,
  `src/static-analysis/source-file.ts:286`

`src/static-analysis/source-file.ts` is 393 lines, just below the 400-line
project convention in `AGENTS.md`. It owns source-record construction, line
scanning, private lookup indexes, offset validation, span validation, slicing,
snippet creation, line-text lookup, and immutable value construction.

The current functions are well covered, but the next parser and span-mapper
tasks are likely to add pressure to this module. Without a planned split,
future changes may mix scanner, validation, and presentation concerns in the
same near-limit file.

Proposed fix:

- Split the module into focused internals such as `source-scan.ts`,
  `source-span.ts`, and `source-snippet.ts`, while preserving the existing
  public exports through `src/static-analysis/index.ts`.
- Keep the `WeakMap`-backed private indexes owned by the construction path,
  and document which helpers may access them.
- Run the existing source-file unit and property tests before and after the
  refactor to prove the public API remains unchanged.

## Finding 6: Fixture metadata maintenance is still manual

- Category: ergonomics
- Severity: Medium
- Location: `docs/developers-guide.md:127`,
  `tests/static-analysis/fixtures/odw-examples.ts:64`,
  `tests/static-analysis/fixtures/invalid-workflows.ts:101`,
  `tests/static-analysis/fixtures/masking.ts:67`

The fixture corpus now has three manifest families. Each family records
hand-maintained SHA-256 digests, and the invalid corpus also records byte
offsets, line and column positions, and reviewer-facing `spanText` values. The
tests verify those values after the fact, but the repository does not provide a
command or checklist for deriving them when adding or refreshing fixtures.

That maintenance path is easy to get wrong because fixture sources are raw
inputs that must not be imported, executed, or formatted, and source spans use
UTF-8 byte offsets rather than JavaScript string indexes. The risk increases
with task 1.3.4's hostile metadata fixtures.

Proposed fix:

- Add a small Bun script or documented Make target that prints SHA-256 values
  and, for invalid fixtures, derives `SourceSpan` coordinates from a unique
  selected span.
- Reuse the existing source-file helpers or the independent source-file test
  oracle so generated coordinates follow the repository offset contract.
- Document the fixture refresh workflow in the developer guide, including the
  validation commands and the rule that raw fixture files must not be executed
  or formatted.

## Proposed roadmap items

- Keep roadmap task 1.4.1 as the build-gate fix for `bun.lock` sensitivity.
- Add a documentation sync task for the private package entry point and
  public `src/index.ts` contract.
- Add JavaScript U+2028 and U+2029 source-span coverage before parser-backed
  diagnostics depend on original-source line mapping.
- Add a fixture-corpus support helper before hostile metadata and loader
  parity tests duplicate more fixture I/O code.
- Add fixture metadata generation or refresh tooling before the hostile
  metadata fixture expansion.
- Consider a focused source-file module split before the span mapper and parser
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
- `docs/issues/audit-1.3.1.md`
- `docs/issues/audit-1.3.2.md`
- `grepai` skill
- `leta` skill
- `code-review` skill
- `en-gb-oxendict-style` skill
- `sem`
