# Audit after roadmap task 2.4.3

This post-step audit was run after roadmap task 2.4.3, "Add JSON output and a
JSON contract fixture", squash-merged into `origin/main` at commit `36c9d68`.
That change added the canonical JSON diagnostic report formatter
(`src/diagnostics/report-json.ts`), exposed it through the explicit-path
`check` command's `--output-format json` option (`src/cli/check-cli.ts`),
re-exported `formatJsonReport` from the public entry (`src/index.ts`),
documented the shipped JSON contract in the users' and developers' guides, and
added CLI, public-consumer, and golden-fixture parity coverage.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (branch `worktree-df12-audit-2.4.3`, base commit `36c9d68`) with
targeted file inspection, `grep`, and `git show` entity history.

The 2.4.3 change is a clean, well-tested addition: it introduces a versioned,
snapshot-pinned JSON envelope with an exported JSON Schema and a
live-versus-golden parity test. The findings below concentrate on the
consistency and coverage seams the new output surface leaves behind — a
serializer that duplicates the report cloner's structural traversal, a JSON
Schema that is exported but never enforced against the serializer it describes,
an asymmetric public formatter surface, and a CLI option that the tool's own
usage and help text do not advertise.

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
- Branch-local file inspection, `grep`, and `git show`: source and
  entity-history verification.

Tooling note: the `grepai` intent search and the write-backed `git`/
`git-donkey` commands (`fetch`, `worktree add`) were unavailable in this agent
session — each was auto-denied by the sandbox permission layer. The fresh
inspection worktree was therefore created with the harness `EnterWorktree`
mechanism off `origin/main`, and every finding below is grounded in direct
branch-local file inspection rather than the canonical `main` `grepai` index.
`leta` symbol navigation was likewise not reachable in this session, so
references were verified with targeted `grep` and file reads.

## Finding 1: the JSON serializer re-implements the report cloner traversal

Category: similarity

Severity: medium

Location:

- `src/diagnostics/report-json.ts:14` (`projectPosition`, `projectSpan`,
  `projectSuggestion`, `projectDiagnostic`)
- `src/diagnostics/report.ts:57` (`cloneSourcePosition`, `cloneSourceSpan`,
  `cloneSuggestion`, `cloneDiagnostic`)

Description:

Task 2.4.3 added a `project*` family in `report-json.ts` that walks the whole
`Diagnostic → SourceSpan → SourcePosition → DiagnosticSuggestion` shape to fix
the public JSON field order. `report.ts` already owns a `clone*` family that
walks exactly the same shape to detach report diagnostics from caller-owned
objects. The two families are near-identical structural recursions over the
same type graph, differing only in intent (defensive copy versus canonical
field-ordering) and in two details: `projectPosition` reorders to
`offset, line, column` while `cloneSourcePosition` spreads, and
`projectDiagnostic` always materializes `suggestions: []` while
`cloneDiagnostic` drops the key when it is absent.

Because both families must be edited in lockstep whenever the `Diagnostic` type
gains, renames, or reorders a field, the duplication is a maintenance hazard: a
new nested field added to the clone path but not the projection path would
silently drop out of the JSON contract with no compile-time signal.

Proposed fix:

Extract a single shared structural mapper over the diagnostic type graph — for
example a `mapDiagnosticTree(diagnostic, { position, suggestion })` helper, or
a canonical `orderedDiagnostic(diagnostic)` projector that both
`createDiagnosticReport` and `formatJsonReport` consume — so the traversal
exists once and the two call sites supply only their per-node policy. This
keeps the "one reviewed definition" intent the report envelope already follows.

## Finding 2: the JSON Schema marks `suggestions` optional, but the serializer always emits it

Category: inconsistency

Severity: medium

Location:

- `src/diagnostics/schema.ts:85`
  (`required: ["file", "rule", "severity", "message", "span"]`)
- `src/diagnostics/report-json.ts:46`
  (`suggestions: (diagnostic.suggestions ?? []).map(projectSuggestion)`)
- `tests/diagnostics/report-json.test.ts:64` ("always emits suggestions")

Description:

`DIAGNOSTIC_REPORT_SCHEMA` lists a diagnostic's required keys as `file`, `rule`,
`severity`, `message`, and `span`; `docs` and `suggestions` are both modelled
as optional. The serializer, however, *always* emits `suggestions` — the
report-json test explicitly pins "always emits suggestions while preserving
suggestion messages", and the users' guide example shows `"suggestions": []` on
a diagnostic that has none. So the emitted contract guarantees `suggestions` is
present, while the published schema tells consumers it may be absent. A
consumer generating code from the schema would treat `suggestions` as nullable,
which is stricter than the tool actually behaves and invites divergent handling.

`docs` is genuinely optional in both the serializer and the schema, so the two
fields have different presence semantics that the schema currently flattens
into "both optional".

Proposed fix:

Make the schema match the guaranteed output by adding `suggestions` to the
diagnostic `required` list (keeping `docs` optional), and state the split
explicitly in the users' guide (`suggestions` is always present, possibly empty;
`docs` is present only when the rule has a documentation page). Alternatively,
if the intent is a smaller wire payload, stop emitting empty `suggestions` and
align the test — but the existing "always emits" test shows the present-always
contract is the deliberate one, so tightening the schema is the lower-risk
correction.

## Finding 3: nothing validates serializer output against the JSON Schema

Category: test-gap

Severity: medium

Location:

- `src/diagnostics/schema.ts:53` (`DIAGNOSTIC_REPORT_SCHEMA`, exported at
  `src/index.ts:47`)
- `tests/diagnostics/json-contract.test.ts` (contract coverage that never
  references the schema)

Description:

`DIAGNOSTIC_REPORT_SCHEMA` is a public artefact — it is exported from the
package entry so "reporter and CLI boundaries can share a stable contract". Yet
no test validates that `formatJsonReport` output actually conforms to it. The
JSON contract suite asserts field order, envelope invariants, and a golden
fixture, and the report-json suite asserts key order and the suggestions rule,
but none of them feed emitted JSON through the schema. The schema and the
serializer can therefore drift with no failing test — Finding 2 is exactly that
drift already present. Because the schema deliberately avoids a runtime
validator dependency, the only guard against divergence would be a test-time
check, which is absent.

Proposed fix:

Add a test that validates emitted reports against `DIAGNOSTIC_REPORT_SCHEMA`
across the severity matrix and both the with-`docs`/without-`docs` and
with-`suggestions`/empty-`suggestions` cases. A tiny structural assertion over
the literal schema (or a dev-only JSON Schema validator scoped to tests) keeps
the no-runtime-dependency constraint while making schema/serializer drift a
build failure.

## Finding 4: the public formatter surface exposes the JSON report but only low-level text

Category: inconsistency

Severity: low

Location:

- `src/index.ts:18` (`export { formatJsonReport } …`)
- `src/index.ts:53` (`export { formatTextDiagnostics } …`)
- `src/diagnostics/text.ts:107` (`formatTextReport`, unexported)

Description:

The package entry exports the report-level `formatJsonReport` and the
diagnostic-line-level `formatTextDiagnostics`, but not `formatTextReport` — the
report-level text formatter that appends the `Found …` severity summary and is
what the CLI's default and `--output-format full` paths actually render. A
public consumer can reproduce the tool's JSON output byte-for-byte, and can
render the raw diagnostic lines, but cannot reproduce the CLI's full human text
report (lines plus summary footer) without re-implementing the footer join. The
two output families are asymmetric across the public boundary: JSON is exposed
at the report level, text only at the line level.

Proposed fix:

Export `formatTextReport` from `src/index.ts` alongside `formatTextDiagnostics`
and `formatJsonReport`, giving both renderings a report-level public entry, and
add a public-consumer assertion that the exported text report matches the CLI's
`full` output.

## Finding 5: the `check` usage and help surface omit the `--output-format` option

Category: ergonomics

Severity: low

Location:

- `src/cli/check-cli.ts:47`
  (`USAGE = "usage: odw-lint check <workflow.js ...>"`)
- `src/cli/check-cli.ts:210` (`runCheckCli` — no `--help`/`--version`
  path)

Description:

The `check` command accepts `--output-format full|json`, but the `USAGE` string
it prints on any argument error advertises only `check <workflow.js ...>`.
There is also no `--help` or `--version` handler, even though the CLI already
reads `packageJson.version` for the report envelope. A user who runs `check`
with no arguments, or with a mistyped flag, is shown a usage line that hides
the very option the 2.4.3 change shipped, and has no in-tool way to discover
the flag or the tool version. Ruff-parity invocation semantics are scheduled
for task 2.4.4, but the usage string is a user-facing regression against the
option that already exists on `main`.

Proposed fix:

Extend `USAGE` to
`usage: odw-lint check [--output-format full|json] <workflow.js ...>`, and add a
`--help`/`--version` short-circuit (help prints the usage and option list to
stdout and exits 0; version prints `packageJson.version`). If the fuller flag
surface is deferred to 2.4.4, at minimum widen the usage string now so it stays
truthful about the shipped option.

## Finding 6: a missing `--output-format` value is reported as an empty format error

Category: ergonomics

Severity: low

Location:

- `src/cli/check-cli.ts:140` (`parseOutputFormatOperand`, `value === undefined`
  branch)
- `tests/cli/check-cli.test.ts:218` (option error matrix — no
  missing-value case)

Description:

When `--output-format` is supplied with no value — either as a trailing bare
flag (`check foo.js --output-format`) or as `--output-format=` — the parser
returns `"unsupported output format: "`, an error with an empty value and a
trailing space. The real fault is a missing value, not an unsupported one, so
the message misdirects the user and reads as a formatting glitch. The CLI error
matrix covers the unknown-format, unknown-flag, and no-path cases but not the
missing-value branch, so the awkward message is also unguarded against
regression.

Proposed fix:

Return a distinct `missing value for --output-format` error from the
`value === undefined` (and empty-string) branch, and add the trailing-bare-flag
and `--output-format=` cases to the CLI error matrix so the message is pinned.

## Finding 7: read failures bypass the JSON envelope and land on stderr as text

Category: separation-of-concerns

Severity: low

Location:

- `src/cli/check-cli.ts:193` (`writeReadFailures`, "until JSON IO
  diagnostics exist")
- `src/cli/check-cli.ts:235` (report to stdout, failures to stderr
  regardless of format)
- `tests/cli/check-cli.test.ts:208` ("keeps read failures on stderr when
  JSON output is selected")

Description:

Under `--output-format json`, unreadable paths are still written to stderr as
plain `error: cannot read <path>: <message>` lines, while stdout carries a JSON
envelope whose `diagnostics` array excludes them. A machine consumer that
parses stdout as JSON therefore sees a clean report and must separately scrape
an unstructured stderr channel to learn that files were skipped — the summary
`files` count reflects only readable files, so the omission is otherwise
invisible. The in-code comment ("until JSON IO diagnostics exist") shows this
is a known, deliberate interim, but it is a command/output-contract seam worth
tracking rather than leaving as a comment.

Proposed fix:

Fold IO failures into the JSON envelope (for example an `ioErrors` array or
synthetic diagnostics) so a single stream carries the full outcome, and until
then document the stderr behaviour explicitly in the users' guide so JSON
consumers know to inspect stderr. This aligns naturally with the Ruff-parity
output work in task 2.4.4.

## Finding 8: the users' guide does not state per-diagnostic field stability

Category: docs-gap

Severity: low

Location:

- `docs/users-guide.md:105` (stable-fields statement covers only
  top-level keys)

Description:

The users' guide names `schemaVersion`, `tool`, `summary`, and `diagnostics` as
the stable top-level fields, but says nothing about the stability of the
*diagnostic* fields. In particular it does not tell consumers that
`suggestions` is always present (possibly empty) while `docs` appears only for
rules that have a documentation page. The example happens to show both, which
could be read as "both always present" — the opposite of the actual
`docs`-optional behaviour. This is the documentation half of Finding 2.

Proposed fix:

Add a sentence to the JSON contract section stating that each diagnostic always
carries `file`, `rule`, `severity`, `message`, `span`, and `suggestions` (which
may be an empty array), and that `docs` is present only when the rule is
documented. Keep this in step with whichever resolution Finding 2 takes for the
schema's `required` list.

## Finding 9: `runCheckCli` spreads an already-built request object into `runCheck`

Category: ergonomics

Severity: info

Location:

- `src/cli/check-cli.ts:231` (`const outcome = runCheck({ ...request })`)

Description:

`runCheckCli` builds a fully-formed `request` object (conditionally including
`readFileText`) and then calls `runCheck({ ...request })`. The spread copies an
object that is used exactly once and immediately, so it adds a redundant
allocation and a small readability cost with no behavioural benefit; `runCheck`
already treats its argument as read-only.

Proposed fix:

Pass `request` directly (`runCheck(request)`), dropping the redundant spread.

## Confirmation

The 2.4.3 production surface (`src/diagnostics/report-json.ts`,
`src/cli/check-cli.ts`, `src/index.ts`) is well-formed and thoroughly tested;
the findings above are consistency, coverage, and ergonomics follow-ons rather
than correctness defects. No `TODO`, `FIXME`, `@ts-ignore`, or `biome-ignore`
markers were found in the reviewed `src/` diagnostics and CLI modules. The
versioned envelope, canonical key order, live-versus-golden parity, and
Ruff-parity exit-code policy all behave as the change intended.
