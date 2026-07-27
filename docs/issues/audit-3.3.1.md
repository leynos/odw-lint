# Audit after roadmap task 3.3.1

This post-step audit was run after roadmap task 3.3.1, "Implement optional
configuration loading with include, exclude, strictness, and rule severity
settings", squash-merged into `origin/main` at commit `a2cc209` ("Implement
optional lint configuration"). That change added the `src/config/` module
(`load-config.ts`, `linter-config.ts`, `apply-config-severities.ts`), wired
`--config` and `--isolated` into the explicit-path `check` CLI, and taught
`runCheck` to apply configured per-rule severities before strict-Claude
promotion.

The audit was performed in a fresh worktree off `origin/main` (branch
`worktree-df12-audit-3.3.1-post`, base commit `94d5117`, which contains the
3.3.1 merge `a2cc209`). Every branch-local fact below was verified by direct
file inspection in that worktree.

The 3.3.1 success criteria hold: unknown rule identifiers fail configuration
validation (`linter-config.ts:300`-`308`), and `strictClaude` feeds the
strict-Claude promotion mechanism from 3.1.3 (`run-check.ts:41`-`43`). The
developer documentation was updated to describe the schema and pipeline order
(`docs/developers-guide.md:205`-`248`), and the configuration test coverage is
thorough (`tests/config/*.test.ts`, `tests/cli/check-cli-config.test.ts`). The
findings below concentrate on what the merge left un-reconciled: user-facing
documentation that still describes configuration as unimplemented, a repository
map that never grew rows for the `src/config/` and `src/cli/` modules, an
incomplete CLI usage string, and a handful of small internal duplications and
robustness gaps in the new loader and argument parser.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/repository-layout.md`
- `docs/roadmap.md`
- `docs/technical-design.md`
- `docs/users-guide.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- Branch-local file inspection and `grep`: source verification in the fresh
  worktree.

Tooling note: the `grepai` intent index reflects `main` only and was not used
as evidence for the branch-local `src/config/` code; `git fetch` and manual
`git worktree add` were auto-denied by the sandbox permission layer, so the
inspection worktree was created with the harness `EnterWorktree` mechanism off
`origin/main`. Every finding is grounded in direct branch-local file inspection.

## Finding 1: the user guide still describes configuration as unimplemented

Category: docs-gap

Severity: medium

Location:

- `docs/users-guide.md:142`
- `docs/users-guide.md:56`

Description:

Task 3.3.1 shipped configuration loading, yet `docs/users-guide.md` still tells
users the feature does not exist. The "Configuration placeholders" section
opens with "Configuration is planned but not implemented yet"
(`users-guide.md:144`) and closes by instructing readers to "treat this section
as a contract placeholder rather than an available feature"
(`users-guide.md:166`-`167`). The flag list higher up lists `--config` and
`--isolated` under "The planned options follow `ruff check`"
(`users-guide.md:47`, `:58`-`:59`), presenting live options as future work. The
developer guide was updated for this change (`developers-guide.md:205`-`248`),
so the two documents now contradict each other on whether configuration is
available. A user reading only the user guide would not discover that
`odw-lint.json`, `--config <path>`, `--isolated`, `strictClaude`, and per-rule
`rules` severities all work today.

Proposed fix:

Rewrite the "Configuration placeholders" section as a "Configuration" section
that documents the shipped behaviour: default discovery of `odw-lint.json` in
the working directory, `--config <path>` for an explicit file, `--isolated` to
skip discovery, the `strictClaude` boolean, and the `rules` map with `error`,
`warning`, `info`, `hint`, and `off` values. Move `--config` and `--isolated`
out of the "planned options" list into an "available now" note alongside
`--output-format`, and state which keys remain inert (see Finding 6).

## Finding 2: the repository map omits the `src/config/` and `src/cli/` modules

Category: docs-gap

Severity: low

Location:

- `docs/repository-layout.md:26`
- `docs/repository-layout.md:28`

Description:

The repository layout table documents `src/diagnostics/` and
`src/static-analysis/` (`repository-layout.md:26`-`27`) and their sibling test
directories (`:28`-`:29`), but it has no row for `src/cli/` or for the
`src/config/` module that 3.3.1 introduced, nor for `tests/config/` or
`tests/cli/`. The table presents itself as the canonical path-ownership map, so
a reader using it to locate configuration loading or CLI argument parsing finds
no entry, and the ownership-boundary guidance (for example, that `src/config/`
must not import workflow-source readers, as its module doc comments assert) is
absent from the one document meant to record such boundaries.

Proposed fix:

Add table rows for `src/cli/` (argument parsing, report writing, and process
wiring for the `check` command) and `src/config/` (inert configuration
discovery, schema validation, and severity application, which must not import
workflow-source readers or ODW runtime helpers), plus `tests/config/` and
`tests/cli/`. Mirror the ownership-boundary wording already used for the other
`src/` rows.

## Finding 3: the CLI usage string omits every accepted option

Category: docs-gap

Severity: low

Location:

- `src/cli/check-cli.ts:65`

Description:

The `check` command's usage string is `usage: odw-lint check <workflow.js ...>`
(`check-cli.ts:65`). It is emitted for every usage error — no subcommand,
missing paths, and (via `parseCheckArgs`) an empty operand list — yet it
mentions none of the options the parser actually accepts: `--config <path>`,
`--isolated`, and `--output-format full|json`. A user who mistypes an option
and triggers the usage message is shown a synopsis that hides the options they
were reaching for. This is a small ergonomics gap that widened with 3.3.1,
which added two of the three flags the string omits.

Proposed fix:

Expand the usage string to reflect the implemented surface, for example
`usage: odw-lint check [--config <path>] [--isolated] [--output-format
full|json] <workflow.js …>`.
Keep it aligned with the user-guide flag list (Finding 1) so the two stay in
step as further flags land.

## Finding 4: the two config loaders duplicate the parse-and-validate tail

Category: duplication

Severity: low

Location:

- `src/config/load-config.ts:208`
- `src/config/load-config.ts:224`

Description:

`loadConfigFile` and `loadDefaultConfigFile` differ only in how they treat a
read failure — the explicit-path loader surfaces every read error, while the
default loader maps a "not-found" read to `EMPTY_CONFIG_RESULT`. After the read
step they share a byte-identical parse-and-validate tail:

```ts
const parsed = parseConfigJson(filePath, readResult.text);
return parsed.ok
  ? validateParsedConfig(filePath, parsed.value)
  : { ok: false, error: parsed.error };
```

This block appears at `load-config.ts:208`-`211` and again at `:224`-`:227`.
The duplication is small but it is exactly the kind that drifts: a future
change to how parse failures are reported (or an extra validation step) must be
made in two places, and a change to only one would diverge silently.

Proposed fix:

Extract a private `parseAndValidate(filePath, text)` helper returning
`ConfigLoadResult`, and call it from both loaders after each has resolved its
own read policy. The two loaders then differ only in their read-failure
branches, which is their genuine distinction.

## Finding 5: `--config` consumes an option-like token as its file path

Category: ergonomics

Severity: low

Location:

- `src/cli/check-cli.ts:172`

Description:

`parseCheckOption` reads the token after `--config` as the configuration path
without checking whether it looks like another option (`check-cli.ts:172`-
`181`). Invoking `check --config --isolated workflow.js` therefore treats
`--isolated` as a file path: the loader attempts to read a file literally named
`--isolated`, fails, and reports
`error: configuration: cannot read --isolated: ...`. The user intended to
enable isolated mode, so the diagnostic points at a phantom file rather than at
the real mistake (a missing `--config` value). The sibling `--output-format`
handler routes through `parseOutputFormatValue`, which at least rejects a
missing value explicitly; the `--config` handler has no equivalent guard.

Proposed fix:

Reject an option-like value for `--config` the same way a missing value is
rejected: if the next token is `undefined` or begins with `-`, return a usage
error such as `missing value for --config`. That turns the confusing
phantom-file read error into an actionable usage message.

## Finding 6: `include` and `exclude` are validated and stored but have no effect

Category: inconsistency

Severity: low

Location:

- `src/config/linter-config.ts:200`
- `docs/users-guide.md:142`

Description:

`validateLinterConfig` fully validates `include` and `exclude` as arrays of
non-empty strings and stores them on the returned `LinterConfig`
(`linter-config.ts:200`-`214`), but nothing consumes them: configured discovery
is deferred to a later roadmap task, and the explicit-path `check` command
reads only the paths passed on the command line. The keys' own doc comments
admit this ("glob patterns to include during *future* configured discovery",
`linter-config.ts:31`-`34`). The developer guide notes the deferral
(`developers-guide.md:246`-`248`), but nothing user-facing warns that a
carefully written `include`/`exclude` block in `odw-lint.json` is silently
inert. Combined with Finding 1, a user could author the very placeholder
example the user guide still prints (which leads with `include`/`exclude`) and
observe no change in which files are checked.

Proposed fix:

When documenting the shipped configuration (Finding 1), state explicitly that
`include` and `exclude` are accepted and validated but do not yet affect file
discovery, and that the command remains path-first until configured discovery
lands. Optionally, emit a one-line configuration warning when `include` or
`exclude` is present but discovery is not in use, reusing the existing
`ConfigValidationWarning` channel so the inertness is visible at run time
rather than only in prose.

## Finding 7: whole-report policy is applied per file inside the read loop

Category: separation-of-concerns

Severity: low

Location:

- `src/cli/run-check.ts:68`

Description:

`runCheck` applies configured severities and strict-Claude promotion inside the
per-file read loop: each file's diagnostics are passed through
`applyCheckConfiguration` before being pushed onto the aggregate
(`run-check.ts:68`-`70`). The transform is a whole-report severity policy, not
a per-file concern — it re-freezes and re-`flatMap`s once per input file and
interleaves a global policy step with per-file reading. The behaviour is
correct because each diagnostic is transformed independently, but the structure
obscures that severity policy is a single pass over the finished diagnostic set.

Proposed fix:

Collect raw diagnostics per file in the loop, then apply
`applyCheckConfiguration` once over the aggregated array before building the
report. That expresses the policy as the whole-report transform it is, applies
it exactly once, and keeps the read loop responsible only for reading and
linting.

## Finding 8: explicit `--config` read failures are untested

Category: test-gap

Severity: low

Location:

- `tests/cli/check-cli-config.test.ts:96`
- `src/config/load-config.ts:201`

Description:

`check-cli-config.test.ts` covers unknown-rule validation, `strictClaude`
promotion, `off` suppression, `--isolated`, the `--config`/`--isolated`
conflict, missing `--config` value, and malformed JSON, but it never exercises
an explicit `--config` path that cannot be read. The `loadConfigFile`
read-error branch (`load-config.ts:201`-`205`) and the `reasonForErrnoCode`
mapping of `ENOENT` to `not-found` and `EISDIR` to `not-a-file`
(`load-config.ts:125`-`134`) are therefore unverified at the CLI boundary: no
test asserts that `--config missing.json` exits 2 with an
`error: configuration: cannot read` message, and the `not-a-file` reason has no
coverage at all. This is the one config load-error kind the CLI can reach that
lacks an end-to-end regression pin.

Proposed fix:

Add cases to `check-cli-config.test.ts` for an explicit `--config` path whose
injected reader throws `ENOENT` (asserting exit 2 and the `cannot read`
message) and, if practical, one that throws `EISDIR`, so the read-failure
branch and its stable reason mapping are pinned alongside the parse and
validation paths already covered.
