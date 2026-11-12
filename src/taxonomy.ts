import {
  TAXONOMY_FRONTMATTER_KEY,
  TAXONOMY_PROPERTIES_KEY,
} from "./constants";

export interface TaxonomySource {
  path: string;
  basename: string;
  frontmatter: Record<string, unknown> | undefined;
}

export interface Taxonomy {
  /** Note path. This is the identity, so two same-named notes stay distinct. */
  path: string;
  /** Note basename. This is the display name and the wikilink target. */
  name: string;
  /** Property keys in the order the taxonomy note declares them. */
  properties: string[];
}

export interface ExistingTaxonomyLink {
  /** Frontmatter text exactly as stored, for the warning message. */
  raw: string;
  /** Link target with brackets, heading, and alias stripped. */
  target: string;
}

const WIKILINK_TARGET_PATTERN = /^\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/;
const PROPERTY_LIST_SEPARATOR_PATTERN = /[,\s]+/;

/**
 * `taxonomy_properties` arrives untyped: a bare string, a list, an empty list,
 * or no value at all are all possible while a note is being written.
 */
export function readTaxonomyProperties(
  frontmatter: Record<string, unknown> | undefined,
): string[] {
  const rawValue = frontmatter?.[TAXONOMY_PROPERTIES_KEY];
  const candidates =
    typeof rawValue === "string"
      ? rawValue.split(PROPERTY_LIST_SEPARATOR_PATTERN)
      : Array.isArray(rawValue)
        ? rawValue
        : [];

  const properties = candidates
    .filter((candidate): candidate is string => typeof candidate === "string")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);

  return [...new Set(properties)];
}

/** Notes with an empty or absent property list are not taxonomies. */
export function collectTaxonomies(
  sources: readonly TaxonomySource[],
): Taxonomy[] {
  return sources
    .map((source) => ({
      path: source.path,
      name: source.basename,
      properties: readTaxonomyProperties(source.frontmatter),
    }))
    .filter((taxonomy) => taxonomy.properties.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildTaxonomyLink(taxonomyName: string): string {
  return `[[${taxonomyName}]]`;
}

/** Returns null when the note carries no taxonomy value it could act on. */
export function readExistingTaxonomyLink(
  frontmatter: Record<string, unknown> | undefined,
): ExistingTaxonomyLink | null {
  const rawValue = frontmatter?.[TAXONOMY_FRONTMATTER_KEY];
  if (rawValue === undefined || rawValue === null) return null;

  if (Array.isArray(rawValue)) {
    const joined = rawValue
      .filter((entry): entry is string => typeof entry === "string")
      .join(", ");
    if (joined.trim().length === 0) return null;

    return buildExistingLink(joined);
  }

  if (typeof rawValue !== "string") return buildExistingLink(String(rawValue));

  return rawValue.trim().length === 0 ? null : buildExistingLink(rawValue);
}

function buildExistingLink(rawValue: string): ExistingTaxonomyLink {
  const raw = rawValue.trim();

  return { raw, target: extractLinkTarget(raw) };
}

/** `[[target|alias]]`, `[[target#heading]]`, and a bare `target` all yield the target. */
export function extractLinkTarget(rawValue: string): string {
  const trimmed = rawValue.trim();
  const bracketedTarget = WIKILINK_TARGET_PATTERN.exec(trimmed)?.[1];
  if (bracketedTarget !== undefined) return bracketedTarget.trim();

  return trimmed;
}
