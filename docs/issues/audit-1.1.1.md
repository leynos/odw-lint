# Post-step audit after roadmap task 1.1.1

- Status: Proposed findings
- Scope: `origin/main` inspected from the `audit-1.1.1` git-donkey worktree

This audit was run after the owned static-analysis boundary had landed on
`origin/main`. It used `grepai` for canonical main-branch intent search,
`leta` for branch-local symbol, reference, and call-graph verification, and
`sem` for entity-level history and blame.

## Finding 1: Public diagnostic APIs are concentrated in the entry module

- Category: separation-of-concerns
- Severity: Medium
- Location: `src/index.ts:1`

`src/index.ts` is both the package entry point and the implementation module
for diagnostic domain types, rule-id parsing, report construction, text
formatting, static-analysis re-exports, and constants. Branch-local inspection
showed the file is already 358 lines, leaving little room under the 400-line
file-size limit before parser, rule-engine, reporter, and command work arrive.

This concentration makes unrelated diagnostic responsibilities harder to review
independently, and it increases the chance that future implementation logic
lands directly in the public entry point.

Proposed fix:

- Keep `src/index.ts` as the explicit public re-export surface.
- Move implementation into focused internal modules, such as
  `src/diagnostics/types.ts`, `src/diagnostics/rule-id.ts`,
  `src/diagnostics/report.ts`, `src/diagnostics/text.ts`, and
  `src/diagnostics/schema.ts`.
- Preserve current public names through `src/index.ts`.
- Add package-entry tests proving consumers still import through `odw-lint`.

## Finding 2: The diagnostic contract test file exceeds the size limit

- Category: complexity
- Severity: Medium
- Location: `tests/index.test.ts:1`

`tests/index.test.ts` is 431 lines and covers rule-id grammar, diagnostic
types, summary counting, JSON Schema shape, text formatting, and
static-analysis boundary exports in one file. That exceeds the project rule
that no single code file should exceed 400 lines, and it mixes several
behavioural contracts that will grow along separate roadmap paths.

The file is still understandable, but it has become a review bottleneck. Adding
source-span helpers, rule catalogues, parser fixtures, or CLI reporter tests
will make it harder to find the relevant contract and will produce broader
diffs than necessary.

Proposed fix:

- Split the suite into focused files, for example
  `tests/rule-id.test.ts`, `tests/diagnostic-report.test.ts`,
  `tests/diagnostic-schema.test.ts`, `tests/text-diagnostics.test.ts`, and
  `tests/static-analysis-boundary.test.ts`.
- Move shared diagnostic fixtures into a small test helper only after at least
  two suites need the same helper.
- Keep the package-entry import path in each suite so self-reference remains
  covered.

## Finding 3: Text diagnostics do not protect the one-line output contract

- Category: ergonomics
- Severity: Medium
- Location: `src/index.ts:352`

`formatTextDiagnostics` advertises stable one-line output, but it interpolates
`diagnostic.file`, `diagnostic.rule`, and `diagnostic.message` directly into a
line. Parser messages, filesystem paths, and future dependency errors can
contain newlines, carriage returns, tabs, or other display-control whitespace.
Those values would split or distort a diagnostic in terminal output while JSON
output would still carry the exact source data.

The current tests cover empty output, simple output, ordering, and a snapshot
shared with JSON reports. They do not cover control whitespace in display-only
text fields.

Proposed fix:

- Add a small text-reporter helper that normalizes display-control whitespace
  for text output only.
- Leave JSON diagnostics unchanged so machine consumers keep exact values.
- Add unit tests for newline, carriage-return, and tab handling in messages and
  file paths.
- Document that text output is display-oriented while JSON output is the exact
  machine contract.

## Finding 4: Diagnostic reports borrow caller-owned diagnostic arrays

- Category: cqs
- Severity: Low
- Location: `src/index.ts:330`

`createDiagnosticReport` computes summary counts and then stores
`input.diagnostics` directly on the returned report. The type marks the field
as `readonly`, but a caller can pass a mutable array, receive a report with
counts for the original contents, mutate the original array, and observe a
report whose diagnostics no longer match its summary.

That makes the constructor look like a pure query while leaving the returned
value coupled to later caller-side mutation.

Proposed fix:

- Return `diagnostics: [...input.diagnostics]` from
  `createDiagnosticReport`.
- Update tests to assert value equality and reference separation.
- If borrowing is intentional for performance, document the borrowed-view
  contract in the JSDoc and add a test that makes the trade-off explicit.

## Finding 5: Documentation lacks the canonical navigation documents

- Category: docs-gap
- Severity: Low
- Location: `docs/`

The documentation style guide defines the canonical documentation set as
including `docs/contents.md`, `docs/users-guide.md`,
`docs/developers-guide.md`, and `docs/repository-layout.md` plus design
documentation. Branch-local file inspection found `docs/developers-guide.md`,
the design documents, and the roadmap, but no contents file, user guide, or
repository-layout document.

The user guide can reasonably remain deferred until the CLI exists, but the
absence of a contents document and repository-layout map already makes the
documentation harder to navigate as `docs/execplans/`, `docs/issues/`, ADRs,
and design material accumulate.

Proposed fix:

- Add `docs/contents.md` that links each current document once and explains
  which audience should open it.
- Add `docs/repository-layout.md` that documents source, test, documentation,
  issue, and execution-plan paths.
- Keep a full `docs/users-guide.md` on the existing later roadmap path for
  `odw-lint check`, unless a short placeholder is needed for navigation before
  the CLI lands.

## Proposed roadmap items

- Split diagnostic implementation and tests into focused modules before parser
  and CLI responsibilities expand the public entry point further.
- Harden diagnostic report and text-output ownership contracts before the
  reporter becomes user-facing.
- Add documentation navigation scaffolding for contents and repository layout
  before more execution plans, issue audits, and rule documents accumulate.

## Documentation and skills relied on

- `AGENTS.md`
- `docs/terms-of-reference.md`
- `docs/technical-design.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/developers-guide.md`
- `docs/scripting-standards.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/issues/audit-1.2.1.md`
- `grepai` skill
- `leta` skill
- `sem` skill
- `code-review` skill
