/**
 * @file Usage text for the `check` command.
 */

export const CHECK_USAGE_TEXT = `Usage: odw-lint check [OPTIONS] <workflow.js ...>

Options:
  --output-format <format>       Select output format: full or json.
  --output-file <path>           Write diagnostics to a file instead of stdout.
  --max-warnings <n>             Exit 1 when warnings exceed n.
  --strict-claude                Promote Claude portability findings to errors.
  --config <path>                Load configuration from the given file.
  --isolated                     Ignore discovered configuration files.
  --force-exclude                Apply configured exclusions to explicit paths.
  --respect-gitignore            Respect ignore files during discovery.
  --no-respect-gitignore         Ignore ignore files during discovery.
  --stdin-filename <path>        Analyse stdin as if it came from path.
  --exit-zero                    Exit 0 when diagnostics remain.
  --exit-non-zero-on-fix         Exit 1 if fixes were applied.
  -h, --help                     Show this help message.
  -V, --version                  Show the odw-lint version.`;
