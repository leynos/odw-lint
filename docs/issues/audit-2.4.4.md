# Audit after roadmap task 2.4.4

This post-step audit was run after roadmap task 2.4.4, "Add Ruff-compatible
invocation semantics for output, help, version, configuration, and exit
policy", squash-merged into `origin/main` at commit `e947ccb`. That change
built out the `odw-lint check` invocation surface: output-format selection,
output-file writes, stdin filenames, help and version output, configuration
loading, the strict-Claude override, force-exclude handling, gitignore posture
flags, warning budgets, and exit-policy flags. It replaced the earlier
single-file argument parser with a split parser
(`src/cli/check-args.ts` plus the `check-option-tables.ts`,
`check-output-format.ts`, `check-warning-budget.ts`, and
`check-informational-action.ts` helpers) and reworked the CLI wiring in
`src/cli/check-cli.ts`.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (branch `worktree-df12-audit-2.4.4-post`, base commit `e947ccb`)
with targeted file inspection, `grep`, and `git show`/`git log` entity history.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`
- `docs/users-guide.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- Branch-local file inspection, `grep`, and `git show`/`git log`: source and
  entity-history verification.

Tooling note: `grepai` intent search, the `leta` navigation commands, and the
`bunx`/`make`/`git`-write invocations were unavailable in this agent session
(each network- or write-backed command was auto-denied by the sandbox
permission layer). The fresh inspection worktree was therefore created with the
harness `EnterWorktree` mechanism off `origin/main`; every finding below is
grounded in direct branch-local file inspection rather than the canonical
`main` `grepai` index; the Markdown was self-validated against
`.markdownlint-cli2.jsonc` (MD013 line length, MD004 dash bullets, fenced-code
languages); and the `make markdownlint`/`make nixie` gate plus the commit and
`git push origin HEAD:main` are carried by the companion
`land-audit-244-post.sh` land script for host execution.

## Finding 1: `check-cli-args.ts` is an orphaned duplicate of the whole argument parser

Category: duplication

Severity: high

Location:

- `src/cli/check-cli-args.ts:1`
- `src/cli/check-args.ts:67`

Description:

Task 3.3.2 ("Implement max-warnings CLI budget", commit `9e8c21a`) introduced
`src/cli/check-cli-args.ts` as the explicit-path argument parser, exporting
`parseCheckArgs`, `ParsedCheckArgs`, and `CheckOutputFormat`. Task 2.4.4 then
rewrote argument parsing into `src/cli/check-args.ts` (with the option-table and
value-parser helpers) and repointed `src/cli/check-cli.ts` at the new module.
The old file was left behind in full. A repository search finds no importer of
`check-cli-args.ts` anywhere in `src/` or `tests/`; its only surviving reference
is the historical `docs/execplans/roadmap-3-3-2.md`:

```text
$ grep -rln "check-cli-args" src tests docs
docs/execplans/roadmap-3-3-2.md
```

The result is 294 lines of dead code that shadow the maintained parser. Worse,
the orphan carries its own second copies of `parseMaxWarningsValue`
(`check-cli-args.ts:258`, now also in `check-warning-budget.ts:11`) and
`parseOutputFormatValue`/`parseOutputFormat` (`check-cli-args.ts:212`, now also
in `check-output-format.ts:8`), plus duplicate `CheckOutputFormat` and
`ParsedCheckArgs` type declarations that diverge from the live ones in
`check-output-format.ts` and `check-arg-types.ts`. A maintainer who edits the
warning-budget or output-format contract has two plausible-looking parsers to
reconcile, only one of which is wired in. This is precisely the "dead parallel
implementation" hazard that
`docs/complexity-antipatterns-and-refactoring-strategies.md` warns against, and
it inflates the CLI surface with no runtime effect.

Proposed fix:

Delete `src/cli/check-cli-args.ts` outright. Nothing imports it, so removal is
non-breaking; confirm with a repository search and a full `make all` run.
Ironically, the deleted file's `advanceBy`-parameterized
`parsedOutputFormatState`/`parsedMaxWarningsState` helpers factor the
separate/equals forms more cleanly than the live parser does (see Finding 3) —
capture that idea before deleting so the better factoring is not lost.

## Finding 2: `--max-warnings` is absent from the `check --help` output

Category: docs-gap

Severity: medium

Location:

- `src/cli/check-help.ts:5`
- `tests/cli/check-cli-help.test.ts:17`

Description:

`--max-warnings <n>` is a fully implemented, user-documented option: it is
parsed (`check-args.ts:239`, `check-args.ts:288`), threaded into the exit policy
(`check-cli.ts:198`), enforced (`run-check.ts:121`), and described in
`docs/users-guide.md:54`. Yet the CLI's own help text, `CHECK_USAGE_TEXT` in
`check-help.ts`, lists every other option and omits `--max-warnings`
entirely. The help-coverage test compounds the gap: its
`IMPLEMENTED_HELP_FLAGS` allowlist (`check-cli-help.test.ts:17`) also omits
`--max-warnings`, so the suite asserts the help text contains each *other*
flag while codifying the omission rather than catching it. A user running
`odw-lint check --help` cannot discover a shipped, documented option.

Proposed fix:

Add a `--max-warnings <n>` row to `CHECK_USAGE_TEXT` in `check-help.ts`
(placed with the other value options, e.g. after `--output-file`), matching the
wording in `docs/users-guide.md`. Add `"--max-warnings"` to
`IMPLEMENTED_HELP_FLAGS` in `check-cli-help.test.ts` so the help output is
pinned to the real option surface. Consider strengthening the test to assert
that every recognized option key from `check-option-tables.ts` (plus the
hand-coded `--output-format`/`--max-warnings`) appears in the help text, so a
future option cannot silently miss its help row again.

## Finding 3: `--output-format` and `--max-warnings` duplicate their separate/equals parsing blocks

Category: duplication

Severity: low

Location:

- `src/cli/check-args.ts:220`
- `src/cli/check-args.ts:269`

Description:

String-valued options (`--config`, `--output-file`, `--stdin-filename`) are
table-driven: they are declared once each in `STRING_VALUE_OPTIONS` and
`EQUALS_STRING_VALUE_OPTIONS` (`check-option-tables.ts:25`, `:34`) and parsed by
the shared `parseSeparateStringValueOption`/`parseEqualsStringValueOption`
helpers. The two remaining value options, `--output-format` and
`--max-warnings`, are not: each is hand-coded twice, once for the separate
`--flag value` form in `parseSeparateValueCheckOption` (`check-args.ts:220`,
`:239`) and once for the `--flag=value` form in `parseEqualsValueCheckOption`
(`check-args.ts:269`, `:288`). The four blocks repeat the same shape — call the
value parser, on success spread a new state with the parsed field and an
advanced `nextIndex` (by 2 for separate, 1 for equals), on failure return the
parser error. This is an inconsistency (two of five value options bypass the
table mechanism) layered on duplication (the separate and equals arms differ
only by which token supplies the value and the index advance).

Proposed fix:

Fold `--output-format` and `--max-warnings` into the same table-plus-helper
pattern the string options use. A small typed-value-option table keyed by flag,
each entry pairing a `parse(value)` function with the target field, lets one
`applyParsedValue(state, field, parsed, advanceBy)` helper serve both the
separate and equals arms — mirroring the `advanceBy`-parameterized
`parsedOutputFormatState`/`parsedMaxWarningsState` helpers in the now-dead
`check-cli-args.ts` (Finding 1). This removes the four near-identical blocks and
makes all five value options obey one mechanism.

## Finding 4: `--config=<path>` is rejected while every other value option accepts the equals form

Category: inconsistency

Severity: medium

Location:

- `src/cli/check-option-tables.ts:34`
- `src/cli/check-args.ts:333`

Description:

`--config <path>` (separate form) is recognized via `STRING_VALUE_OPTIONS`
(`check-option-tables.ts:25`), but the `--config=<path>` equals form is not:
`EQUALS_STRING_VALUE_OPTIONS` (`check-option-tables.ts:34`) contains only
`--output-file=` and `--stdin-filename=`. Because `parseEqualsStringValueOption`
iterates that shorter map, `--config=odw.toml` falls through every value branch
and is reported as `unknown option: --config=odw.toml` at `check-args.ts:171`.
This is asymmetric with the other three value options — `--output-format`,
`--output-file`, `--stdin-filename`, and `--max-warnings` all accept both
`--flag value` and `--flag=value` — and it diverges from the Ruff-compatible
invocation posture the task set out to match, since `ruff check --config=...`
is a common form. There is no test asserting the intended behaviour either way:
`tests/cli/check-args.test.ts` covers the equals form for output-format,
output-file, and stdin-filename, but never for `--config`.

Proposed fix:

Add `["--config=", { field: "configPath", missingValueError: "missing value for
--config" }]` to `EQUALS_STRING_VALUE_OPTIONS` in `check-option-tables.ts`, so
`--config=<path>` parses through the existing equals-string helper. Add a
`--config=<path>` case to the equals-form coverage in
`tests/cli/check-args.test.ts` and a matching empty-value (`--config=`) case, so
the symmetric behaviour is pinned. If omitting the equals form for `--config`
is in fact deliberate, document the exception and add a test asserting the
rejection so the asymmetry is intentional rather than incidental.

## Finding 5: the two value parsers disagree on their missing-value contract

Category: inconsistency

Severity: low

Location:

- `src/cli/check-output-format.ts:26`
- `src/cli/check-warning-budget.ts:11`

Description:

`parseMaxWarningsValue` owns its missing-value case: given `undefined` it
returns `"missing value for --max-warnings"` (`check-warning-budget.ts:16`), and
the parser calls it directly with `tokens[state.nextIndex + 1]`
(`check-args.ts:241`). `parseOutputFormatValue` behaves differently: given
`undefined` it returns `"unsupported output format: "` — a
semantically wrong message (the value is missing, not unsupported) with a
trailing space (`check-output-format.ts:31`). To compensate, the separate-form
call site guards `value === undefined` *before* calling and emits its own
`"missing value for --output-format"` (`check-args.ts:221`), and the equals-form
call site guards `value.length === 0` (`check-args.ts:271`). The consequence is
that the `undefined` branch inside `parseOutputFormatValue` is unreachable dead
code whose message would be misleading if it ever fired, and the two sibling
value parsers present inconsistent contracts to their callers.

Proposed fix:

Make `parseOutputFormatValue` own its missing-value case like
`parseMaxWarningsValue` does: return `"missing value for --output-format"` on
`undefined`, then drop the pre-call `undefined`/empty guards in
`check-args.ts:221` and `check-args.ts:271` so both parsers are invoked
uniformly. This removes the dead branch, fixes the misleading message, and
aligns the two value-parser contracts — which also simplifies the table-driven
consolidation proposed in Finding 3.

## Finding 6: `respectGitignore` is parsed and threaded to no consumer, unguarded by any test

Category: test-gap

Severity: low

Location:

- `src/cli/check-args.ts:378`
- `src/cli/check-arg-types.ts:18`

Description:

`--respect-gitignore`/`--no-respect-gitignore` are parsed
(`check-args.ts:378`), defaulted to `true` (`check-args.ts:89`), and threaded
into the public `ParsedCheckRunArgs.respectGitignore` field
(`check-arg-types.ts:18`, `check-args.ts:57`). No code reads the field: a
repository search finds `respectGitignore` only in the parser, its type, and the
help text — never in `check-cli.ts`, `run-check.ts`, or config loading. This is
intentional forward-compat (the flag records discovery posture for a future
file-walking mode, as `docs/users-guide.md:59` states), and it parallels
`forceExclude`, which *is* consumed by `pathsForInvocation`
(`check-cli.ts:181`). The gap is that nothing pins the current contract: no test
asserts that `--no-respect-gitignore` is accepted, defaults to `true`, and is
presently inert. Because the field is exported on a public parsed-args type, a
later change that begins consuming it (or that drops it) could shift behaviour
with no failing test to flag the transition.

Proposed fix:

Add a focused parser test in `tests/cli/check-args.test.ts` asserting that
`--respect-gitignore` and `--no-respect-gitignore` set the field to `true`/
`false` and that the default is `true`, and note in the test (or a short comment
at the parse site) that the flag is currently posture-only pending file
discovery. This pins the accepted-but-inert contract so the eventual consumer
lands against a guarded baseline. If the field is not intended to be part of the
stable parsed-args surface yet, consider gating it behind the discovery work
instead of exporting it now.
