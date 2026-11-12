import { Notice, TFile, type App } from "obsidian";
import { ProjectPickerModal } from "./annotationModal";
import { createAnnotationNote, toIsoDate } from "./annotation";
import { PAPER_TAG } from "./constants";
import { hasPaperNoteTag, readFrontmatterTags, uniqueResearchTags } from "./papers";
import { collectProjectChoices } from "./projects";
import type { FileCreationPort, Project } from "./types";

export interface AnnotationFlow {
  /** Prompts for a project, then creates and opens the annotation note. */
  start(file: TFile | null): void;
}

export function createAnnotationFlow(
  app: App,
  filePort: FileCreationPort<TFile>,
  getProjects: () => readonly Project[],
  onFailure: (action: string, error: unknown) => void,
): AnnotationFlow {
  function isPaperNote(file: TFile): boolean {
    return hasPaperNoteTag(app.metadataCache.getFileCache(file)?.frontmatter);
  }

  function collectVaultResearchTags(): string[] {
    const tags = app.vault.getMarkdownFiles().flatMap((file) => {
      const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

      return readFrontmatterTags(frontmatter);
    });

    return uniqueResearchTags(tags);
  }

  async function createAnnotation(
    file: TFile,
    project: Project,
  ): Promise<void> {
    try {
      const result = await createAnnotationNote(
        {
          paperTitle: file.basename,
          paperFolderPath: file.parent?.path ?? "",
          projectTag: project.tag,
          projectTitle: project.title,
          todayIso: toIsoDate(new Date()),
        },
        filePort,
      );

      await app.workspace.getLeaf(false).openFile(result.file);
      new Notice(
        result.status === "created"
          ? `Created ${result.path}.`
          : `${result.path} already exists.`,
      );
    } catch (error) {
      onFailure("create annotation", error);
    }
  }

  return {
    start(file: TFile | null): void {
      if (!file) {
        new Notice("Open a paper note first.");
        return;
      }

      if (!isPaperNote(file)) {
        new Notice(
          `"${file.basename}" is not a paper note. Add "${PAPER_TAG}" to its frontmatter tags.`,
        );
        return;
      }

      const projects = collectProjectChoices(
        collectVaultResearchTags(),
        getProjects(),
      );

      if (projects.length === 0) {
        new Notice(
          "No research projects found. Tag a note with research/<project> or add a project in settings.",
        );
        return;
      }

      new ProjectPickerModal(app, projects, (project) => {
        void createAnnotation(file, project);
      }).open();
    },
  };
}
