import { TAXONOMY_FRONTMATTER_KEY } from "./constants";
import {
  buildTaxonomyLink,
  readExistingTaxonomyLink,
  readTaxonomyProperties,
  type Taxonomy,
} from "./taxonomy";

export interface ApplyClassification {
  /** Wikilink to write, or null to keep the note's existing taxonomy field. */
  taxonomyLink: string | null;
  /** Keys absent from the note. Present keys are never overwritten. */
  propertyKeys: string[];
}

export interface ClassificationPort {
  readFrontmatter(filePath: string): Record<string, unknown> | undefined;
  /** Resolves a link target against the vault; null when nothing matches. */
  resolveLinkPath(linkTarget: string, sourcePath: string): string | null;
  applyClassification(filePath: string, apply: ApplyClassification): Promise<void>;
}

export type ClassificationBlockReason =
  | "taxonomy-note"
  | "different-taxonomy"
  | "unresolved-taxonomy";

export type ClassificationOutcome =
  | {
      status: "applied";
      taxonomyName: string;
      addedKeys: string[];
      keptKeyCount: number;
      wroteTaxonomyLink: boolean;
    }
  | { status: "nothing-to-do"; taxonomyName: string }
  | {
      status: "blocked";
      reason: ClassificationBlockReason;
      existingRaw: string | null;
    };

/**
 * Decides what to write, then writes it in one call.
 *
 * A note already linked to the same taxonomy is a repair: the link stays and
 * only the absent keys are added, which is the state the taxonomy's own table
 * filters for. Any other taxonomy value blocks, because a note carries one
 * taxonomy and the shared-key meaning would collide.
 */
export async function classifyNote(
  filePath: string,
  taxonomy: Taxonomy,
  port: ClassificationPort,
): Promise<ClassificationOutcome> {
  const frontmatter = port.readFrontmatter(filePath);

  if (readTaxonomyProperties(frontmatter).length > 0) {
    return { status: "blocked", reason: "taxonomy-note", existingRaw: null };
  }

  const existingLink = readExistingTaxonomyLink(frontmatter);
  if (existingLink !== null) {
    const existingPath = port.resolveLinkPath(existingLink.target, filePath);
    if (existingPath !== taxonomy.path) {
      return {
        status: "blocked",
        reason:
          existingPath === null ? "unresolved-taxonomy" : "different-taxonomy",
        existingRaw: existingLink.raw,
      };
    }
  }

  const presentKeys = new Set(Object.keys(frontmatter ?? {}));
  const addedKeys = taxonomy.properties.filter((key) => !presentKeys.has(key));
  const wroteTaxonomyLink = existingLink === null;

  if (addedKeys.length === 0 && !wroteTaxonomyLink) {
    return { status: "nothing-to-do", taxonomyName: taxonomy.name };
  }

  await port.applyClassification(filePath, {
    taxonomyLink: wroteTaxonomyLink ? buildTaxonomyLink(taxonomy.name) : null,
    propertyKeys: addedKeys,
  });

  return {
    status: "applied",
    taxonomyName: taxonomy.name,
    addedKeys,
    keptKeyCount: taxonomy.properties.length - addedKeys.length,
    wroteTaxonomyLink,
  };
}

export function buildClassificationMessage(
  noteName: string,
  outcome: ClassificationOutcome,
): string {
  if (outcome.status === "nothing-to-do") {
    return `"${noteName}" already has every property from "${outcome.taxonomyName}".`;
  }

  if (outcome.status === "blocked") {
    return buildBlockedMessage(noteName, outcome.reason, outcome.existingRaw);
  }

  const addedCount = outcome.addedKeys.length;
  const addedLabel = countLabel(addedCount, "property", "properties");
  if (outcome.keptKeyCount === 0) {
    return `Added ${addedLabel} for "${outcome.taxonomyName}".`;
  }

  const totalLabel = countLabel(
    addedCount + outcome.keptKeyCount,
    "property",
    "properties",
  );

  return (
    `Added ${addedCount} of ${totalLabel} for "${outcome.taxonomyName}". ` +
    `${outcome.keptKeyCount} already set.`
  );
}

function buildBlockedMessage(
  noteName: string,
  reason: ClassificationBlockReason,
  existingRaw: string | null,
): string {
  if (reason === "taxonomy-note") {
    return `"${noteName}" defines a taxonomy. Open the note you want to classify instead.`;
  }

  if (reason === "unresolved-taxonomy") {
    return (
      `"${noteName}" has a taxonomy value that points nowhere: ` +
      `${existingRaw}. Remove it before adding a new taxonomy.`
    );
  }

  return (
    `"${noteName}" already has a taxonomy: ${existingRaw}. ` +
    "Remove it before adding a new taxonomy."
  );
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
