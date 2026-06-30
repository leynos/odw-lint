# odw-lint user's guide

`odw-lint` checks Open Dynamic Workflow (ODW) workflow files before they are
run. It is intended for workflow authors, reviewers, and CI maintainers who
need a static preflight check without executing workflow source or dispatching
agents.

The CLI is not implemented yet. This guide records the intended user-facing
contract so early adopters can follow the planned shape before the first
executable command slice lands.

## Command shape

The standalone command is:

```text
odw-lint check [path-or-glob ...]
```

Pass explicit workflow files or shell-expanded globs after `check`. When no
files are passed, the planned v1 command checks configured include globs. If no
configuration exists, it checks these roots when they are present:

- `.odw/workflows/**/*.js`
- `.claude/workflows/**/*.js`
- `workflows/**/*.js`

The standalone command is path-first. It does not resolve bare ODW workflow
names. A future ODW-owned integration may expose `odw check`, but that command
is outside the v1 standalone contract.

The planned options follow `ruff check` where the concepts map cleanly:

- `--output-format <format>` selects text, JSON, JSON Lines, GitHub, GitLab,
  JUnit, or SARIF-style output as those reporters are implemented.
- `--output-file <path>` writes diagnostics to a file instead of standard
  output.
- `--fix`, `--unsafe-fixes`, `--diff`, and `--fix-only` control future fix
  support. Rules without fix support still report diagnostics only.
- `--strict-claude` promotes Claude Code portability warnings to errors.
- `--max-warnings <n>` fails the run when warning counts exceed the threshold.
- `--config <path-or-override>` selects a configuration file or applies an
  inline override. `--isolated` ignores configuration files.
- `--exclude`, `--extend-exclude`, `--force-exclude`,
  `--respect-gitignore`, and `--no-respect-gitignore` control file discovery.
- `--stdin-filename <path>` gives standard-input diagnostics a stable path.
- `--exit-zero` keeps diagnostic findings from failing the command.
- `--exit-non-zero-on-fix` fails when fixes were applied.
- `--color auto|always|never`, `--verbose`, `--quiet`, and `--silent` control
  text output and logging.

## Exit codes

| Code | Meaning                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 0    | No diagnostics remain, or all diagnostics were fixed automatically.                                        |
| 1    | Diagnostics remain, warning thresholds were exceeded, or fixes were applied with `--exit-non-zero-on-fix`. |
| 2    | Invalid configuration, invalid CLI options, unreadable required inputs, or internal analyser failure.      |

`--exit-zero` only affects diagnostic findings. It does not hide abnormal
termination, invalid configuration, or invalid command-line usage.

## Diagnostic reports

The JSON report is a versioned object:

```json
{
  "schemaVersion": 1,
  "tool": { "name": "odw-lint", "version": "0.1.0" },
  "summary": { "files": 1, "errors": 1, "warnings": 0, "infos": 0, "hints": 0 },
  "diagnostics": [
    {
      "file": "workflows/example.js",
      "rule": "odw/meta-required",
      "severity": "error",
      "message": "workflow must export const meta",
      "span": {
        "start": { "offset": 0, "line": 1, "column": 1 },
        "end": { "offset": 0, "line": 1, "column": 1 }
      },
      "docs": "docs/rules/meta-required.md",
      "suggestions": []
    }
  ]
}
```

Report consumers should treat `schemaVersion`, `tool`, `summary`, and
`diagnostics` as the stable top-level fields. Diagnostic spans point to the
original source file, not to any normalized parser input. Offsets are
zero-based UTF-8 byte offsets; lines and columns are one-based display
positions. `span.start` is inclusive and `span.end` is exclusive. Point
diagnostics may use a zero-length span where `start` and `end` are identical.

Text output is derived from the same diagnostic objects as JSON output. Use a
machine-readable output format in CI or editor integrations when callers need
stable field names.

## Rule reference

Each diagnostic has a stable rule identifier such as `odw/meta-required`.
Rules are documented from the [rule reference](rules/index.md), which links to
one page per catalogue entry.

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

## Configuration placeholders

Configuration is planned but not implemented yet. The intended first shape is:

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
Unknown configuration keys are expected to be warnings before the configuration
schema stabilizes and errors after it stabilizes.

Until the executable CLI and configuration loader land, treat this section as a
contract placeholder rather than an available feature.

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
