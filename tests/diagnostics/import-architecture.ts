/**
 * @file Barrel exports for import architecture test-support helpers.
 *
 * Responsibility-specific modules keep parsing, edge extraction, ODW import
 * policy, and export-shape facts independently extendable.
 */

export type { ExportDeclarationFact } from "./export-facts";
export { exportDeclarationFacts, exportedModuleSpecifiers } from "./export-facts";
export type {
  ComputedCommonJsRequire,
  ComputedDynamicImport,
  ImportArchitectureFacts,
  ImportLikeEdge,
} from "./import-edge-extraction";
export { importArchitectureFactsFromSource } from "./import-edge-extraction";
export { isForbiddenOdwImport } from "./odw-import-policy";
export { parseSource, topLevelDeclarationNames } from "./source-parsing";
