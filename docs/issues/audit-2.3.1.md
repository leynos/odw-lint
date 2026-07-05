# Audit after roadmap task 2.3.1

This post-step audit was run after roadmap task 2.3.1 (`Add a minimal
loader-parity harness against trusted ODW example workflows`) merged into
`origin/main`. The 2.3.1 work landed as commit `413da83` (`Add loader-parity
harness`); the audit worktree was created off `origin/main` at that commit,
which is the current integration head.

The audit used `grepai` against the canonical `main` index for intent search,
then verified every branch-local fact in a fresh worktree off `origin/main`
with targeted file inspection and exact text search. Where a claim depends on
prior roadmap history, `docs/roadmap.md` in the audited tree was consulted
directly.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta` / targeted inspection: branch-local symbol and source navigation.

## Summary

The 2.3.1 loader-parity harness is well built. It drives only the public
`odw-lint` static pipeline, keeps fixture source passive, proves the hostile
metadata fixtures never set their global side-effect marker, and asserts the
harness carries no executable ODW import edges. The reducer in
`tests/static-analysis/fixtures/loader-parity.ts` is small, table-driven, and
faithfully documented, and the change is mirrored in the developers guide. No
behavioural defect was found in the 2.3.1 change.

The findings below are duplication, dead-code, ergonomic, and coverage issues
surfaced by the audit. The most material is that the new harness re-declares an
invalid-fixture corpus location inline even though a dedicated owner module
(`fixtures/invalid-workflows/corpus.ts`) already exists to hold exactly that
constant, and that the trusted ODW-example corpus location — which has no owner
module at all — is now duplicated across six test modules. None of the findings
are behavioural defects.

## Finding 1: Loader-parity harness re-declares the invalid-fixture corpus location

Category: inconsistency (duplication)

Severity: medium

Location:

- `tests/static-analysis/loader-parity.test.ts:23` (`INVALID_FIXTURE_CORPUS`)
- `tests/static-analysis/fixtures/invalid-workflows/corpus.ts:20` (the owner
  `INVALID_WORKFLOW_FIXTURE_CORPUS`)

Description: `fixtures/invalid-workflows/corpus.ts` states in its file header
that it "owns the test-only location and lookup contract for deliberately
invalid workflow fixtures" and exports `INVALID_WORKFLOW_FIXTURE_CORPUS` with
`fixtureDirectory`, `manifestRoot`, and `recursive: true`. The 2.3.1 harness
does not import that owner; instead `loader-parity.test.ts` defines its own
`INVALID_FIXTURE_CORPUS` literal with the identical `manifestRoot`
(`tests/static-analysis/fixtures/invalid-workflows/`) and `recursive: true`
policy. The two definitions can now drift — for example, if the corpus were
relocated, the owner constant would update but the harness copy would silently
keep resolving against the old root. This is a separation-of-ownership breach
introduced by 2.3.1.

Proposed fix: delete the inline `INVALID_FIXTURE_CORPUS` object in
`loader-parity.test.ts` and import `INVALID_WORKFLOW_FIXTURE_CORPUS` from
`./fixtures/invalid-workflows/corpus`, using it as the single source of the
invalid-fixture directory, manifest root, and traversal policy.

## Finding 2: Trusted ODW-example corpus location is duplicated across six modules

Category: duplication

Severity: medium

Location:

- `tests/static-analysis/loader-parity.test.ts:20`
- `tests/static-analysis/odw-example-fixtures.test.ts:16`
- `tests/static-analysis/workflow-body-parser.test.ts:58`
- `tests/static-analysis/workflow-envelope-fixtures.test.ts:19`
- `tests/static-analysis/deterministic-time-spans.test.ts:31`
- `tests/static-analysis/fixtures/odw-examples.ts:18` (the manifest-root and
  upstream-root string constants)

Description: The invalid-workflow corpus has a dedicated owner module
(`fixtures/invalid-workflows/corpus.ts`), but the trusted ODW-example corpus has
none. Every consumer re-declares `new URL("./fixtures/odw-examples/",
import.meta.url)` inline, and several also re-declare the
`tests/static-analysis/fixtures/odw-examples` manifest root and the
`open-dynamic-workflows/examples` upstream root as their own local constants
(`odw-example-fixtures.test.ts:17-18`, `odw-examples.ts:18-19`). Task 2.3.1's
`loader-parity.test.ts` adds the newest copy. The asymmetry with the invalid
corpus is itself an inconsistency, and the repeated literal is a maintenance
hazard.

Proposed fix: add `tests/static-analysis/fixtures/odw-examples/corpus.ts` that
exports an `ODW_EXAMPLE_FIXTURE_CORPUS` (`FixtureCorpusLocation`) plus the
shared manifest-root and upstream-root constants, mirroring the invalid-workflow
corpus owner. Point the loader-parity harness and the other consumers at that
module so the directory and root strings are declared once.

## Finding 3: `expectedErrorOutcome` helper is exported but never used

Category: complexity (dead code)

Severity: low

Location:

- `tests/static-analysis/fixtures/loader-parity.ts:71`

Description: The 2.3.1 harness exports `expectedErrorOutcome(ruleClasses)`,
which builds an error-status `LoaderParityOutcome` and throws when given an
empty rule-class list. No module in the repository references it — the
loader-parity suite asserts error fixtures with `expectedInvalidFixtureOutcome`
and inline expectations instead. The dead export widens the harness surface,
carries its own throw contract, and invites readers to assume a caller exists.

Proposed fix: either remove `expectedErrorOutcome` and its
`uniqueSortedStrings` usage if it is genuinely unused, or wire it into the
"error invalid fixtures" assertion block so the exported contract is exercised.
Removal is preferred unless a near-term parity step (2.3.2–2.3.4) is expected to
consume it.

## Finding 4: Harness self-scan list is a hand-maintained file manifest

Category: ergonomics (maintenance hazard)

Severity: low

Location:

- `tests/static-analysis/loader-parity.test.ts:28` (`HARNESS_SOURCE_FILES`)

Description: The inertness test "keeps the harness free of executable ODW import
edges" iterates a hardcoded six-entry `HARNESS_SOURCE_FILES` array, each entry
pairing a repository-relative path with a matching `import.meta.url` URL. If a
future harness helper module is added (or one is renamed), the guard will keep
passing while silently not scanning the new file, so a forbidden dynamic ODW
import could slip in unobserved. The paired path/URL entries are also redundant,
inviting copy-paste divergence.

Proposed fix: derive the scanned set from the harness directory (for example,
enumerate the `fixtures/loader-parity*.ts` and corpus helper modules via
`readdirSync`), or add a companion assertion that `HARNESS_SOURCE_FILES` matches
the actual set of harness helper modules on disk, so a new helper cannot escape
the import-edge scan.

## Finding 5: Parity diagnostic `rule` is typed `unknown` and stringly coerced

Category: ergonomics (loose typing)

Severity: low

Location:

- `tests/static-analysis/fixtures/loader-parity.ts:36`, `:169` (the
  `ParityDiagnostic.rule` type and its `String(diagnostic.rule)` reduction)

Description: The reducer models each diagnostic as `{ severity; rule: unknown }`
and derives rule classes with `String(diagnostic.rule)`. Both real inputs — the
live `Diagnostic.rule` (`src/diagnostics/types.ts:56`) and the manifest
`InvalidWorkflowFixtureDiagnostic.rule` (`manifest-types.ts:37`) — are already
the branded `RuleId` string type, so the `unknown` widening discards available
type safety. Worse, `String(...)` masks defects: a missing or malformed rule
would be coerced to `"undefined"` (or `"[object Object]"`) and silently sorted
into `ruleClasses` rather than surfacing a type error.

Proposed fix: type `ParityDiagnostic.rule` (and the `uniqueSortedRules`
parameter) as `RuleId` — the shared branded type both callers already produce —
and drop the `String()` coercion, or narrow with an explicit guard that fails
loudly on a non-string rule.

## Finding 6: Reducer info/hint filtering is untested

Category: test-gap

Severity: low

Location:

- `tests/static-analysis/fixtures/loader-parity.ts:106` (severity table)
- `tests/static-analysis/loader-parity.test.ts:103` (reducer suite)

Description: `STATUS_BY_DIAGNOSTIC_SEVERITY` maps `info` and `hint` severities
to `no-error`, and `isParityDiagnostic` uses that table to exclude such
diagnostics from both `status` and `ruleClasses`. The reducer suite exercises
only `warning` and `error` severities; no test feeds an `info`- or
`hint`-severity diagnostic to prove it is filtered out. A regression that
promoted `hint` into a parity-relevant status would pass the current suite.

Proposed fix: add a reducer-level test that passes an `info`- or `hint`-severity
diagnostic through `loaderParityOutcome` (via the inline `workflowSource`
helper, or a direct reducer input) and asserts a `no-error` status with empty
`ruleClasses` and `dialectErrorRules`.
