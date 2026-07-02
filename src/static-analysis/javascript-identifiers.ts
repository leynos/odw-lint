/** @file Shared JavaScript identifier character predicates for static scanners. */

const IDENTIFIER_START_PATTERN = /^[$_\p{ID_Start}]$/u;
const IDENTIFIER_CONTINUE_PATTERN = /^\p{ID_Continue}$/u;

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
