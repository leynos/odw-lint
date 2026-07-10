# Audit after roadmap task 2.3.3

This post-step audit was run after roadmap task 2.3.3, "Consume invalid fixture
manifests in dialect diagnostic tests", squash-merged into `origin/main` at
commit `fb2b73b`. That change added a shared invalid-workflow fixture corpus
module (`tests/static-analysis/fixtures/invalid-workflows/corpus.ts`) exporting
the `INVALID_WORKFLOW_FIXTURE_CORPUS` location constant and the
`findInvalidWorkflowFixture` lookup helper, removed the duplicated
`INVALID_FIXTURE_CORPUS` location literal from five test modules, deleted the
`workflow-body-parser.test.ts.snap` parser snapshot in favour of
manifest-driven parity assertions, and reconciled `docs/developers-guide.md` to
describe the manifest-driven fixture workflow.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (branch `worktree-df12-audit-2.3.3`, base commit `fb2b73b`) with
targeted file inspection, `grep`, and `git show` entity history.

The 2.3.3 change is a clean, net-positive consolidation: it centralized the
invalid-workflow corpus location that had been copied into five test files, and
replaced a brittle parser snapshot with assertions driven from the reviewed
manifest. The findings below concentrate on the follow-on consistency work the
change left behind — a parallel corpus location that did not receive the same
treatment, and a family of manifest-to-comparison projections that each test
still re-implements locally.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- Branch-local file inspection, `grep`, and `git show`: source and
  entity-history verification.

Tooling note: the `grepai` intent search and the `git`/`git-donkey`
write-backed commands (`fetch`, `worktree add`) were unavailable in this agent
session — each was auto-denied by the sandbox permission layer. The fresh
inspection worktree was therefore created with the harness `EnterWorktree`
mechanism off `origin/main`, and every finding below is grounded in direct
branch-local file inspection rather than the canonical `main` `grepai` index.

## Finding 1: the ODW-example corpus location is still copied inline across four test modules

Category: duplication

Severity: low

Location:

- `tests/static-analysis/workflow-body-parser.test.ts:58`
- `tests/static-analysis/workflow-envelope-fixtures.test.ts:18`
- `tests/static-analysis/deterministic-time-spans.test.ts:30`
- `tests/static-analysis/odw-example-fixtures.test.ts:16`

Description:

Task 2.3.3 removed the duplicated `INVALID_FIXTURE_CORPUS` location literal from
five modules and replaced it with the single exported
`INVALID_WORKFLOW_FIXTURE_CORPUS` constant in
`fixtures/invalid-workflows/corpus.ts`. The parallel ODW-example corpus did not
receive the same treatment: the fixture directory URL
`new URL("./fixtures/odw-examples/", import.meta.url)` is still constructed
inline in at least four test modules, twice as a bare `FIXTURE_DIRECTORY`
constant and once as an ad-hoc `ODW_EXAMPLE_CORPUS` object literal:

```ts
// workflow-envelope-fixtures.test.ts:18
const ODW_EXAMPLE_CORPUS = {
  fixtureDirectory: new URL("./fixtures/odw-examples/", import.meta.url),
} as const;
```

This is exactly the copied-location smell that 2.3.3 eliminated for the
invalid-workflow corpus, left standing for the sibling corpus. The
`odw-examples.ts` aggregate module already owns the ODW example snapshots, so it
is the natural home for the location constant, mirroring how
`invalid-workflows/corpus.ts` now owns the invalid-workflow location.

Proposed fix:

Export an `ODW_EXAMPLE_FIXTURE_CORPUS` (typed `satisfies FixtureCorpusLocation`)
from `tests/static-analysis/fixtures/odw-examples.ts` and import it in the four
consumers, deleting the inline `FIXTURE_DIRECTORY`/`ODW_EXAMPLE_CORPUS`
literals. This closes the same duplication class 2.3.3 addressed and keeps both
corpora's location contracts in one reviewed place each.

## Finding 2: manifest-to-comparison diagnostic projections are re-implemented per test module

Category: similarity

Severity: low

Location:

- `tests/static-analysis/workflow-body-parser.test.ts:120`
- `tests/static-analysis/workflow-metadata.test.ts:78`
- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts:76`
- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts:117`

Description:

Now that the invalid-workflow manifest is the shared source of expected
diagnostics, several tests must project a manifest
`InvalidWorkflowFixtureDiagnostic` into a comparison shape — re-stringifying the
branded `rule` with `String(...)` and selecting a subset of
`{ rule, severity, message, span, spanText, docs }`. That projection is
re-authored independently in each consumer:

- `expectedBodySyntaxDiagnosticFor` (body-parser) selects
  `{ rule, severity, message, span, docs }`.
- `expectedInvalidFixtureDiagnosticSummary` (metadata) selects
  `{ rule, severity, message, spanText }`.
- `comparableFixtureDiagnostics` and `comparableBodySyntaxDiagnostics` (parity)
  each select `{ rule, severity, message, span, spanText }`.

The shapes differ only in which fields each assertion needs, but the
`String(rule)`-and-pick contract is identical and now lives in four places. If
the manifest diagnostic type gains or renames a field, every copy must be
updated in lockstep, and nothing guarantees they stay aligned.

Proposed fix:

Add a small shared projection helper to
`fixtures/invalid-workflows/corpus.ts` (or `manifest-types.ts`) — for example
`comparableManifestDiagnostic(diagnostic)` returning the full stringified-rule
record, letting each caller pick the fields it asserts on. This gives the
manifest-to-comparison contract a single reviewed definition, matching the
"one expectation source" intent 2.3.3 established.

## Finding 3: `classifyInvalidFixture` and `classifyBodySyntaxFixture` duplicate the live-diagnostic mapping

Category: duplication

Severity: low

Location:

- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts:55`
- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts:94`

Description:

Within the parity suite, the two "classify" helpers that run the live pipeline
and the two "comparable" helpers that project the manifest are near-identical
pairs. `classifyInvalidFixture` and `classifyBodySyntaxFixture` differ only in
which diagnostic list they read (`result.diagnostics` filtered by
`TASK_2_1_3_RULES` versus `result.bodySyntax`) and both map to the same
`{ rule: String(...), severity, message, span, spanText }` record via
`sliceSourceSpan`. Likewise `comparableFixtureDiagnostics` (line 76) and
`comparableBodySyntaxDiagnostics` (line 117) differ only by their rule-set
filter. The duplicated mapping and status-derivation body invites the two
branches to drift.

Proposed fix:

Extract a single `toComparable(result, diagnostics)` mapper (and reuse
`statusFromDiagnostics`, which is already shared) so both the metadata/envelope
and body-syntax parity paths differ only in the diagnostic selector they pass
in. The two public test cases stay unchanged; only the private helper bodies
collapse to one.

## Finding 4: the syntax-error fixture count is asserted as a magic literal

Category: inconsistency

Severity: info

Location:

- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts:177`

Description:

The body-syntax parity case filters the manifest to the `syntax-error` family
and then asserts `expect(syntaxFixtures).toHaveLength(2)`. The literal `2`
encodes the current family size, so adding or removing a `syntax-error` fixture
silently breaks this assertion for a reason unrelated to the behaviour under
test, and the number carries no explanation of why two fixtures are required.
The sibling integrity suite (`invalid-workflow-fixtures.test.ts`) instead
cross-checks fixture counts against the on-disk corpus rather than a literal.

Proposed fix:

Either drop the fixed-count assertion (the `for` loop already iterates whatever
the family contains and asserts each entry) or derive the expected count from
the on-disk `syntax-error` directory via `copiedFixtureFileNames`, so the guard
tracks the corpus instead of a hand-maintained constant.

## Finding 5: `invalidFixture` local wrapper adds a thin positional re-labelling of the shared lookup

Category: ergonomics

Severity: info

Location:

- `tests/static-analysis/workflow-metadata.test.ts:65`

Description:

`workflow-metadata.test.ts` defines a private `invalidFixture(family, fileName)`
that does nothing but forward its two positional arguments into the shared
`findInvalidWorkflowFixture({ family, fileName })`. The wrapper trades the
shared helper's self-documenting object call for a positional one and adds a
second name for the same lookup, which slightly obscures that the module is
using the reviewed corpus contract. It is a minor readability cost, not a
defect.

Proposed fix:

Inline `findInvalidWorkflowFixture({ family, fileName })` at the single
remaining caller (`invalidFixtureSource`) and drop the wrapper, or keep the
wrapper but document why the positional form is preferred here. Either way the
module then references the shared lookup by its canonical name.

## Confirmation

No production (`src/`) code was implicated by this audit; all findings are
follow-on test-infrastructure consolidation opportunities localized to the
static-analysis fixture suites. No `TODO`, `FIXME`, `@ts-ignore`, or
`biome-ignore` markers were found in `src/` or `tests/`. The manifest-driven
parity surface, hostile-metadata passivity guards, and fixture SHA-256 and
existence checks all remain grounded in the reviewed manifest as 2.3.3
intended.
