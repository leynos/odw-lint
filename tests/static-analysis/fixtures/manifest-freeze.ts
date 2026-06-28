/**
 * @file Shared runtime freezing for static-analysis fixture manifests.
 *
 * Fixture manifests are reviewer-facing test data. Freeze every nested value
 * at construction time so tests cannot accidentally mutate shared expectations
 * while exercising diagnostics, spans, suggestions, or parser contracts.
 */

type PrimitiveFixtureValue = bigint | boolean | null | number | string | symbol | undefined;

/**
 * Recursively read-only view of a fixture manifest value after runtime freeze.
 */
export type DeepReadonlyFixtureManifest<T> = T extends PrimitiveFixtureValue
  ? T
  : T extends (...args: infer FunctionParameters) => infer FunctionReturn
    ? ((...args: FunctionParameters) => FunctionReturn) & {
        readonly [Key in keyof T]: DeepReadonlyFixtureManifest<T[Key]>;
      }
    : { readonly [Key in keyof T]: DeepReadonlyFixtureManifest<T[Key]> };

/**
 * Deep-freezes a fixture manifest value and all nested object values.
 *
 * @param value - Fixture manifest value to freeze.
 * @returns The same value with a recursively read-only TypeScript view.
 */
export const deepFreezeFixtureManifest = <T>(value: T): DeepReadonlyFixtureManifest<T> => {
  return deepFreezeFixtureManifestImpl(value, new WeakSet<object>());
};

/** Recursively freezes one fixture value while avoiding cycles. */
const deepFreezeFixtureManifestImpl = <T>(
  value: T,
  seenValues: WeakSet<object>,
): DeepReadonlyFixtureManifest<T> => {
  if (isPrimitiveFixtureValue(value)) {
    return value as DeepReadonlyFixtureManifest<T>;
  }

  if (typeof value !== "function" && !isSupportedFixtureContainer(value)) {
    throw new TypeError("Fixture manifests can only deep-freeze plain objects and arrays.");
  }

  if (seenValues.has(value)) {
    return value as DeepReadonlyFixtureManifest<T>;
  }
  seenValues.add(value);

  freezeFixtureProperties(value, seenValues);

  return Object.freeze(value) as DeepReadonlyFixtureManifest<T>;
};

/** Recursively freezes data-property values on one manifest container. */
const freezeFixtureProperties = (value: object, seenValues: WeakSet<object>): void => {
  for (const propertyKey of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey);

    if (descriptor === undefined) {
      continue;
    }

    if (!("value" in descriptor)) {
      throw new TypeError("Fixture manifests cannot contain accessor properties.");
    }

    deepFreezeFixtureManifestImpl(descriptor.value, seenValues);
  }
};

/** Identifies primitive fixture values that do not need runtime freezing. */
const isPrimitiveFixtureValue = (value: unknown): value is PrimitiveFixtureValue => {
  return value === null || (typeof value !== "object" && typeof value !== "function");
};

/** Identifies manifest containers that cannot retain hidden mutable state. */
const isSupportedFixtureContainer = (value: unknown): value is object => {
  if (Array.isArray(value)) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
