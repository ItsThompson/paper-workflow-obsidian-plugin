import { RESEARCH_TAG_PREFIX } from "./constants";
import { isResearchTag } from "./papers";
import type { Project } from "./types";

export function normalizeProjectTag(rawTag: string): string {
  const withoutHash = rawTag.trim().replace(/^#+/, "").trim();
  if (withoutHash.length === 0) return "";
  if (withoutHash.startsWith(RESEARCH_TAG_PREFIX)) return withoutHash;

  return `${RESEARCH_TAG_PREFIX}${withoutHash}`;
}

export function resolveProjectTitle(
  tag: string,
  registeredProjects: readonly Project[],
): string {
  const registered = registeredProjects.find((project) => project.tag === tag);
  if (registered) return registered.title;

  return tag.startsWith(RESEARCH_TAG_PREFIX)
    ? tag.slice(RESEARCH_TAG_PREFIX.length)
    : tag;
}

/** Adds the project only when the tag is new, so a registered title is never replaced. */
export function registerProject(
  registeredProjects: readonly Project[],
  project: Project,
): Project[] {
  const isRegistered = registeredProjects.some(
    (existing) => existing.tag === project.tag,
  );
  if (isRegistered) return [...registeredProjects];

  return [...registeredProjects, project];
}

/**
 * The picker offers both registered projects and tags found on notes, because a
 * project can exist before its first paper is tagged.
 */
export function collectProjectChoices(
  vaultResearchTags: readonly string[],
  registeredProjects: readonly Project[],
): Project[] {
  const tags = new Set<string>(vaultResearchTags);
  for (const project of registeredProjects) tags.add(project.tag);

  return [...tags]
    .filter(isResearchTag)
    .sort()
    .map((tag) => ({ tag, title: resolveProjectTitle(tag, registeredProjects) }));
}

/** Validates the persisted data.json payload, which is untyped at the boundary. */
export function readStoredProjects(stored: unknown): Project[] {
  if (!stored || typeof stored !== "object") return [];

  const rawProjects = (stored as { projects?: unknown }).projects;
  if (!Array.isArray(rawProjects)) return [];

  return rawProjects.flatMap((entry): Project[] => {
    if (!entry || typeof entry !== "object") return [];

    const { tag, title } = entry as { tag?: unknown; title?: unknown };
    if (typeof tag !== "string" || typeof title !== "string") return [];

    return [{ tag, title }];
  });
}
