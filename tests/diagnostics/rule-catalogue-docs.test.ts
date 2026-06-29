/**
 * @file Rule documentation parity tests.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { RULE_CATALOGUE, type RuleDefinition } from "odw-lint";

const EXPECTED_METADATA_FIELDS = [
  "Rule ID",
  "Category",
  "Default severity",
  "Configuration key",
  "Release status",
] as const;

type RulePageMetadata = Record<(typeof EXPECTED_METADATA_FIELDS)[number], string>;

type RuleIndexRow = {
  readonly ruleId: string;
  readonly target: string;
  readonly category: string;
  readonly defaultSeverity: string;
  readonly releaseStatus: string;
};

/** Returns the repository-relative rule page path for assertions. */
const rulePagePath = (rule: RuleDefinition): string => {
  return path.join("docs", "rules", `${rule.docsSlug}.md`);
};

/** Reads one UTF-8 Markdown document from the repository root. */
const readMarkdown = (relativePath: string): string => {
  return readFileSync(relativePath, "utf8");
};

/** Removes one required pair of Markdown code ticks from a table value. */
const unquoteCodeValue = (value: string): string => {
  if (!value.startsWith("`") || !value.endsWith("`")) {
    throw new Error(`metadata value must be code-quoted: ${value}`);
  }

  return value.slice(1, -1);
};

/** Splits one Markdown table row into trimmed cell values. */
const tableCells = (row: string): readonly string[] => {
  return row
    .trim()
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
};

/** Reports whether a rule page begins with the required heading line. */
const hasExpectedRuleHeading = (lines: readonly string[], rule: RuleDefinition): boolean => {
  return lines[0] === `# \`${String(rule.id)}\``;
};

/** Reports whether a rule page begins its fixed metadata table after the H1. */
const hasExpectedRuleMetadataStart = (lines: readonly string[]): boolean => {
  const [fieldHeader, valueHeader] = tableCells(lines[2] ?? "");

  return lines[1] === "" && fieldHeader === "Field" && valueHeader === "Value";
};

/** Parses the fixed metadata table immediately after the rule page heading. */
const readRulePageMetadata = (rule: RuleDefinition): RulePageMetadata => {
  const relativePath = rulePagePath(rule);
  const lines = readMarkdown(relativePath).split(/\r?\n/u);
  const tableStart = 2;

  if (!hasExpectedRuleHeading(lines, rule) || !hasExpectedRuleMetadataStart(lines)) {
    throw new Error(`${relativePath} must start with its rule heading and metadata table`);
  }

  const rows = lines
    .slice(tableStart + 2, tableStart + 2 + EXPECTED_METADATA_FIELDS.length)
    .map((line) => line.trim());

  const metadata = Object.fromEntries(
    rows.map((row) => {
      const cells = tableCells(row);
      return [cells[0] ?? "", unquoteCodeValue(cells[1] ?? "")];
    }),
  );

  expect(Object.keys(metadata)).toEqual([...EXPECTED_METADATA_FIELDS]);

  return metadata as RulePageMetadata;
};

/** Builds the expected page metadata from one catalogue entry. */
const expectedMetadataForRule = (rule: RuleDefinition): RulePageMetadata => {
  return {
    "Rule ID": String(rule.id),
    Category: rule.category,
    "Default severity": rule.defaultSeverity,
    "Configuration key": String(rule.configKey),
    "Release status": rule.releaseStatus,
  };
};

/** Parses the linked rule identifier and target from one index table cell. */
const parseRuleIndexRuleCell = (cell: string): Pick<RuleIndexRow, "ruleId" | "target"> => {
  const match = /^\[`([^`]+)`\]\(([^)]+\.md)\)$/u.exec(cell);
  const [, ruleId, target] = match ?? [];

  if (ruleId === undefined || target === undefined) {
    throw new Error(`rule index cell must link a code-quoted rule id: ${cell}`);
  }

  return { ruleId, target };
};

/** Extracts rule metadata rows from the rule index table. */
const ruleIndexRows = (): readonly RuleIndexRow[] => {
  const indexMarkdown = readMarkdown(path.join("docs", "rules", "index.md"));
  const lines = indexMarkdown.split(/\r?\n/u);
  const tableStart = lines.findIndex((line) => {
    const [ruleHeader, categoryHeader, severityHeader, statusHeader] = tableCells(line);
    return (
      ruleHeader === "Rule" &&
      categoryHeader === "Category" &&
      severityHeader === "Default severity" &&
      statusHeader === "Release status"
    );
  });

  if (tableStart < 0) {
    throw new Error("docs/rules/index.md must contain the rule metadata index table");
  }

  return lines
    .slice(tableStart + 2)
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => {
      const [ruleCell, category, defaultSeverity, releaseStatus] = tableCells(line);
      const { ruleId, target } = parseRuleIndexRuleCell(ruleCell ?? "");

      return {
        ruleId,
        target,
        category: unquoteCodeValue(category ?? ""),
        defaultSeverity: unquoteCodeValue(defaultSeverity ?? ""),
        releaseStatus: unquoteCodeValue(releaseStatus ?? ""),
      };
    });
};

/** Builds the expected index metadata from one catalogue entry. */
const expectedIndexRowForRule = (rule: RuleDefinition): RuleIndexRow => {
  return {
    ruleId: String(rule.id),
    target: `${rule.docsSlug}.md`,
    category: rule.category,
    defaultSeverity: rule.defaultSeverity,
    releaseStatus: rule.releaseStatus,
  };
};

/** Extracts Markdown link targets from the parsed rule index table. */
const ruleIndexTargets = (): readonly string[] => {
  return ruleIndexRows()
    .map((row) => row.target)
    .sort();
};

/** Lists rule documentation page slugs, excluding the index page. */
const documentedRulePageSlugs = (): readonly string[] => {
  return readdirSync(path.join("docs", "rules"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md")
    .map((entry) => entry.name.replace(/\.md$/u, ""))
    .sort();
};

describe("rule catalogue documentation", () => {
  it("maps every catalogue docs slug to a rule page", () => {
    for (const rule of RULE_CATALOGUE) {
      expect(existsSync(rulePagePath(rule)), rulePagePath(rule)).toBeTrue();
    }
  });

  it("provides pages for every released rule", () => {
    const missingReleasedRules = RULE_CATALOGUE.filter(
      (rule) => rule.releaseStatus === "released" && !existsSync(rulePagePath(rule)),
    ).map((rule) => String(rule.id));

    expect(missingReleasedRules).toEqual([]);
  });

  it("keeps rule page metadata aligned with the catalogue", () => {
    for (const rule of RULE_CATALOGUE) {
      expect(readRulePageMetadata(rule)).toEqual(expectedMetadataForRule(rule));
    }
  });

  it("keeps rule index metadata aligned with the catalogue", () => {
    expect(ruleIndexRows()).toEqual(RULE_CATALOGUE.map(expectedIndexRowForRule));
  });

  it("links the index to every catalogue page", () => {
    expect(ruleIndexTargets()).toEqual(RULE_CATALOGUE.map((rule) => `${rule.docsSlug}.md`).sort());
  });

  it("rejects orphan rule pages not backed by the catalogue", () => {
    expect(documentedRulePageSlugs()).toEqual(RULE_CATALOGUE.map((rule) => rule.docsSlug).sort());
  });
});
