# 0004. Machine-readable IO-error channel

Status: Accepted
Date: 2026-07-06

## Context

`odw-lint check` can continue after one explicit input path cannot be read. The
command already reports each read failure to stderr as
`error: cannot read <path>: <message>` and returns exit code 1 when any read
failure remains.

Before this decision, JSON output did not carry those failures. A machine
consumer could therefore see an empty `diagnostics` array and no structured
record of the skipped file, even though the process failed and stderr contained
a human-readable IO error. That made a skipped-file run look too similar to a
clean run for consumers that process only the report envelope.

An unreadable input is not a workflow-content diagnostic. It is a host input
failure. Treating it as a catalogued lint rule would confuse the rule taxonomy,
expand the rule enum for a non-rule condition, and make rule documentation
carry command-runner semantics.

## Decision

The diagnostic report envelope includes a top-level `ioErrors` array and a
`summary.filesSkipped` count.

Each IO error has:

- `file`: the path supplied by the caller,
- `reason`: one of `not-found`, `not-a-file`, or `unreadable`,
- `message`: the human-readable read-failure message.

`ioErrors` is always emitted and is empty when no input read failed.
`summary.files` continues to count readable files that were checked.
`summary.filesSkipped` counts unreadable input files represented in
`ioErrors`.

The command-line interface keeps emitting the existing stderr line for each
read failure. Text report footers also mention skipped files, including
skip-only runs, so human and machine-readable output both distinguish skipped
inputs from clean runs.

`schemaVersion` remains `1`. The package is private and pre-release, and the
change is additive for known-field consumers. JSON consumers do not need a
compatibility branch to continue reading the existing fields.

## Consequences

- JSON consumers can tell the difference between a clean run and a run that
  skipped unreadable inputs.
- `summary.files` remains the checked-file count, so historical diagnostic
  counts do not silently change meaning.
- The schema literal, golden JSON contract fixture, report snapshots and public
  diagnostic types include the additive fields.
- Future rule work must keep IO failures out of the lint-rule catalogue unless
  a separate design decision deliberately changes that taxonomy.

## Rejected alternatives

- Model read failures as catalogued diagnostics. This would make filesystem
  failures look like workflow-content violations and require rule-catalogue,
  rule-documentation, schema-enum and parity-test updates for a non-rule
  condition.
- Leave read failures on stderr only. That preserves existing CLI logs but
  keeps machine consumers unable to distinguish skipped inputs from a clean
  report envelope.
