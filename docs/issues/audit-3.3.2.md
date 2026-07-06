# Post-step audit after roadmap task 3.3.2

- Status: Proposed findings
- Scope: `origin/main` at commit `9e8c21a` inspected from the
  `df12-audit-3.3.2-post` git-donkey worktree
- Trigger: audit run after the `--max-warnings` CLI warning budget landed on
  `origin/main` (roadmap task 3.3.2)

This audit was run after the warning-budget slice added `--max-warnings`, split
argument parsing into `src/cli/check-cli-args.ts`, and wired the exit policy
through `src/cli/run-check.ts` and `src/cli/check-cli.ts`. It used `grepai`
against the canonical main-branch index for intent search, direct file
inspection at commit `9e8c21a` for every branch-local fact, and `sem`/`git show`
to review the 3.3.2 change surface. Findings concentrate on the newly extracted
CLI argument parser and its documentation.

Documentation consulted: `AGENTS.md` (quality gates, en-GB Oxford spelling,
TypeScript guidance on grouping parameters and extracting predicates),
`docs/developers-guide.md` (exit-code table, warning-budget policy),
`docs/users-guide.md` (option catalogue, exit codes),
`docs/technical-design.md` (section 7.4 exit codes),
`docs/complexity-antipatterns-and-refactoring-strategies.md`, and
`docs/roadmap.md` (task 3.3.2).

## Finding 1: Missing value for `--output-format` yields a misleading usage error

- Category: inconsistency
- Severity: Medium
- Location: `src/cli/check-cli-args.ts`
  (`parseOutputFormatValue`, lines 226-236; called from
  `parsedOutputFormatOption`, lines 173-178)

When `--output-format` is passed as the final token with no following value,
`parsedOutputFormatOption` reads `tokens[state.nextIndex + 1]` as `undefined`
and hands it to `parseOutputFormatValue`, which returns the usage error
`"unsupported output format: "` — a message with an empty format and a trailing
space. Every other valued option reports a *missing value* when its operand is
absent: `--config` returns `"missing value for --config"`
(`parsedConfigOption`, lines 158-170) and `--max-warnings` returns
`"missing value for --max-warnings"` (`parseMaxWarningsValue`, lines 258-265).
The output-format path is the only one that conflates "no value supplied" with
"unsupported value", and it emits trailing whitespace that reads as a rendering
bug on the terminal.

Proposed fix: in `parseOutputFormatValue`, return
`{ ok: false, usageError: "missing value for --output-format" }` when `value`
is `undefined`, mirroring `parseMaxWarningsValue`. Keep the
`"unsupported output format: <value>"` message for a present-but-invalid value
(including the empty string from `--output-format=`).

## Finding 2: Valued-option parsing scaffolding is duplicated per option

- Category: similarity
- Severity: Low
- Location: `src/cli/check-cli-args.ts`
  (`parseCheckOption` dispatch, lines 121-146; the
  `parsedOutputFormatOption`/`parsedOutputFormatEqualsOption`/
  `parsedOutputFormatState` trio, lines 173-255; and the near-identical
  `parsedMaxWarningsOption`/`parsedMaxWarningsEqualsOption`/
  `parsedMaxWarningsState` trio, lines 193-294)

The output-format and max-warnings options are parsed by structurally identical
code. Each has: a space-form handler that reads `tokens[nextIndex + 1]` and
advances by 2, an equals-form handler that slices `--opt=` and advances by 1,
and an "apply parsed value to state" helper that branches on `parsed.ok`. The
dispatch in `parseCheckOption` likewise repeats the `token === "--opt"` /
`token.startsWith("--opt=")` pair for each valued option. Adding the next
valued flag (`--output-file`, `--stdin-filename`, and the other planned options
in `docs/users-guide.md`) means copying this scaffolding again, which is the
"shotgun surgery" and duplication smell called out in `AGENTS.md`.

Proposed fix: extract a single generic valued-option combinator, e.g.
`parseValuedOption(tokens, state, name, parseValue, applyValue)`, that resolves
the space form and the `name=` form once and returns a `ParsedCheckOption`.
Register options in a small table keyed by flag name so `parseCheckOption`
becomes a lookup rather than a growing `if` ladder. Keep per-option value
parsers (`parseOutputFormat`, `parseMaxWarningsValue`) as the only
option-specific code.

## Finding 3: No coverage for missing `--output-format` or `--config` values

- Category: test-gap
- Severity: Medium
- Location: `tests/cli/check-cli.test.ts`
  (the `it.each` usage-error table, lines 311-345)

The usage-error table exercises `--max-warnings` with no value
(`"missing value for --max-warnings"`) but never covers `--output-format` with
no value or `--config` with no value. As a result the misleading
`"unsupported output format: "` message in Finding 1 is unguarded, and the
correct `"missing value for --config"` path has no regression test. The gap let
the inconsistent output-format message ship undetected.

Proposed fix: add table rows for `["check", "--output-format"]` and
`["check", "--config"]` asserting the intended `missing value for …` messages.
Land the `--output-format` row together with the Finding 1 fix so it encodes the
corrected contract rather than the current misleading text.

## Finding 4: User guide does not distinguish implemented `--max-warnings` from planned options

- Category: inconsistency
- Severity: Low
- Location: `docs/users-guide.md`
  (the "planned options follow `ruff check`" list, lines 47-67)

The option catalogue is introduced by "The planned options follow `ruff check`
where the concepts map cleanly", yet it mixes shipped and deferred flags without
a per-item status marker. Only `--output-format` is annotated "is available
now" (line 49). `--max-warnings` (now implemented by task 3.3.2), together with
`--config` and `--isolated` (also implemented, see `src/cli/check-cli.ts`
`loadConfigForCheck`, lines 117-127), sit in the same list as genuinely deferred
flags such as `--exit-zero`, `--fix`, and `--output-file`. A reader cannot tell
which options work today. `docs/developers-guide.md` is authoritative that
`--exit-zero` and `--strict-claude` remain deferred, so the user guide is the
weak link.

Proposed fix: mark each implemented option "available now" (matching the
`--output-format` bullet), or split the list into an "Available now" group and a
"Planned" group. At minimum annotate `--max-warnings`, `--config`, and
`--isolated` as implemented.

## Finding 5: Command-shape section omits a `--max-warnings` invocation example

- Category: docs-gap
- Severity: Low
- Location: `docs/users-guide.md`
  ("Command shape" section, lines 12-45, which shows `--output-format json` but
  no warning-budget example)

The "Command shape" section demonstrates the default text output and
`--output-format json` with runnable `bun run src/cli/main.ts check …`
examples, but the newly shipped warning-budget flag gets only a one-line
semantic description in the option list. Users adopting `--max-warnings` in CI
have no copy-pasteable example showing the flag position or the exit-code
behaviour it drives.

Proposed fix: add a short runnable example (for example
`bun run src/cli/main.ts check --max-warnings 5 workflows/example.js`) alongside
the existing examples, with one sentence on the exit-0-within-budget behaviour
that cross-references the exit-code table.

## Finding 6: Repeated exact-optional spread pattern across CLI builders

- Category: ergonomics
- Severity: Low
- Location: `src/cli/check-cli-args.ts` (`parsedCheckArgsFromState`, lines
  39-48) and `src/cli/check-cli.ts` (`loadConfigForCheck`, lines 117-127;
  `checkRequestFor`, lines 130-147; `checkExitPolicyFor`, lines 150-154)

To satisfy `exactOptionalPropertyTypes`, four builders spell out the
`...(value === undefined ? {} : { key: value })` conditional-spread idiom by
hand, once per optional field. The pattern is correct but verbose and repeated,
and each new optional field grows the boilerplate. This is low-risk but adds
reading friction in exactly the hot path a maintainer touches when extending the
CLI request shape.

Proposed fix: introduce a tiny shared helper such as
`optionalField(key, value)` returning `{}` or `{ [key]: value }`, or an
`omitUndefined(record)` utility, and use it consistently across these builders.
Sweep for an existing helper first per the `AGENTS.md` abstraction policy before
adding a new one.

## Tooling note

`grepai` intent search against the canonical main-branch index and direct
worktree file inspection at commit `9e8c21a` informed this sweep; `sem`/`git
show` framed the 3.3.2 change surface. Sandboxed `git-donkey`/`git worktree`
invocations required interactive approval, so the inspection worktree was
provisioned with `EnterWorktree`, matching the approach recorded in
`docs/issues/audit-2.3.2.md`. All findings above were confirmed by reading the
branch-local files directly.
