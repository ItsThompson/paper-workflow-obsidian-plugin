import {
  PAPER_TAG,
  RESEARCH_TAG_PREFIX,
  TAGS_FRONTMATTER_KEY,
} from "./constants";

/**
 * Frontmatter tags arrive as an array in indexed notes, but plain strings and
 * missing values are both possible while a note is being written.
 */
export function readFrontmatterTags(
  frontmatter: Record<string, unknown> | undefined | null,
): string[] {
  if (!frontmatter) return [];

  const rawTags = frontmatter[TAGS_FRONTMATTER_KEY];
  if (typeof rawTags === "string") return normalizeTags(rawTags.split(/[,\s]+/));
  if (!Array.isArray(rawTags)) return [];

  return normalizeTags(
    rawTags.filter((tag): tag is string => typeof tag === "string"),
  );
}

function normalizeTags(tags: readonly string[]): string[] {
  return tags.map(stripHash).filter((tag) => tag.length > 0);
}

function stripHash(tag: string): string {
  return tag.trim().replace(/^#+/, "");
}

export function hasPaperTag(tags: readonly string[]): boolean {
  return tags.includes(PAPER_TAG);
}

export function isResearchTag(tag: string): boolean {
  return (
    tag.startsWith(RESEARCH_TAG_PREFIX) &&
    tag.length > RESEARCH_TAG_PREFIX.length
  );
}

export function uniqueResearchTags(tags: readonly string[]): string[] {
  return [...new Set(tags.filter(isResearchTag))].sort();
}
