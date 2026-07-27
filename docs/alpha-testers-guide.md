# Alpha tester's guide

This guide is for early testers trying `odw-lint` against real Open Dynamic
Workflow (ODW) workflow files before the package is ready for normal
installation or Continuous Integration (CI) rollout.

## What is ready to try

Use the Bun entrypoint from this repository:

```bash
bun src/cli/main.ts check path/to/workflow.js --output-format full
```

JSON output is also available:

```bash
bun src/cli/main.ts check path/to/workflow.js --output-format json
```

The useful alpha path is explicit-file linting. Testers should point the
command at one or more known workflow files and compare the findings with their
own understanding of the workflow.

## Current limitations

- The package does not yet expose an installed `odw-lint` binary through
  `package.json`; run the Bun entrypoint directly.
- Directory discovery, configured include globs, gitignore-aware traversal, and
  exclude filtering are still in progress. Prefer explicit workflow paths.
- Fix mode is not implemented. Options related to future fixes are not a
  promise that files will be rewritten today.
- The first rule set is intentionally narrow. The tool is useful for static
  workflow-shape checks, deterministic-time compatibility checks, and selected
  Claude Code portability checks, not for proving that a workflow is well
  designed.
- The text format is human-facing. Consumers that need stable fields should
  use `--output-format json`.
- The project is pre-release. JSON `schemaVersion` exists, but the package
  version, binary packaging, and CI examples are not final.

## Known broken or incomplete areas

- `--format` is not accepted; use `--output-format`.
- Running the command with no paths does not yet perform the planned configured
  discovery pass.
- Shell-expanded globs may work only as paths expanded by the shell. Tool-owned
  glob expansion remains planned.
- `--respect-gitignore`, `--no-respect-gitignore`, and `--force-exclude` do
  not yet provide the full planned discovery behaviour for explicit paths.
- `--fix`, `--fix-only`, `--diff`, `--unsafe-fixes`, and
  `--exit-non-zero-on-fix` are future-facing until the fix engine lands.
- Alternate report formats such as JSON Lines, SARIF, GitHub, GitLab, JUnit,
  and editor-oriented output are not available yet.
- Orchestration-risk rules for bounded loops, fan-out, and completion-order
  hazards are not complete.

## Feedback the project needs

The most useful feedback is concrete and reproducible:

- workflow paths that produced surprising diagnostics,
- workflow paths that should have produced diagnostics but did not,
- diagnostics with unclear wording or unhelpful source spans,
- cases where JSON output was awkward to consume from scripts,
- option names or exit behaviour that felt surprising,
- real workflow patterns that should become regression fixtures, and
- false positives caused by common ODW idioms.

Include the command, exit code, `--output-format json` output when possible,
and whether the workflow runs successfully under ODW.

## Suggested alpha test loop

1. Start with one known workflow file.
2. Run the full text output and inspect the diagnostic wording.
3. Run JSON output and check whether `summary`, `diagnostics`, and `ioErrors`
   are easy to consume.
4. Try a workflow with known compatibility issues and check whether the finding
   is useful rather than merely technically correct.
5. Try a clean workflow and report any noise.

## Next steps before beta

- Add the published command entry in package metadata.
- Finish configured discovery, glob expansion, ignore handling, and exclusion
  semantics.
- Complete the first orchestration-risk rules.
- Add fix-reporting contracts, the fix engine, and at least one safe fix.
- Broaden CLI-mode coverage for strict mode, warning budgets, output formats,
  stdin, unreadable files, and future fix flags.
- Add user documentation and CI examples for normal installation.

## Open questions

- Should `--format` be accepted as an alias for `--output-format`, or should
  the project stay strictly aligned with Ruff's flag name?
- Which real ODW idioms should be considered lint-clean even if they are hard
  to analyse statically?
- Which findings should become errors by default, and which should remain
  warnings until strict compatibility mode is selected?
- What is the smallest useful safe fix for the first fix-mode release?
- Should the v1 package support editor integrations directly, or should editor
  support wait for a later language-server decision?
