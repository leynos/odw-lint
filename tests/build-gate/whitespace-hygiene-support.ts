/**
 * @file Test-only helpers for enforcing tracked-file trailing whitespace hygiene.
 */

export type WhitespaceKind = "space" | "tab";

export type WhitespaceViolation = {
  readonly path: string;
  readonly line: number;
  readonly kind: WhitespaceKind;
};

export type TrackedFileReader = (path: string) => Buffer;

const nulByte = 0x00;
const lineFeed = 0x0a;
const carriageReturn = 0x0d;
const space = 0x20;
const tab = 0x09;

/**
 * Find trailing spaces and tabs in tracked text files.
 *
 * @param paths - Repository-relative tracked paths to inspect.
 * @param readFile - Reader for a candidate path's raw bytes.
 * @returns Trailing whitespace reports for non-binary files.
 */
export function findTrailingWhitespaceViolations(
  paths: readonly string[],
  readFile: TrackedFileReader,
): readonly WhitespaceViolation[] {
  return paths.flatMap((path) => findPathViolations(path, readFile(path)));
}

/**
 * Format trailing-whitespace reports for deterministic build-gate failures.
 *
 * @param violations - Whitespace reports to render.
 * @returns A newline-separated diagnostic message.
 */
export function formatWhitespaceViolations(violations: readonly WhitespaceViolation[]): string {
  return violations
    .map((violation) => `${violation.path}:${violation.line}: trailing ${violation.kind}`)
    .join("\n");
}

/**
 * Find trailing whitespace for one path while preserving raw fixture bytes.
 */
function findPathViolations(path: string, source: Buffer): readonly WhitespaceViolation[] {
  if (source.includes(nulByte)) {
    return [];
  }

  const violations: WhitespaceViolation[] = [];
  let line = 1;

  for (let index = 0; index < source.length; index += 1) {
    const lineEnd = lineEndOffset(source, index);

    if (lineEnd !== undefined) {
      pushViolationForLineEnd(violations, path, line, source, lineEnd);
      line += 1;
    }
  }

  if (source.length > 0 && !isNewlineByte(source[source.length - 1])) {
    pushViolationForLineEnd(violations, path, line, source, source.length);
  }

  return violations;
}

/**
 * Return the exclusive line-end offset when the current byte terminates a line.
 */
function lineEndOffset(source: Buffer, index: number): number | undefined {
  if (isLineFeedTerminator(source, index)) {
    return source[index - 1] === carriageReturn ? index - 1 : index;
  }

  if (isBareCarriageReturn(source, index)) {
    return index;
  }

  return undefined;
}

/**
 * Return whether the byte at `index` is an LF line terminator.
 */
function isLineFeedTerminator(source: Buffer, index: number): boolean {
  return source[index] === lineFeed;
}

/**
 * Return whether the byte at `index` is a CR line terminator outside CRLF.
 */
function isBareCarriageReturn(source: Buffer, index: number): boolean {
  if (source[index] !== carriageReturn) {
    return false;
  }

  return source[index + 1] !== lineFeed;
}

/**
 * Push a trailing-whitespace violation when the line-ending prefix is dirty.
 */
function pushViolationForLineEnd(
  violations: WhitespaceViolation[],
  path: string,
  line: number,
  source: Buffer,
  lineEnd: number,
): void {
  if (lineEnd === 0) {
    return;
  }

  const trailingByte = source[lineEnd - 1];
  const kind = whitespaceKind(trailingByte);

  if (kind !== undefined) {
    violations.push({ path, line, kind });
  }
}

/**
 * Map a raw byte to the trailing-whitespace kind the gate reports.
 */
function whitespaceKind(byte: number | undefined): WhitespaceKind | undefined {
  if (byte === space) {
    return "space";
  }

  if (byte === tab) {
    return "tab";
  }

  return undefined;
}

/**
 * Return whether a byte is any line terminator this scanner understands.
 */
function isNewlineByte(byte: number | undefined): boolean {
  return byte === lineFeed || byte === carriageReturn;
}
