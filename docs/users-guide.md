# odw-lint user's guide

`odw-lint` checks Open Dynamic Workflow (ODW) workflow files before they are
run. It is intended for workflow authors, reviewers, and CI maintainers who
need a static preflight check without executing workflow source or dispatching
agents.

The first executable command slice is available through the Bun entrypoint.
This guide records the current user-facing contract and the planned shape for
the remaining command surface.

## Command shape

The standalone command is:

```text
odw-lint check [path-or-glob ...]
```

The currently implemented entrypoint accepts explicit workflow file paths:

```bash
bun run src/cli/main.ts check <workflow.js> [more-workflows.js ...]
```

The default `full` output is one diagnostic per line. Use
`--output-format json` to emit the versioned report envelope shown in
[Diagnostic reports](#diagnostic-reports):

```bash
bun run src/cli/main.ts check --output-format json workflows/example.js
```

Shell-expanded globs, configured discovery, and the published `odw-lint` binary
remain planned. When no files are passed, the planned v1 command checks
configured include globs. If no configuration exists, it checks these roots
when they are present:

- `.odw/workflows/**/*.js`
- `.claude/workflows/**/*.js`
- `workflows/**/*.js`

The standalone command is path-first. It does not resolve bare ODW workflow
names. A future ODW-owned integration may expose `odw check`, but that command
is outside the v1 standalone contract.

The available options follow `ruff check` where the concepts map cleanly:

- `--output-format full|json` selects output. `full` is the default text
  output, and `json` emits the versioned diagnostic report.
- `--output-file <path>` writes diagnostics to a file instead of standard
  output.
- `--strict-claude` promotes Claude Code portability warnings to errors.
- `--max-warnings <n>` fails the run when warning counts exceed the threshold;
  warnings within the budget no longer fail the run.
- `--config <path>` loads a JSON configuration file. `--isolated` ignores
  configuration files.
- `--force-exclude` applies configured exclusions to explicit paths.
- `--respect-gitignore` and `--no-respect-gitignore` record the discovery
  posture. They do not filter explicit paths in the current explicit-path
  command slice.
- `--stdin-filename <path>` analyses standard input and gives diagnostics a
  stable path.
- `--exit-zero` keeps diagnostic findings and unreadable input files from
  failing the command.
- `--exit-non-zero-on-fix` is accepted and will fail when fixes are applied
  once fix support lands.
- `--help` and `--version` print command discovery information.

The following options remain planned:

- JSON Lines, GitHub, GitLab, JUnit, and SARIF-style output.
- `--fix`, `--unsafe-fixes`, `--diff`, and `--fix-only`.
- Inline `--config` overrides.
- Configured discovery, glob operand expansion, `--exclude`, and
  `--extend-exclude`.
- `--color auto|always|never`, `--verbose`, `--quiet`, and `--silent`.

## Exit codes

| Code | Meaning                                                                         |
| ---- | ------------------------------------------------------------------------------- |
| 0    | Success, within warning budget, or `--exit-zero` downgraded exit `1`.           |
| 1    | Diagnostics remain, warnings exceed budget, fixes were applied, or read failed. |
| 2    | Invalid configuration, invalid CLI options, or internal analyser failure.       |

`--exit-zero` affects diagnostic findings and unreadable input files. It does
not hide abnormal termination, invalid configuration, or invalid command-line
usage.

## Diagnostic reports

The JSON report is a versioned object:

```json
{
  "schemaVersion": 1,
  "tool": { "name": "odw-lint", "version": "0.0.0" },
  "summary": {
    "files": 1,
    "filesSkipped": 0,
    "errors": 1,
    "warnings": 0,
    "infos": 0,
    "hints": 0
  },
  "diagnostics": [
    {
      "file": "workflows/example.js",
      "rule": "odw/meta-required",
      "severity": "error",
      "message": "Workflow source must export literal metadata.",
      "span": {
        "start": { "offset": 0, "line": 1, "column": 1 },
        "end": { "offset": 0, "line": 1, "column": 1 }
      },
      "docs": "docs/rules/meta-required.md",
      "suggestions": []
    }
  ],
  "ioErrors": []
}
```

Report consumers should treat `schemaVersion`, `tool`, `summary`,
`diagnostics`, and `ioErrors` as stable top-level fields. `summary.files`
counts readable files that were checked, and `summary.filesSkipped` counts
input files that could not be read. `ioErrors` is always present and carries
machine-readable read failures with `file`, `reason`, and `message` fields.
Diagnostic spans point to the original source file, not to any normalized
parser input. Offsets are zero-based UTF-8 byte offsets; lines and columns are
one-based display positions. `span.start` is inclusive and `span.end` is
exclusive. Point diagnostics may use a zero-length span where `start` and `end`
are identical.

The default human text report is derived from the same diagnostic objects and
summary counts as JSON output. Each diagnostic is printed as one
`file:line:column severity rule message` line, followed by a blank line and a
`Found …` severity summary such as `Found 1 error.` or
`Found 2 errors, 1 warning.` Clean runs print nothing. This text is a human
report, not a machine-parseable stream; use a machine-readable output format in
Continuous Integration (CI) or editor integrations when callers need stable
field names.

## Rule reference

Each diagnostic has a stable rule identifier such as `odw/meta-required`. Rules
are documented from the [rule reference](rules/index.md), which links to one
page per catalogue entry.

Rule pages explain:

- why a finding exists,
- whether the rule is released or planned,
- its default severity,
- examples of accepted and rejected workflow shapes,
- configuration or suppression behaviour when it is available.

The rule catalogue distinguishes dialect errors, Claude Code compatibility
findings, and orchestration-risk findings. Dialect errors describe workflows
that ODW cannot load. Claude compatibility findings describe workflows that may
run under ODW but are not portable to Claude Code's static workflow reader.
Orchestration-risk findings describe legal workflow patterns that may be
expensive, non-deterministic, or hard to supervise.

## Configuration

The optional configuration file is `odw-lint.json` by default. The available
shape is:

```json
{
  "include": [
    ".odw/workflows/**/*.js",
    ".claude/workflows/**/*.js",
    "workflows/**/*.js"
  ],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "strictClaude": false,
  "rules": {
    "odw/bounded-loop": "warning",
    "odw/schema-for-structured-agent": "off"
  }
}
```

Command-line flags override configuration. Unknown rule identifiers are errors.
Unknown top-level keys are warnings while the schema remains pre-1.0. The
current `--config` option accepts file paths only; inline overrides remain
planned.

## Current non-goals

`odw-lint` does not replace Biome, Oxlint, ESLint, TypeScript, or project
formatters for general JavaScript quality.

The checker must not execute workflow bodies, evaluate metadata, call ODW
runtime loader paths, dispatch agents, or supervise runs. It reports static
diagnostics only.

The checker does not prove prompt quality or agent-answer correctness. It also
does not require every workflow to be Claude Code portable unless the caller
opts into a strict compatibility mode.

The first release targets a standalone `odw-lint check` command. ODW-managed
workflow-name resolution and an `odw check` wrapper are deferred integrations.
