/**
 * @file Tests for tracked-file trailing whitespace detection helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  findTrailingWhitespaceViolations,
  formatWhitespaceViolations,
  parseNulSeparatedPaths,
} from "./whitespace-hygiene-support";

const filePath = "fixtures/workflow.js";

/**
 * Run the scanner against one in-memory file fixture.
 */
function findViolations(source: string): ReturnType<typeof findTrailingWhitespaceViolations> {
  return findTrailingWhitespaceViolations([filePath], (path) => {
    expect(path).toBe(filePath);
    return Buffer.from(source, "utf8");
  });
}

describe("parseNulSeparatedPaths", () => {
  it("removes empty separator segments from Git path streams", () => {
    expect(parseNulSeparatedPaths("src/a.ts\0tests/b.ts\0\0")).toEqual(["src/a.ts", "tests/b.ts"]);
  });
});

describe("findTrailingWhitespaceViolations", () => {
  it("reports trailing spaces before LF", () => {
    expect(findViolations("clean\nbad \n")).toEqual([{ path: filePath, line: 2, kind: "space" }]);
  });

  it("reports trailing tabs before CRLF", () => {
    expect(findViolations("clean\r\nbad\t\r\n")).toEqual([
      { path: filePath, line: 2, kind: "tab" },
    ]);
  });

  it("reports trailing spaces before bare CR", () => {
    expect(findViolations("clean\rbad \r")).toEqual([{ path: filePath, line: 2, kind: "space" }]);
  });

  it("reports trailing tabs at end of file without a final newline", () => {
    expect(findViolations("clean\nbad\t")).toEqual([{ path: filePath, line: 2, kind: "tab" }]);
  });

  it("reports whitespace-only lines as trailing whitespace", () => {
    expect(findViolations("clean\n  \n\t\n")).toEqual([
      { path: filePath, line: 2, kind: "space" },
      { path: filePath, line: 3, kind: "tab" },
    ]);
  });

  it("ignores clean text lines", () => {
    expect(findViolations("clean\nalso-clean\r\nfinal")).toEqual([]);
  });

  it("skips binary buffers containing NUL bytes", () => {
    expect(findViolations("bad \n\0")).toEqual([]);
  });
});

describe("formatWhitespaceViolations", () => {
  it("formats violations in scanner order", () => {
    expect(
      formatWhitespaceViolations([
        { path: "a.js", line: 1, kind: "space" },
        { path: "b.js", line: 4, kind: "tab" },
      ]),
    ).toMatchInlineSnapshot(`
"a.js:1: trailing space
b.js:4: trailing tab"
`);
  });
});
