/**
 * @file Shared UTF-8 byte-length primitives for static analysis.
 *
 * Static-analysis spans use UTF-8 byte offsets even though TypeScript strings
 * expose UTF-16 indexes. Keep byte-width calculations behind one reviewed
 * helper so parser, normalizer, and source-position code agree.
 */

const TEXT_ENCODER = new TextEncoder();

/**
 * Returns the UTF-8 byte length of a JavaScript string.
 *
 * @param text - Source text slice to measure.
 * @returns UTF-8 byte length of `text`.
 */
export const utf8ByteLength = (text: string): number => {
  return TEXT_ENCODER.encode(text).byteLength;
};
