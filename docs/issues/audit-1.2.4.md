# Post-step audit after roadmap task 1.2.4

- Status: Proposed findings
- Scope: `origin/main` inspected from the `df12-audit-1.2.4`
  git-donkey worktree

This audit was run after the source-file helper split landed on `origin/main`.
It used `grepai` for canonical main-branch intent search, `leta` for
branch-local symbol and file verification, and `sem` for entity-level history
and blame.

## Finding 1: Package-entry documentation is narrower than the entry point

- Category: docs-gap
- Severity: Medium
- Location: `src/index.ts:1`, `docs/developers-guide.md:24`

The package entry file still opens with "Public diagnostic contract for ODW
static-analysis results", but the same module now exports diagnostic helpers
and the source-span/static-analysis helpers. The developer guide also says the
1.1.1 scaffold exports only the boundary identifier, workflow source shape,
component labels, and stage labels, even though the package entry now exposes
`createOriginalSourceFile`, source-position helpers, slicing helpers, snippet
helpers, and source-span types.

That mismatch makes the public surface harder to review. The code is not
wrong, but a future contributor could read the entry documentation and assume
source-span exports are accidental or private.

Proposed fix:

- Update the `src/index.ts` file JSDoc to describe the combined public static
  analysis contract: diagnostic reporting plus original-source helpers.
- Update the developer guide's static-analysis boundary section so it reflects
  the current exported helper surface and the modules that own it.
- Add or extend an architecture test that checks the documented public helper
  list against the package entry so future exports cannot drift silently.

## Finding 2: JavaScript line separators are still outside source spans

- Category: test-gap
- Severity: Medium
- Location: `src/static-analysis/source-scan.ts:143`,
  `tests/static-analysis/source-file-position-cases.ts:23`

The scanner and property-test oracle both treat only LF and CR as line
terminators. Fixture cases cover LF, CRLF, CR, BMP Unicode, non-BMP Unicode,
and trailing newlines, but they do not cover U+2028 line separator or U+2029
paragraph separator. The roadmap already records addendum 1.2.2.5 for this
gap, and task 1.2.4 deliberately preserved the current behaviour.

This should still be kept visible because later parser-backed diagnostics will
map JavaScript parser spans back to original source. If the parser treats
U+2028 or U+2029 as line terminators while `odw-lint` source spans do not,
diagnostics can point at the wrong line and column for uncommon but valid
JavaScript workflow source.

Proposed fix:

- Extend the source scanner's line-terminator predicate to cover U+2028 and
  U+2029 while preserving CRLF as a single display line break.
- Add source-position, source-span, snippet, and property-oracle cases for
  U+2028 and U+2029.
- Add a small parser-adapter regression once SWC span mapping exists, so the
  source mapper and JavaScript parser agree on these separators.

## Finding 3: Fixture corpus tests repeat file-list helper logic

- Category: duplication
- Severity: Low
- Location: `tests/static-analysis/odw-example-fixtures.test.ts:32`,
  `tests/static-analysis/masking-fixtures.test.ts:35`,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts:76`

The ODW example, masking, and invalid workflow fixture tests each define their
own `copiedFixtureFileNames` helper. Two are identical flat-directory `.js`
filters, while the invalid workflow variant differs only because it reads
fixture families recursively. Nearby tests also repeat the same manifest
patterns for sorted filenames, SHA-256 hash checks, passive source reads, and
frozen diagnostic arrays.

The duplication is currently tolerable, but the fixture corpus is growing and
loader-parity tests will reuse the same concepts. Repeating the mechanics in
every corpus test makes future changes to path sorting, hash validation, or
raw-source safety more error-prone.

Proposed fix:

- Extract test-only fixture-corpus helpers for listing `.js` fixtures, sorting
  flat and family-based manifests, hashing source text, and reading passive
  source text.
- Keep domain-specific assertions in each corpus test so fixture intent stays
  visible.
- Add helper tests where the helper owns non-trivial behaviour, especially
  recursive family ordering.

## Finding 4: Invalid workflow manifest is close to the file-size limit

- Category: ergonomics
- Severity: Medium
- Location: `tests/static-analysis/fixtures/invalid-workflows.ts:131`

`tests/static-analysis/fixtures/invalid-workflows.ts` now contains the
manifest types, path builder, diagnostic builder, and every invalid workflow
snapshot in one 386-line file. The project convention caps source files at 400
lines, so one or two additional invalid fixtures can push the manifest over
the limit. The repeated inline diagnostic objects also make reviews noisy
because each new case changes many low-level span fields in one dense file.

This is a maintainability issue rather than a runtime bug. It matters because
future tasks will add more parser and metadata coverage, exactly where this
manifest is likely to grow.

Proposed fix:

- Split invalid workflow manifests by fixture family, with a small index file
  that exports the combined sorted manifest.
- Keep the shared `InvalidWorkflowFixtureSnapshot` and diagnostic construction
  helpers in one test fixture support module.
- Prefer generated or builder-assisted span metadata once roadmap task 1.3.5
  lands, so fixture updates review at the level of source intent rather than
  repeated object boilerplate.

## Finding 5: Source-scan exports an unused byte-length helper

- Category: ergonomics
- Severity: Low
- Location: `src/static-analysis/source-scan.ts:12`,
  `src/static-analysis/source-scan.ts:118`

`source-scan.ts` exports `utf8ByteLength`, backed by a module-level
`TEXT_ENCODER`, but branch-local reference checks found no callers outside the
definition itself. The scanner computes byte offsets incrementally with
`utf8ByteLengthForCodePoint`, so the TextEncoder helper is not part of the
current scan path. It is also not re-exported from the static-analysis public
facade.

The unused export is small, but it makes the internal helper surface wider than
the current source-position contract needs. It can also confuse future parser
span-mapping work about which byte-length primitive is the canonical one.

Proposed fix:

- Remove `utf8ByteLength` and `TEXT_ENCODER` if no near-term parser adapter
  needs them.
- If parser span mapping does need whole-string byte-length checks, make the
  intended ownership explicit in `source-scan.ts` and add direct tests for that
  helper.
- Keep `utf8ByteLengthForCodePoint` private to the scan implementation unless
  another module needs a documented internal contract.

## Proposed roadmap items

- Synchronize package-entry and developer-guide documentation with the current
  public static-analysis helper surface.
- Add JavaScript U+2028 and U+2029 source-span coverage before parser-backed
  diagnostics rely on source line mapping.
- Extract fixture-corpus support helpers before loader-parity and generated
  metadata refresh tooling reuse the same manifest mechanics.
- Split invalid workflow fixture manifests by family before the next invalid
  parser or metadata fixture batch grows the file past the project limit.
- Remove or explicitly justify the unused source-scan byte-length helper before
  parser span-mapping work expands the source helper surface.

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
- `leta` skill
- `sem` skill
- `code-review` skill
