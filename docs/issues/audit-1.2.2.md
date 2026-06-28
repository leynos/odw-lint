# Post-step audit after roadmap task 1.2.2

- Status: Proposed findings
- Scope: `origin/main` inspected from the `audit-1.2.2` git-donkey worktree

This audit was run after the original source span helpers landed on
`origin/main`. It used `grepai` for canonical main-branch intent search,
`leta` for branch-local symbol, reference, and call-graph verification, and
`sem` for entity-level history and blame.

## Finding 1: Source records look structural but require hidden indexes

- Category: ergonomics
- Severity: Medium
- Location: `src/static-analysis/types.ts:46`,
  `src/static-analysis/source-file.ts:19`,
  `src/static-analysis/source-file.ts:315`

`OriginalSourceFile` is exported as an ordinary structural TypeScript type, and
tests use plain object literals that `satisfies OriginalSourceFile`. However,
the exported helpers `positionAtOffset`, `spanFromOffsets`, `sliceSourceSpan`,
and `snippetForSpan` only work when the value was created by
`createOriginalSourceFile`, because their UTF-16 index lookup lives in the
private `SOURCE_INDEXES` weak map.

That makes the API awkward at the public package boundary. A caller can create
an object that type-checks as `OriginalSourceFile`, pass it to
`positionAtOffset`, and receive a runtime `SourceOffsetError` saying the file
was not created by `createOriginalSourceFile`. The invariant is real, but the
type does not communicate it.

Proposed fix:

- Make the construction requirement visible in the API contract before parser
  and CLI code start passing source records around.
- Prefer one of:
  - store the required lookup data in an internal, non-exported wrapper and
    expose source metadata through a read-only accessor shape; or
  - make `OriginalSourceFile` nominal with an unexported brand and keep all
    construction behind `createOriginalSourceFile`; or
  - remove the hidden weak-map requirement by deriving validated text indexes
    from public line metadata when slicing.
- Add a focused test showing that external structural construction is either
  impossible at compile time or explicitly rejected with documented guidance.

## Finding 2: Source text is scanned twice with matching state machines

- Category: duplication
- Severity: Medium
- Location: `src/static-analysis/source-file.ts:145`,
  `src/static-analysis/source-file.ts:201`

`createOriginalSourceFile` calls `buildSourceLines` and `buildSourceIndexes`.
Both helpers walk the same source text, track byte offsets, UTF-16 indexes,
line numbers, columns, Unicode code points, and CRLF handling, and call the
same line-terminator predicates. The details are currently aligned, and the
property tests are strong, but the production implementation now has two
places where newline or Unicode semantics can drift.

This is different from the independent property oracle in
`tests/static-analysis/source-file-property-oracle.ts`, where duplication is
intentional because the tests need an independently derived expectation. The
production module can keep one source scanner without weakening those tests.

Proposed fix:

- Replace the two production passes with one private scan that returns the
  public `SourceLine[]` plus the private offset-to-position and
  offset-to-index maps.
- Keep the independent test oracle separate so it remains a genuine
  cross-check rather than sharing production logic.
- Add one regression test around CRLF plus multibyte Unicode after the
  refactor to prove the merged scanner preserves the current boundary
  behaviour.

## Finding 3: Exported source-span helpers lack usage examples

- Category: docs-gap
- Severity: Low
- Location: `src/static-analysis/source-file.ts:28`,
  `src/static-analysis/source-file.ts:53`,
  `src/static-analysis/source-file.ts:73`,
  `src/static-analysis/source-file.ts:99`,
  `src/static-analysis/source-file.ts:116`

The project guidance says function documentation should include clear examples
demonstrating usage and outcome. The newly exported source-span helpers have
good parameter and error documentation, but no examples. That leaves future
parser and reporter contributors to infer half-open UTF-8 byte spans,
one-based display positions, and the `createOriginalSourceFile` construction
requirement from tests instead of from the API comments.

The gap matters because these helpers are exported through `src/index.ts` and
are the basis for all future diagnostic spans. Misusing them would create
wrong source locations rather than a local implementation detail.

Proposed fix:

- Add compact JSDoc examples for `createOriginalSourceFile`,
  `positionAtOffset`, `spanFromOffsets`, `sliceSourceSpan`, and
  `snippetForSpan`.
- Show at least one LF example and one Unicode byte-offset example so callers
  see the distinction between UTF-8 offsets and display columns.
- Add a short developer-guide note that source spans are half-open UTF-8 byte
  ranges into original, pre-normalized workflow source.

## Finding 4: Source-file property tests repeat generated setup

- Category: duplication
- Severity: Low
- Location: `tests/static-analysis/source-file.property.test.ts:26`,
  `tests/static-analysis/source-file.property.test.ts:49`,
  `tests/static-analysis/source-file.property.test.ts:73`,
  `tests/static-analysis/source-file.property.test.ts:95`,
  `tests/static-analysis/source-file.property.test.ts:121`,
  `tests/static-analysis/source-file.property.test.ts:153`,
  `tests/static-analysis/source-file.property.test.ts:184`

Each property test repeats the same four `fc.constantFrom(...SOURCE_SEGMENTS)`
arbitraries, concatenates `first`, `second`, `third`, and `fourth`, and creates
the same `workflows/generated.js` source record. The repetition is not a
correctness bug, but it makes future property cases noisier and increases the
chance that a new case uses a slightly different generation shape by mistake.

The independent oracle should remain independent from production code. The
repetition to remove is only test harness setup.

Proposed fix:

- Add a small test helper such as `generatedSourceTextArbitrary()` or
  `withGeneratedSourceFile` that centralizes the four-segment source
  generation and source-record construction.
- Keep each property body focused on the invariant it asserts.
- Preserve the deterministic `SOURCE_SPAN_PROPERTY_RUNNER` settings so
  failures stay reproducible.

## Proposed roadmap items

- Clarify the `OriginalSourceFile` construction contract before parser,
  mapper, and reporter work depend on source records across module
  boundaries.
- Refactor the production source scanner to build line metadata and lookup
  indexes in one pass while keeping the independent property oracle separate.
- Add source-span helper examples and a developer-guide note before the first
  parser-backed diagnostic spans ship.
- Clean up source-file property-test harness repetition as a low-risk follow-up
  when the source-span module is next touched.

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
- `docs/issues/audit-1.2.3.md`
- `docs/issues/audit-1.3.1.md`
- `grepai` skill
- `leta` skill
- `sem` skill
- `code-review` skill
- `df12-build-supervisor` skill
- `en-gb-oxendict-style` skill
- `commit-message` skill
