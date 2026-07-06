#!/usr/bin/env bun
/**
 * @file Thin Bun entrypoint for the explicit-path `odw-lint check` command.
 */

import { runCheckCli } from "./check-cli";

if (import.meta.main) {
  process.exitCode = runCheckCli(process.argv.slice(2));
}
