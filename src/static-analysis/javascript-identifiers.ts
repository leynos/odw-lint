/** @file Shared JavaScript identifier character predicates for static scanners. */

const IDENTIFIER_START_PATTERN = /^[$_\p{ID_Start}]$/u;
const IDENTIFIER_CONTINUE_PATTERN = /^\p{ID_Continue}$/u;
const ASCII_IDENTIFIER_START_CHARACTER_PATTERN = /^[A-Za-z_$]$/u;
const ASCII_IDENTIFIER_CHARACTER_PATTERN = /^[0-9A-Za-z_$]$/u;

/**
 * Checks whether a complete code point can start a JavaScript identifier.
 *
 * @param character - Source code point to classify.
 * @returns Whether the code point can start an identifier.
 */
export const isIdentifierStartCharacter = (character: string | undefined): boolean => {
  return character !== undefined && IDENTIFIER_START_PATTERN.test(character);
};

/**
 * Checks whether a complete code point can continue a JavaScript identifier.
 *
 * ECMAScript permits zero-width non-joiner and zero-width joiner as identifier
 * parts even though they are not identifier starts.
 *
 * @param character - Source code point to classify.
 * @returns Whether the code point can continue an identifier.
 */
export const isIdentifierPartCharacter = (character: string | undefined): boolean => {
  return (
    character !== undefined &&
    (character === "\u200c" ||
      character === "\u200d" ||
      isIdentifierStartCharacter(character) ||
      IDENTIFIER_CONTINUE_PATTERN.test(character))
  );
};

/**
 * Checks whether one ASCII character can be part of an identifier-like token.
 *
 * Parser diagnostics expose byte-oriented offsets, so token narrowing must not
 * advance through non-ASCII code points by accident.
 *
 * @param character - Source character to classify.
 * @returns Whether the character is an ASCII identifier byte.
 */
export const isAsciiIdentifierCharacter = (character: string | undefined): boolean => {
  return character !== undefined && ASCII_IDENTIFIER_CHARACTER_PATTERN.test(character);
};

/**
 * Checks whether one ASCII character can start an identifier-like token.
 *
 * This is intentionally narrower than ECMAScript identifier starts because the
 * source masker tracks JavaScript keywords in ASCII source text.
 *
 * @param character - Source character to classify.
 * @returns Whether the character is an ASCII identifier-start byte.
 */
export const isAsciiIdentifierStartCharacter = (character: string | undefined): boolean => {
  return character !== undefined && ASCII_IDENTIFIER_START_CHARACTER_PATTERN.test(character);
};
