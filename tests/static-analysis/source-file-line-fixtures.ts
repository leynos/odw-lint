/**
 * @file Line-metadata fixtures for original source-file tests.
 */

import type { SourceLine } from "odw-lint";

export type SourceFileFixture = {
  /** Human-readable fixture name. */
  readonly name: string;
  /** Original source text used to build the source-file record. */
  readonly sourceText: string;
  /** Expected UTF-8 byte length for the whole source. */
  readonly byteLength: number;
  /** Expected display-line metadata. */
  readonly lines: readonly SourceLine[];
};

/** Line-index fixtures covering empty, newline, and Unicode source variants. */
export const SOURCE_FILE_FIXTURES: readonly SourceFileFixture[] = [
  {
    name: "empty source",
    sourceText: "",
    byteLength: 0,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 0,
        terminatorEndOffset: 0,
        text: "",
      },
    ],
  },
  {
    name: "one ASCII line without newline",
    sourceText: "const meta = {};",
    byteLength: 16,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 16,
        terminatorEndOffset: 16,
        text: "const meta = {};",
      },
    ],
  },
  {
    name: "LF lines",
    sourceText: "meta\nbody",
    byteLength: 9,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 4,
        terminatorEndOffset: 5,
        text: "meta",
      },
      {
        line: 2,
        startOffset: 5,
        contentEndOffset: 9,
        terminatorEndOffset: 9,
        text: "body",
      },
    ],
  },
  {
    name: "single LF creates two empty lines",
    sourceText: "\n",
    byteLength: 1,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 0,
        terminatorEndOffset: 1,
        text: "",
      },
      {
        line: 2,
        startOffset: 1,
        contentEndOffset: 1,
        terminatorEndOffset: 1,
        text: "",
      },
    ],
  },
  {
    name: "CRLF lines",
    sourceText: "meta\r\nbody",
    byteLength: 10,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 4,
        terminatorEndOffset: 6,
        text: "meta",
      },
      {
        line: 2,
        startOffset: 6,
        contentEndOffset: 10,
        terminatorEndOffset: 10,
        text: "body",
      },
    ],
  },
  {
    name: "JavaScript line and paragraph separators",
    sourceText: "ab\u2028cd\u2029e",
    byteLength: 11,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 2,
        terminatorEndOffset: 5,
        text: "ab",
      },
      {
        line: 2,
        startOffset: 5,
        contentEndOffset: 7,
        terminatorEndOffset: 10,
        text: "cd",
      },
      {
        line: 3,
        startOffset: 10,
        contentEndOffset: 11,
        terminatorEndOffset: 11,
        text: "e",
      },
    ],
  },
  {
    name: "single CRLF creates two empty lines",
    sourceText: "\r\n",
    byteLength: 2,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 0,
        terminatorEndOffset: 2,
        text: "",
      },
      {
        line: 2,
        startOffset: 2,
        contentEndOffset: 2,
        terminatorEndOffset: 2,
        text: "",
      },
    ],
  },
  {
    name: "single CR creates two empty lines",
    sourceText: "\r",
    byteLength: 1,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 0,
        terminatorEndOffset: 1,
        text: "",
      },
      {
        line: 2,
        startOffset: 1,
        contentEndOffset: 1,
        terminatorEndOffset: 1,
        text: "",
      },
    ],
  },
  {
    name: "Unicode code points",
    sourceText: "é\n😀",
    byteLength: 7,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 2,
        terminatorEndOffset: 3,
        text: "é",
      },
      {
        line: 2,
        startOffset: 3,
        contentEndOffset: 7,
        terminatorEndOffset: 7,
        text: "😀",
      },
    ],
  },
  {
    name: "trailing LF creates an empty final line",
    sourceText: "body\n",
    byteLength: 5,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 4,
        terminatorEndOffset: 5,
        text: "body",
      },
      {
        line: 2,
        startOffset: 5,
        contentEndOffset: 5,
        terminatorEndOffset: 5,
        text: "",
      },
    ],
  },
  {
    name: "trailing CRLF creates an empty final line",
    sourceText: "body\r\n",
    byteLength: 6,
    lines: [
      {
        line: 1,
        startOffset: 0,
        contentEndOffset: 4,
        terminatorEndOffset: 6,
        text: "body",
      },
      {
        line: 2,
        startOffset: 6,
        contentEndOffset: 6,
        terminatorEndOffset: 6,
        text: "",
      },
    ],
  },
];
