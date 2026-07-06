# Audit after roadmap task 2.4.2

This post-step audit was run after roadmap task 2.4.2, "Add text output with
file, line, column, severity, rule, and message", squash-merged into
`origin/main` at commit `58c2927`. That change promoted the human text output to
the default `odw-lint check` report: `formatTextReport` in
`src/diagnostics/text.ts` now emits one
`file:line:column severity rule message` line per diagnostic, a blank-line
separator, and a `Found …` severity summary footer, wired through
`src/cli/check-cli.ts`. It also refreshed `docs/users-guide.md` and
`docs/developers-guide.md` and extended the text, CLI, and snapshot suites.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (base commit `58c2927`) with targeted file inspection, `grep`, and
entity history. `grepai` intent search against the canonical `main` index was
used only for orientation, because the merge is recent and the index still
reflects the pre-merge tree; every finding below is grounded in direct
branch-local inspection.

The 2.4.2 change is small, cohesive, and well-tested. `formatTextReport` and its
severity summary are covered by example, snapshot, and property-based tests; the
`runCheck` aggregator has thorough multi-file, mixed, and property coverage; and
the empty-report, control-whitespace, and Unicode-separator edge cases are all
exercised. The findings below are residual duplication, immutability, and
ergonomic inconsistencies plus one CLI glue-layer test gap. None blocks the
task; all are low severity and recorded for completeness.

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
- `grepai`: canonical `main` intent search for orientation.
- Branch-local file inspection, `grep`, and Git entity history: source and
  entity-history verification.

## Finding 1: `messageForThrownValue` is duplicated verbatim across the two CLI modules

Category: duplication

Severity: low

Location:

- `src/cli/check-cli.ts:64`
- `src/cli/read-workflow-source.ts:28`

Description:

Both CLI modules define an identical thrown-value-to-text helper:

```ts
const messageForThrownValue = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
```

They are byte-for-byte the same and serve the same boundary role: converting an
unknown thrown value into stable user-visible text (`check-cli.ts` for the
`internal error:` path, `read-workflow-source.ts` for the read-failure message).
AGENTS.md's boundary-error guidance ("Convert unknown thrown values and
third-party failures to project-owned error shapes at API or command
boundaries") makes this a shared concern rather than a coincidental clone. The
duplication is fresh: `read-workflow-source.ts` and the check CLI landed across
tasks 2.4.1 and 2.4.2, so the second copy was introduced knowingly alongside the
first.

Proposed fix:

Extract a single `messageForThrownValue` (for example into a small
`src/cli/error-message.ts`, or a shared diagnostics boundary helper if one is
preferred) and import it in both modules. This removes the clone and gives the
two boundaries one place to evolve the unknown-throw contract, without changing
any observable text.

## Finding 2: `createDiagnosticReport` output is unfrozen while its CLI consumers freeze defensively

Category: inconsistency

Severity: low

Location:

- `src/diagnostics/report.ts:104`
- `src/cli/run-check.ts:55`

Description:

`src/cli/run-check.ts` and `src/cli/read-workflow-source.ts` apply
`Object.freeze` defensively to their returned records, in line with AGENTS.md's
"Immutability first" guidance. `runCheck` freezes its outcome:

```ts
return Object.freeze({
  report: createDiagnosticReport({ /* … */ }),
  readFailures: Object.freeze(readFailures),
});
```

`Object.freeze` is shallow, however, and `createDiagnosticReport`
(`report.ts:104`) returns a plain, unfrozen object literal whose `diagnostics`
array and nested `summary`/`tool` objects remain mutable. So the frozen
`outcome.report` reference still exposes a fully mutable report graph — the
report envelope, its diagnostics array, and every diagnostic object can be
mutated in place. The immutability discipline is therefore inconsistent between
neighbouring modules created in the same slice: the CLI aggregator freezes, the
report builder it calls does not. `createDiagnosticReport` already deep-clones
its inputs (`cloneDiagnostic`, `cloneSourceSpan`), so the intent to hand back an
independent, caller-detached value is clear; leaving the result mutable
undercuts that intent.

Proposed fix:

Decide on one immutability contract and apply it consistently. The lowest-churn
option is to freeze the report envelope (and ideally its `diagnostics` array) at
the end of `createDiagnosticReport`, matching the sibling CLI modules, so that
the shallow `Object.freeze` in `runCheck` no longer implies a guarantee it does
not deliver. Document the chosen depth of the freeze in the function docstring
so callers know whether nested diagnostics are safe to treat as frozen.

## Finding 3: the check CLI rebuilds the request conditionally, then spreads it redundantly

Category: ergonomics

Severity: low

Location:

- `src/cli/check-cli.ts:107`

Description:

`runCheckCli` constructs the `runCheck` request through a branch that exists
only to satisfy `exactOptionalPropertyTypes` (omitting `readFileText` entirely
when it is `undefined`), then passes the already-complete object through a
redundant spread:

```ts
const request =
  io.readFileText === undefined
    ? { paths: parsedArgs.paths, version: io.version ?? packageJson.version }
    : {
        paths: parsedArgs.paths,
        version: io.version ?? packageJson.version,
        readFileText: io.readFileText,
      };
const outcome = runCheck({
  ...request,
});
```

The two branches repeat `paths` and the `io.version ?? packageJson.version`
expression, and `runCheck({ ...request })` copies a fully-formed object for no
effect — `runCheck(request)` is equivalent. The shape is a small readability and
maintenance snag: the version-defaulting logic is duplicated across the two
arms, and the spread reads as if it were merging additional fields when it is
not.

Proposed fix:

Compute the shared fields once and attach the optional seam conditionally, for
example by building a base `{ paths, version }` and conditionally spreading
`...(io.readFileText ? { readFileText: io.readFileText } : {})` into a single
object literal, then call `runCheck(request)` directly. This keeps
`exactOptionalPropertyTypes` satisfied, removes the duplicated default, and drops
the misleading spread.

## Finding 4: the severity list and its summary key/label mapping have no single source of truth

Category: separation-of-concerns

Severity: low

Location:

- `src/diagnostics/severity.ts:10`
- `src/diagnostics/report.ts:36`
- `src/diagnostics/text.ts:13`
- `src/diagnostics/types.ts:72`

Description:

The severity ordering `["error", "warning", "info", "hint"]` and its mapping to
the pluralised summary keys (`errors`, `warnings`, `infos`, `hints`) is restated
independently in four places: the `DIAGNOSTIC_SEVERITIES` tuple
(`severity.ts:10`, described as "the source of truth"), the `counts` object and
its key-to-summary mapping in `countDiagnostics` (`report.ts:36`), the
`SUMMARY_PARTS` table with its singular/plural labels in `text.ts:13`, and the
`DiagnosticSummary` field list (`types.ts:72`). `text.ts` in particular
hard-codes a second copy of the ordering plus the singular/plural noun for each
severity, none of which is derived from `DIAGNOSTIC_SEVERITIES`. Adding or
renaming a severity would require coordinated edits in all four locations — the
"shotgun surgery" smell that AGENTS.md's refactoring heuristics call out — and a
missed edit would silently drop a severity from either the counts or the text
summary. The severity tuple is already labelled the source of truth, so the
divergent hand-maintained mirrors contradict the stated design.

Proposed fix:

Derive the summary key and singular/plural labels from `DIAGNOSTIC_SEVERITIES`
rather than restating them. For example, define one small table keyed by
severity that carries `summaryKey`, `singular`, and `plural`, colocated with the
severity model, and have `countDiagnostics` and `SUMMARY_PARTS` consume it so a
new severity is a single-site change. Weigh this against the current explicitness
if the severity set is considered closed; record the decision either way so the
"source of truth" claim in `severity.ts` matches reality.

## Finding 5: no CLI-level test exercises a mixed diagnostics-and-read-failure invocation

Category: test-gap

Severity: low

Location:

- `tests/cli/check-cli.test.ts:108`
- `src/cli/check-cli.ts:123`

Description:

`runCheckCli` emits in a fixed order: `writeTextDiagnostics` to stdout, then
`writeReadFailures` to stderr (`check-cli.ts:123`). The CLI suite covers each
path in isolation — a clean run, a diagnostic-bearing run (stdout only), and an
unreadable-path run (stderr only) — but never a single invocation that mixes a
readable diagnostic-bearing file with an unreadable path. The `runCheck`
aggregator suite proves that diagnostics and read failures accumulate together
and that the exit code is `1` in mixed cases, yet the CLI glue that splits those
two channels across stdout and stderr in one run is unverified: a regression that
dropped either channel, or interleaved them onto the wrong stream, when both are
present would pass the current suite. The stdout-before-stderr emission contract
is exactly the kind of externally observable CLI behaviour AGENTS.md asks
end-to-end coverage to lock in.

Proposed fix:

Add a `check-cli.test.ts` case that runs `["check", <diagnostic-fixture>,
<missing-path>]` with an injected reader and captured writers, asserting that
stdout carries the diagnostic line and `Found …` summary, stderr carries the
`error: cannot read <path>:` line, and the exit code is `1`. This pins the
two-channel emission behaviour of the glue layer that the aggregator tests do not
reach.

## Finding 6: the argument flag scan spans the subcommand and pre-empts command validation

Category: inconsistency

Severity: low

Location:

- `src/cli/check-cli.ts:40`

Description:

`parseCheckArgs` scans every argument — including the subcommand token — for a
leading `-` and returns an `unknown option` usage error before it validates the
subcommand or the operand count:

```ts
const firstFlag = args.find((arg) => arg.startsWith("-"));
if (firstFlag !== undefined) {
  return { ok: false, usageError: `unknown option: ${firstFlag}` };
}

if (subcommand !== "check") {
  return { ok: false, usageError: `unknown command: ${subcommand}` };
}
```

Two consequences follow. First, any operand beginning with `-` is rejected as an
unknown option, which forecloses the conventional `-` stdin sentinel and any
dash-prefixed filename — behaviour that will collide with the Ruff-compatible
`--stdin-filename` and flag surface planned for task 2.4.4. Second, the ordering
means a genuinely wrong command that happens to start with `-` (for example
`--help`) is reported as `unknown option: --help` rather than being routed to
help or command handling, so flag errors mask command errors. This is acceptable
for the deliberately minimal 2.4.2 slice and the guide records the wider flag
surface as deferred, but the scan-then-validate ordering is worth flagging so it
is revisited rather than inherited unexamined when option parsing lands.

Proposed fix:

When the Ruff-compatible option surface is implemented (task 2.4.4), separate
option parsing from operand handling: stop at `--` for end-of-options, treat a
bare `-` as the stdin operand rather than a flag, and validate the subcommand
before rejecting unknown options so command and option errors are reported
distinctly. For the current slice, at minimum add a short comment at the scan
recording that dash-prefixed operands are intentionally unsupported until 2.4.4,
so the limitation is a documented decision rather than an accident of ordering.

## Finding 7: the text report contract is documented but its non-machine-parseable shape is not called out

Category: docs-gap

Severity: low

Location:

- `src/diagnostics/text.ts:93`
- `docs/users-guide.md:100`

Description:

`formatTextDiagnostics` joins fields with single spaces
(`file:line:column severity rule message`) and normalises only control
whitespace (`normalizeTextField` collapses CR, LF, tabs, NEL, LS, and PS), not
ordinary spaces. A file path or message containing an ordinary space therefore
yields a line that cannot be split back into fields unambiguously — the format
is human-oriented only. The users' guide describes the line shape and the `Found
…` summary well, and correctly steers CI and editor integrations toward the
planned machine formats, but it does not state plainly that the text output is
not a stable machine-parseable contract (unlike the forthcoming JSON envelope).
Readers could reasonably infer the space-delimited line is grep/awk-friendly and
build brittle tooling on it. The absence of a delimiter after the column also
diverges from the Ruff `file:line:col:` precedent the design otherwise follows,
which is worth noting even though full Ruff parity is a later task.

Proposed fix:

Add one sentence to the text-output section of the users' guide (and a matching
note in the developers' guide contract) stating that the text report is intended
for human reading only and is not a stable machine-parseable format — callers
that need to parse diagnostics should use the JSON output planned for task 2.4.3.
Optionally, record in the technical design whether the eventual text format
should adopt the Ruff `file:line:col:` colon delimiter for closer precedent
alignment, so the divergence is a deliberate choice rather than drift.
