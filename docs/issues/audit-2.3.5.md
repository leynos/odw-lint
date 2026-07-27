# Audit after roadmap task 2.3.5

This post-step audit was run after roadmap task 2.3.5, "Consolidate fixture
corpus and parity projection ownership", squash-merged into `origin/main` at
commit `e388c33`. That change gave the trusted ODW-example corpus and the
deliberately-invalid workflow corpus dedicated owner modules
(`tests/static-analysis/fixtures/odw-examples/corpus.ts` and
`tests/static-analysis/fixtures/invalid-workflows/corpus.ts`), extracted a
shared manifest-to-comparison diagnostic projection into
`tests/static-analysis/fixtures/diagnostic-projection.ts`, migrated the parser,
envelope, metadata, and invalid-workflow-parity suites onto that projection,
and added an architecture guard
(`tests/static-analysis/fixture-corpus-ownership.test.ts`) that blocks new
inline corpus-location `new URL(...)` literals.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (branch `worktree-df12-audit-2.3.5`, base commit `e388c33`) with
targeted file inspection, `grep`, and Git entity history. `grepai` intent
search against the canonical `main` index was used to orient, but every finding
below is grounded in direct branch-local inspection because the changes are
almost entirely test-side and the `main` index reflects the pre-merge tree.

The 2.3.5 consolidation is sound where it reached: the parser, envelope,
metadata, and invalid-workflow-parity suites now share one projection helper,
and the two corpus owner modules are the single source of their fixture
locations. The findings below concentrate on where the consolidation stopped
short: one parity suite that was never migrated onto the shared projection, an
architecture guard whose scope does not enforce the projection rule it was
introduced alongside, and two smaller ergonomic and duplication residues in the
shared corpus support.

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
- `grepai`: canonical `main` intent search for orientation.
- Branch-local file inspection, `grep`, and Git entity history: source and
  entity-history verification.

## Finding 1: the dual-compat parity suite bypasses the shared diagnostic projection

Category: inconsistency

Severity: medium

Location:

- `tests/static-analysis/dual-compat-parity.test.ts:22`
- `tests/static-analysis/dual-compat-parity.test.ts:44`
- `tests/static-analysis/dual-compat-parity.test.ts:59`
- `docs/developers-guide.md:533`
- `tests/static-analysis/fixtures/diagnostic-projection.ts:71`

Description:

Task 2.3.5 extracted `tests/static-analysis/fixtures/diagnostic-projection.ts`
so that manifest-driven parity suites compare live and expected diagnostics
through one shape, and `docs/developers-guide.md:533` records the policy
plainly:

> Parser, envelope, and metadata parity suites must project manifest
> diagnostics through `tests/static-analysis/fixtures/diagnostic-projection.ts`.
> That module is the single manifest-to-comparison diagnostic contract […] do
> not add local comparable-diagnostic shapes in individual suites.

`dual-compat-parity.test.ts` is a manifest-driven deterministic-time parity
suite, yet it defines its own local comparable shape and its own live and
manifest projections rather than importing the shared helpers:

```ts
type ComparableDiagnostic = {
  readonly rule: string;
  readonly severity: Diagnostic["severity"];
  readonly message: string;
  readonly span: SourceSpan;
  readonly spanText: string;
};
```

```ts
const comparableLiveDiagnostics = (
  fixture: DualCompatFixtureSnapshot,
): readonly ComparableDiagnostic[] => {
  const result = lintDualCompatFixture(fixture);

  return result.diagnostics.map((diagnostic) => ({
    rule: String(diagnostic.rule),
    severity: diagnostic.severity,
    message: diagnostic.message,
    span: diagnostic.span,
    spanText: sliceSourceSpan(result.sourceFile, diagnostic.span),
  }));
};
```

This is exactly the drift the consolidation was meant to prevent: it is the
last local comparable-diagnostic shape in the static-analysis tests (a
repository-wide `grep` confirms `dual-compat-parity.test.ts` is the only
remaining suite that declares its own `Comparable*` type and projection).
`DualCompatFixtureDiagnostic`
(`tests/static-analysis/fixtures/dual-compat/manifest-types.ts:28`) is
structurally identical to `InvalidWorkflowFixtureDiagnostic` — the same `rule`,
`severity`, `message`, `docs`, `span`, and `spanText` fields the shared helper
already handles — so migration is available without any manifest changes.

The local shape also silently omits the `docs` (`RuleDocumentationPath`) field
that `ComparableFixtureDiagnostic`
(`tests/static-analysis/fixtures/diagnostic-projection.ts:33`) treats as
mandatory. Consequently the dual-compat deterministic-time parity assertions
never compare the emitted documentation path against the manifest, so a
regression in the `docs` path for `Date.now`, `Math.random`, or argless
`new Date` warnings would pass unnoticed here even though the invalid-workflow
parity suite would catch the equivalent regression. This is both a consistency
defect and a test-coverage gap.

Proposed fix:

Migrate `dual-compat-parity.test.ts` onto the shared projection: delete the
local `ComparableDiagnostic` type, `comparableLiveDiagnostics`, and
`comparableFixtureDiagnostics`, and replace them with
`liveDiagnosticToComparable(diagnostic, result.sourceFile)` and
`manifestDiagnosticToComparable(diagnostic)` as the other parity suites do. To
type the shared `manifestDiagnosticToComparable` for both manifest families
without importing an invalid-workflow-specific type into the dual-compat suite,
retype its parameter to a minimal structural input (for example a shared
`ManifestComparableInput` interface carrying `rule`, `severity`, `message`,
`docs`, `span`, and `spanText`) that both `InvalidWorkflowFixtureDiagnostic` and
`DualCompatFixtureDiagnostic` satisfy. This restores docs-path parity coverage
for deterministic-time warnings and removes the last local comparable shape.

## Finding 2: the corpus-ownership guard does not enforce the projection contract it shipped with

Category: separation-of-concerns

Severity: low

Location:

- `tests/static-analysis/fixture-corpus-ownership.test.ts:156`
- `docs/developers-guide.md:533`

Description:

Task 2.3.5 introduced two coupled contracts — a single corpus location per
corpus and a single diagnostic projection — but the architecture guard added to
lock them in only enforces the first. `fixture-corpus-ownership.test.ts`
inspects every static-analysis TypeScript file for inline `new URL(...)`
corpus-location literals and rejects them, but it has no assertion that parity
suites route diagnostics through `diagnostic-projection.ts`. The developers'
guide states both rules as policy ("do not add local comparable-diagnostic
shapes in individual suites"), yet only the corpus-location half is
machine-checked. Finding 1 is the direct consequence: a local comparable shape
persisted through the 2.3.5 merge with no guard to catch it, and a future suite
could reintroduce one just as easily.

Proposed fix:

Extend the ownership guard (or add a sibling architecture test) to detect local
comparable-diagnostic declarations in static-analysis parity suites — for
example, flag object-literal or type-alias shapes in `*-parity.test.ts` and
`*-fixtures.test.ts` files that carry the `spanText` field without originating
from `diagnostic-projection.ts`, allow-listing the projection module itself.
This makes the "single projection contract" rule enforceable rather than
convention-only, mirroring how the corpus-location rule is already guarded.

## Finding 3: `fixtureSourceUrl` strips the manifest root with an unanchored `String.replace`

Category: ergonomics

Severity: low

Location:

- `tests/static-analysis/fixtures/corpus-support.ts:60`

Description:

`fixtureSourceUrl` derives a corpus-relative path by stripping the manifest
root prefix:

```ts
const relativePath =
  corpus.manifestRoot === undefined ? fixturePath : fixturePath.replace(corpus.manifestRoot, "");
```

`String.prototype.replace` with a string pattern replaces only the first
occurrence and is not anchored to the start of the string. The helper is also
called in two modes across the suite — with a full manifest path
(`loader-parity.test.ts:243`) and with a bare filename
(`odw-example-fixtures.test.ts:60`) — and relies on `replace` silently being a
no-op when the prefix is absent. The current fixture paths are controlled, so
the behaviour is correct today, but the intent is prefix removal and the
implementation is a substring replacement: a fixture path that did not begin
with `manifestRoot`, or that contained the root string mid-path, would resolve
to a wrong or misleading URL with no error, which is awkward to debug from a
downstream `readFileSync` failure.

Proposed fix:

Anchor the strip to the prefix and fail loudly on a mismatch: when
`fixturePath.startsWith(corpus.manifestRoot)`, use
`fixturePath.slice(root.length)`, otherwise treat `fixturePath` as an
already-relative name (the bare-filename mode) explicitly rather than depending
on `replace` no-op semantics. A short comment naming the two accepted input
shapes would also make the dual-mode contract obvious at the call site.

## Finding 4: the two corpus owner modules duplicate a near-identical find-or-throw lookup

Category: duplication

Severity: low

Location:

- `tests/static-analysis/fixtures/odw-examples/corpus.ts:33`
- `tests/static-analysis/fixtures/invalid-workflows/corpus.ts:32`

Description:

`findOdwExampleFixture` and `findInvalidWorkflowFixture` are structurally the
same operation: linear-scan a frozen snapshot array by a query, return the
match, or throw a `Missing ...` error naming the query. They differ only in the
snapshot array, the query key (basename versus family plus basename), and the
error message. The two owner modules were created together in 2.3.5, so the
duplication is fresh rather than incidental.

Proposed fix:

Extract a shared generic lookup helper in `corpus-support.ts`, for example
`findFixtureSnapshot(snapshots, predicate, describeMissing)`, and express both
owner lookups in terms of it. The family-versus-basename difference collapses
into the predicate and the missing-fixture message stays with each owner, which
keeps the error text local while removing the repeated scan-and-throw scaffold.
This is a small, low-risk consolidation and should be weighed against leaving
two two-line lookups explicit; it is recorded for completeness rather than as a
pressing defect.

## Finding 5: the projection-contract policy in the developers' guide under-enumerates the suites it binds

Category: docs-gap

Severity: low

Location:

- `docs/developers-guide.md:533`

Description:

The guide's projection rule names "Parser, envelope, and metadata parity
suites" as the suites that must use `diagnostic-projection.ts`. Two other
manifest-driven parity suites emit and compare diagnostics — the
invalid-workflow merged-pipeline parity suite (already migrated) and the
dual-compat deterministic-time parity suite (Finding 1, not migrated) — but
neither is named. The narrow enumeration leaves genuine ambiguity about whether
deterministic-time and dual-compat parity are in scope, which is precisely the
gap that let Finding 1 read as acceptable. The `diagnostic-projection.ts`
module docstring repeats the same three-suite framing ("parser, envelope, and
metadata assertions").

Proposed fix:

Generalize the wording to "all manifest-driven diagnostic parity suites"
(covering parser, envelope, metadata, invalid-workflow, and dual-compat
deterministic-time), and update the module docstring to match, so the policy's
scope is unambiguous and future suites inherit it by default. Sequence this
after Finding 1 so the guide and the code describe the same reality.
