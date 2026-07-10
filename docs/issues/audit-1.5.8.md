# Audit after roadmap task 1.5.8

This post-step audit was run after roadmap task 1.5.8, "Derive reviewer
availability from harness state", merged into `origin/main`. The audit
inspected the freshly merged review-evidence availability code and swept the
static-analysis source masking family for structural issues.

Normative references used:

- `AGENTS.md`
- `docs/technical-design.md`
- `docs/developers-guide.md`
- `docs/scripting-standards.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/contents.md`
- `docs/repository-layout.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `leta` / direct file inspection: branch-local symbol and source navigation.
- `en-gb-oxendict`: Oxford British documentation prose.
- `commit-message`: file-based commit workflow.

Tooling note: `grepai` and direct `git worktree` / `git-donkey` commands were
permission-gated in this agent session, so every finding below is grounded in
direct branch-local file inspection within the audit worktree rather than the
canonical `main` index.

## Finding 1: Identifier-run scanning is duplicated across masking modules

Category: similarity

Severity: medium

Location:

- `src/static-analysis/source-mask.ts:126`
- `src/static-analysis/source-mask-templates.ts:189`
- `src/static-analysis/source-mask-regex.ts:333`

Three modules independently walk a run of identifier characters using the same
`/[A-Za-z0-9_$]/u` character class. `significantTokenEndingAt` and
`previousSignificantTemplateToken` both scan backwards
(`while (cursor >= 0 && /[A-Za-z0-9_$]/u.test(...)) cursor -= 1`) then slice the
token, while `scanRegexFlagsEnd` scans the same class forwards. The three copies
must stay in lockstep if the identifier alphabet ever changes (for example to
admit Unicode identifier parts), but nothing enforces that today.

Proposed fix:

Extract a shared helper module exposing `identifierRunStart(sourceText, index)`
and `identifierRunEnd(sourceText, index)` (or a single directional
`scanIdentifierRun`) owning the `/[A-Za-z0-9_$]/u` contract, and have all three
call sites delegate to it. Keep the token-slicing and token-classification
concerns in the callers.

## Finding 2: Escape-aware delimiter walk is near-duplicated

Category: similarity

Severity: low

Location:

- `src/static-analysis/source-mask-delimiters.ts:66`
- `src/static-analysis/source-mask-strings.ts:47`

`scanEscapedDelimitedEnd` and `scanQuotedStringEnd` share the same skeleton:
walk from `startIndex + 1`, treat `\\` as an escape that advances past the
next character, return `index + 1` on the closing delimiter, and fall back to
`sourceText.length` when unterminated. `scanQuotedStringEnd` adds two behaviours
the shared helper lacks: it terminates at an unescaped line terminator and it
treats `\` followed by CRLF as a three-character line continuation. The escape
walk is therefore reimplemented rather than parameterized.

Proposed fix:

Parameterize the shared walk in `source-mask-delimiters.ts` with an optional
"stop on line terminator" predicate and an escape-advance function, then have
`scanQuotedStringEnd` supply the line-terminator and CRLF-continuation rules.
This keeps the single escape-handling contract that the module header already
promises.

## Finding 3: Two error-signalling conventions coexist in review-evidence

Category: inconsistency

Severity: low

Location:

- `tests/build-gate/review-evidence-availability.ts:45`
- `tests/build-gate/review-evidence-availability.ts:59`
- `tests/build-gate/review-evidence-cli.ts:203`

`parseAvailabilityValue` returns a tagged discriminated union
(`{ ok: true; value } | { ok: false; usageError }`), but the sibling functions
added and used in the same feature — `deriveHarnessPathAvailability`,
`parseCliArg`, `parseAvailabilityFlag`, `parseGateTimeoutMs`, and
`parseEnvironmentGateTimeoutMs` — signal failure with an untagged
`Value | string` union where a bare `string` means "usage error". The untagged
convention forces `typeof x === "string"` discrimination at every call site and
only works because the success values happen to be objects or numbers; it is
also awkward enough to require a double guard in the property test
(`expect(typeof derived).not.toBe("string")` followed by an
`if (typeof derived === "string") return`).

Proposed fix:

Standardize the review-evidence feature on the tagged `{ ok }` result shape
(or a shared `Parsed<T>` helper type), so failure discrimination is explicit and
cannot be confused with a legitimately string-typed success value.

## Finding 4: `deriveHarnessPathAvailability` unit coverage is thin

Category: test-gap

Severity: medium

Location:

- `tests/build-gate/review-evidence-availability.test.ts:76`

The only module-level test for `deriveHarnessPathAvailability` is a property
test that generates exclusively valid availability values and asserts a single
invariant: that a non-`available` scrutineer environment never yields a
scrutineer primary. It never asserts the positive mapping (for example that
`ODW_LINT_REVIEW_CODERABBIT=available` derives `coderabbit: "available"`), never
exercises the `local-self-run` environment override, and never drives the
invalid-value branch that returns a usage-error string (that branch is covered
only indirectly through one CLI test).

Proposed fix:

Add table-driven unit cases asserting the exact derived facts for each
environment variable individually and in combination, plus a case proving that
an invalid environment value returns the expected usage-error string directly
from `deriveHarnessPathAvailability`.

## Finding 5: `setPathAvailability` immutability is not asserted

Category: test-gap

Severity: low

Location:

- `tests/build-gate/review-evidence-availability.test.ts:56`

The `setPathAvailability` test confirms that the returned facts update only the
targeted path and leave sibling paths unchanged, but it never asserts that the
input facts object is left unmutated. `setPathAvailability` is written to return
a fresh object via spread, yet nothing in the suite would catch a regression to
in-place mutation of the caller's facts.

Proposed fix:

Extend the test to snapshot the input object before the call and assert it is
unchanged afterwards (and, ideally, that the result is a distinct reference), so
the copy-on-write contract is protected.

## Finding 6: `repository-layout.md` omits the review-evidence module cluster

Category: docs-gap

Severity: low

Location:

- `docs/repository-layout.md:131`

The `tests/build-gate/` section documents the shared command-runner seam
(`git-support.ts`) and the CLI writer seam (`cli-support.ts`) but never names
the review-evidence module cluster that now implements the reviewer-run audit
gate: `review-evidence.ts` (pure classification), `review-evidence-availability`
(harness derivation), `review-evidence-cli.ts` (execution and flag parsing), and
`review-evidence-report.ts` (report formatting). A reader mapping the gate to
its files has no pointer.

Proposed fix:

Add a short paragraph after the existing build-gate seam description naming the
four review-evidence modules and their respective roles, mirroring the
"keep feature-specific policy in the corresponding gate module" guidance already
in the developers' guide.

## Finding 7: `textIndexAtByteOffset` recomputes the next index each iteration

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/workflow-body-parser.ts:313`

Inside the scan loop, `nextCharacterIndex(sourceText, index)` is evaluated twice
per character — once as the `for` step expression and again inside the
`byteLength(sourceText.slice(index, nextCharacterIndex(...)))` call — and each
character's byte length is measured by allocating a one-character slice and
encoding it. The lookup is linear per call (not quadratic), but the duplicated
character-boundary computation and per-character encoder allocation are
avoidable overhead on a routine that may be called once per diagnostic offset.

Proposed fix:

Compute the next character index once per iteration into a local, reuse it for
both the byte-length span and the loop advance, and consider measuring a single
character's UTF-8 length directly rather than slicing and encoding.

## Proposed roadmap items

Adding items to the roadmap is reserved to the root agent; the following are
proposals only.

### Consolidate identifier and delimiter scanning helpers

Rationale: the masking family reimplements the identifier-run walk in three
modules (Finding 1) and the escape-aware delimiter walk in two (Finding 2).
Centralizing both into `source-mask-delimiters.ts` (or a dedicated scan-helper
module) removes the risk of the copies drifting when the identifier alphabet or
escape rules change, and it is a low-risk, test-backed refactor.

Severity: medium

### Standardize review-evidence error signalling on a tagged result

Rationale: the review-evidence feature mixes a tagged `{ ok }` result with an
untagged `Value | string` failure convention (Finding 3). Converging on one
result shape removes fragile `typeof === "string"` discrimination and makes the
CLI parsing pipeline safer to extend with new option types.

Severity: low

### Harden reviewer-availability unit coverage

Rationale: `deriveHarnessPathAvailability` and `setPathAvailability` are the
trust-critical core of harness-derived review selection, yet their positive
mappings, environment precedence, invalid-value handling, and immutability are
only partially asserted (Findings 4 and 5). Filling these gaps protects the
"quota-blocked review cannot be silently substituted" guarantee.

Severity: low
