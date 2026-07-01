/**
 * @file Test-only policy for forbidden executable ODW import specifiers.
 *
 * The classifier is string-based by design: architecture tests need to catch
 * boundary violations without resolving or evaluating imported modules.
 */

const FORBIDDEN_PRIVATE_ODW_MODULES = new Set([
  "src/index",
  "dist/index",
  "src/loader",
  "dist/loader",
  "src/primitives",
  "dist/primitives",
]);

/** Matches private executable ODW paths below package or sibling roots. */
const isPrivateExecutableOdwPath = (modulePath: string): boolean => {
  return (
    FORBIDDEN_PRIVATE_ODW_MODULES.has(modulePath) ||
    modulePath === "src/runtime" ||
    modulePath === "dist/runtime" ||
    modulePath.startsWith("src/runtime/") ||
    modulePath.startsWith("dist/runtime/")
  );
};

/** Matches path-style references into a sibling ODW checkout. */
const isSiblingOdwExecutablePath = (moduleSpecifier: string): boolean => {
  const marker = "/open-dynamic-workflows/";
  const markerIndex = moduleSpecifier.lastIndexOf(marker);

  return (
    markerIndex !== -1 &&
    isPrivateExecutableOdwPath(moduleSpecifier.slice(markerIndex + marker.length))
  );
};

/**
 * Checks whether an import specifier targets executable ODW runtime code.
 *
 * @param moduleSpecifier - Raw module specifier from an import-like edge.
 * @returns `true` when production code must not import the specifier.
 */
export const isForbiddenOdwImport = (moduleSpecifier: string): boolean => {
  const normalized = moduleSpecifier.replaceAll("\\", "/").replace(/\.(?:cts|mts|ts|js)$/u, "");

  if (normalized === "odw") {
    return true;
  }

  if (normalized.startsWith("odw/")) {
    return isPrivateExecutableOdwPath(normalized.slice("odw/".length));
  }

  return isSiblingOdwExecutablePath(normalized);
};
