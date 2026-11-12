import {
  BASE_FILE_EXTENSION,
  GENERAL_NOTES_FOLDER,
  TAXONOMY_TABLE_SUFFIX,
} from "./constants";
import type { Taxonomy } from "./taxonomy";
import type { FileCreationPort } from "./types";

const PROPERTY_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const FILE_NAME_COLUMN_WIDTH = 200;
const PROPERTY_COLUMN_WIDTH = 300;

export type TaxonomyTableCreationResult<FileHandle> =
  | { status: "created"; file: FileHandle; path: string }
  | { status: "exists"; path: string };

/** Keeps a name that carries quotes or backslashes inside a quoted YAML scalar. */
export function escapeQuotedYamlScalar(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function displayNameFromPropertyKey(propertyKey: string): string {
  return propertyKey
    .split("_")
    .filter((word) => word.length > 0)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function buildTaxonomyTableFileName(taxonomyName: string): string {
  return `${taxonomyName}${TAXONOMY_TABLE_SUFFIX}${BASE_FILE_EXTENSION}`;
}

export function buildTaxonomyTablePath(taxonomyName: string): string {
  return `${GENERAL_NOTES_FOLDER}/${buildTaxonomyTableFileName(taxonomyName)}`;
}

/**
 * A property key that YAML cannot take bare would produce a `.base` file Bases
 * cannot read, so generation refuses instead of writing a broken table.
 */
export function assertSupportedPropertyKeys(taxonomy: Taxonomy): void {
  if (taxonomy.properties.length === 0) {
    throw new Error(`Taxonomy "${taxonomy.name}" declares no properties.`);
  }

  for (const propertyKey of taxonomy.properties) {
    if (!PROPERTY_KEY_PATTERN.test(propertyKey)) {
      throw new Error(
        `Property "${propertyKey}" of taxonomy "${taxonomy.name}" cannot be ` +
          "a YAML key. Use letters, digits, underscores, or hyphens.",
      );
    }
  }
}

export function buildTaxonomyTableContent(taxonomy: Taxonomy): string {
  assertSupportedPropertyKeys(taxonomy);

  const taxonomyLink = `link("${escapeQuotedYamlScalar(taxonomy.name)}")`;
  const columns = ["file.name", ...taxonomy.properties];

  const propertyBlock = taxonomy.properties
    .map(
      (propertyKey) =>
        `  note.${propertyKey}:\n    displayName: ${displayNameFromPropertyKey(propertyKey)}`,
    )
    .join("\n");

  const columnOrder = columns.map((column) => `      - ${column}`).join("\n");
  const columnSizes = columns
    .map((column) =>
      column === "file.name"
        ? `      ${column}: ${FILE_NAME_COLUMN_WIDTH}`
        : `      note.${column}: ${PROPERTY_COLUMN_WIDTH}`,
    )
    .join("\n");

  return [
    "filters:",
    "  and:",
    `    - taxonomy == ${taxonomyLink}`,
    "    - formula.missing_properties.isEmpty()",
    "formulas:",
    `  required_properties: ${taxonomyLink}.asFile().properties.taxonomy_properties`,
    "  missing_properties: formula.required_properties.filter(!file.hasProperty(value))",
    "properties:",
    propertyBlock,
    "views:",
    "  - type: table",
    "    name: Table",
    "    order:",
    columnOrder,
    "    sort:",
    "      - property: date",
    "        direction: DESC",
    "    rowHeight: medium",
    "    columnSize:",
    columnSizes,
    "",
  ].join("\n");
}

export async function createTaxonomyTable<FileHandle>(
  taxonomy: Taxonomy,
  port: FileCreationPort<FileHandle>,
): Promise<TaxonomyTableCreationResult<FileHandle>> {
  assertSupportedPropertyKeys(taxonomy);

  const path = buildTaxonomyTablePath(taxonomy.name);
  if (port.getFileByPath(path)) return { status: "exists", path };

  await port.ensureFolder(GENERAL_NOTES_FOLDER);
  const file = await port.createFile(path, buildTaxonomyTableContent(taxonomy));

  return { status: "created", file, path };
}
