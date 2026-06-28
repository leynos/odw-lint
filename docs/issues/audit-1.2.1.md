# Post-step audit after roadmap task 1.2.1

- Status: Proposed findings
- Scope: `origin/main` after roadmap task 1.2.1

This audit was run after the diagnostic contract spine landed. It used `grepai`
for canonical main-branch intent search, `leta` for branch-local symbol and
reference verification, and `sem` for entity-level history and blame.

## Finding 1: Diagnostic APIs are concentrated in one entry module

- Category: separation-of-concerns
- Severity: Medium
- Location: `src/index.ts:1`

`src/index.ts` is the public package entry point and currently owns domain
types, rule-id branding and parsing, summary counting, report envelope
creation, and text formatting. The file is still below the 400-line limit, but
it is already 348 lines before the parser, rule engine, CLI, and reporter
surface have been added.

This concentration makes the entry module a likely growth point for unrelated
responsibilities. It also makes later refactors harder because consumers import
every diagnostic helper through the same file.

Proposed fix:

- Keep `src/index.ts` as the explicit public re-export surface.
- Split implementation into focused modules such as:
  - `src/diagnostics/types.ts`;
  - `src/diagnostics/rule-id.ts`;
  - `src/diagnostics/report.ts`;
  - `src/diagnostics/text.ts`; and
  - `src/diagnostics/schema.ts`.
- Preserve the existing public API names through `src/index.ts`.
- Add package-entry tests proving consumers still import through `odw-lint`.

## Finding 2: Rule identifiers are copied into tests without a catalogue

- Category: inconsistency
- Severity: Medium
- Location: `docs/technical-design.md:321`, `tests/index.test.ts:29`

The rule taxonomy is documented in the technical design, and
`tests/index.test.ts` copies the same planned rule identifiers into
`documentedRuleIds`. Branch-local verification found no production rule
catalogue beyond the generic `RuleId` grammar helpers.

That duplication is acceptable for the first diagnostic-model slice, but it
will become fragile as rules start carrying default severities, docs URLs,
config keys, fix metadata, and suppression policy. A rule could be added to the
docs but missed by tests or implemented with a different default severity.

Proposed fix:

- Introduce a typed rule catalogue before the first real rule implementation.
- Store each rule's identifier, category, default severity, docs slug, and
  release status in one production module.
- Drive rule-id tests from the catalogue instead of a test-local tuple.
- Add a documentation parity test that checks the technical-design taxonomy, or
  generated rule docs, against the catalogue.

## Finding 3: The diagnostic JSON Schema repeats nested object shapes

- Category: duplication
- Severity: Low
- Location: `src/diagnostic-schema.ts:31`, `src/diagnostic-schema.ts:55`

The schema literal repeats the same non-negative integer shape for every
summary count and repeats the same source-position object under both
`span.start` and `span.end`.

The current copy is small, but source positions are a core invariant for
roadmap task 1.2.2. Repetition increases the chance that future schema changes
update one side of the span but not the other, especially when snippets,
display-width metadata, or richer fix spans are added.

Proposed fix:

- Extract local schema constants for summary counts, source positions, source
  spans, and suggestions.
- Keep those constants private to the schema module unless another module has
  a concrete need for them.
- Add tests asserting `span.start` and `span.end` share the same required keys
  and numeric minimums.

## Finding 4: Text diagnostics do not guard their one-line contract

- Category: ergonomics
- Severity: Medium
- Location: `src/index.ts:342`, `tests/index.test.ts:343`

`formatTextDiagnostics` promises stable one-line output, but it writes
`diagnostic.message` directly into the line. A parser or filesystem diagnostic
can reasonably contain a newline, carriage return, or tab copied from an
underlying error. That would split one diagnostic into multiple terminal lines
and make CI annotations or log parsing ambiguous.

The existing tests cover empty output, simple output, ordering, and snapshot
alignment with JSON reports, but they do not cover multi-line messages or
path/message sanitisation.

Proposed fix:

- Add a small formatter helper that normalizes control whitespace in text-only
  fields, while leaving JSON diagnostics unchanged.
- Add unit tests for newline, carriage-return, and tab handling in messages.
- Decide whether file paths should receive the same treatment, then document
  that text output is display-oriented while JSON output preserves exact
  strings.

## Finding 5: Report creation returns a borrowed diagnostics array

- Category: cqs
- Severity: Low
- Location: `src/index.ts:320`, `tests/index.test.ts:374`

`createDiagnosticReport` calculates summary counts and then stores
`input.diagnostics` directly on the returned report. The test suite currently
asserts that `report.diagnostics` is the same array reference as the caller's
array.

That behaviour is efficient, but it weakens the public API's apparent
immutability. A caller can pass a mutable array, receive a report with counts
for the original contents, mutate the array, and then observe a report whose
`diagnostics` no longer match `summary`.

Proposed fix:

- Prefer returning `diagnostics: [...input.diagnostics]` from
  `createDiagnosticReport`.
- Update the test to assert value equality and reference separation.
- If a borrowed view is intentional for performance, document that contract in
  the function JSDoc and add a test showing that callers must treat the array
  as immutable.

## Finding 6: Rule documentation links are specified before rule docs exist

- Category: docs-gap
- Severity: Low
- Location: `docs/technical-design.md:297`

The diagnostic contract example uses a rule documentation URL under
`docs/rules/meta-required.md`, and the `Diagnostic` type has an optional `docs`
field. There is no `docs/rules/` directory yet.

No implemented rule currently emits that link, so this is not a correctness
bug. It is a documentation gap to close before diagnostics start sending users
to rule-specific help.

Proposed fix:

- Add a `docs/rules/` index and a short rule-page template before the first
  shipped rule.
- Require each released rule catalogue entry to point at an existing rule
  document.
- Add a docs-link test once the rule catalogue exists.

## Proposed roadmap items

- Split the diagnostic contract into focused modules before adding parser and
  CLI responsibilities.
- Introduce a typed rule catalogue and rule-documentation parity checks before
  implementing the first real lint rule.
- Harden reporter contracts by normalizing one-line text output and decoupling
  report envelopes from caller-owned diagnostic arrays.

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
- `grepai` skill
- `leta` skill
- `sem` skill
- `code-review` skill
- `biome-typescript` skill
- `commit-message` skill
