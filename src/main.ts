import {
  Notice,
  Plugin,
  TFile,
  type MarkdownFileInfo,
  type Menu,
  type TAbstractFile,
} from "obsidian";
import { ProjectPickerModal } from "./annotationModal";
import { createAnnotationNote, toIsoDate } from "./annotation";
import {
  CONTRIBUTION_DEBOUNCE_MS,
  CONTRIBUTION_FRONTMATTER_KEY,
  CMD_CREATE_ANNOTATION,
  CMD_CREATE_LITERATURE_MATRIX,
  PAPER_TAG,
} from "./constants";
import {
  createContributionSync,
  type ContributionNotePort,
  type ContributionSync,
} from "./contribution";
import {
  createLiteratureMatrix,
  type LiteratureMatrixInput,
} from "./matrix";
import { LiteratureMatrixWizardModal } from "./matrixWizard";
import { hasPaperTag, readFrontmatterTags, uniqueResearchTags } from "./papers";
import { collectProjectChoices, readStoredProjects, registerProject } from "./projects";
import {
  DEFAULT_SETTINGS,
  PaperWorkflowSettingTab,
  type PaperWorkflowSettings,
} from "./settings";
import type { FileCreationPort, Project } from "./types";

export default class PaperWorkflowPlugin extends Plugin {
  settings: PaperWorkflowSettings = DEFAULT_SETTINGS;

  private contributionSync: ContributionSync | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new PaperWorkflowSettingTab(this.app, this));

    this.addCommand({
      id: CMD_CREATE_ANNOTATION,
      name: "Create paper annotation",
      callback: () => {
        this.startAnnotation(this.app.workspace.getActiveFile());
      },
    });

    this.addCommand({
      id: CMD_CREATE_LITERATURE_MATRIX,
      name: "Create literature matrix",
      callback: () => {
        this.openLiteratureMatrixWizard();
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, _editor, info) => {
        this.addAnnotationMenuItem(menu, info);
      }),
    );

    this.contributionSync = createContributionSync(
      this.createContributionPort(),
      CONTRIBUTION_DEBOUNCE_MS,
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        this.handleVaultModify(file);
      }),
    );
  }

  onunload(): void {
    this.contributionSync?.dispose();
    this.contributionSync = null;
  }

  async loadSettings(): Promise<void> {
    const data: unknown = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      projects: readStoredProjects(data),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private isPaperNote(file: TFile): boolean {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

    return hasPaperTag(readFrontmatterTags(frontmatter));
  }

  private addAnnotationMenuItem(menu: Menu, info: MarkdownFileInfo): void {
    const file = info.file;
    if (!file || !this.isPaperNote(file)) return;

    menu.addItem((item) =>
      item
        .setTitle("Create paper annotation")
        .setIcon("file-plus")
        .onClick(() => {
          this.startAnnotation(file);
        }),
    );
  }

  private startAnnotation(file: TFile | null): void {
    if (!file) {
      new Notice("Open a paper note first.");
      return;
    }

    if (!this.isPaperNote(file)) {
      new Notice(
        `"${file.basename}" is not a paper note. Add "${PAPER_TAG}" to its frontmatter tags.`,
      );
      return;
    }

    const projects = collectProjectChoices(
      this.collectVaultResearchTags(),
      this.settings.projects,
    );

    if (projects.length === 0) {
      new Notice(
        "No research projects found. Tag a note with research/<project> or add a project in settings.",
      );
      return;
    }

    new ProjectPickerModal(this.app, projects, (project) => {
      void this.createAnnotation(file, project);
    }).open();
  }

  private collectVaultResearchTags(): string[] {
    const tags = this.app.vault.getMarkdownFiles().flatMap((file) => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

      return readFrontmatterTags(frontmatter);
    });

    return uniqueResearchTags(tags);
  }

  private async createAnnotation(file: TFile, project: Project): Promise<void> {
    try {
      const result = await createAnnotationNote(
        {
          paperTitle: file.basename,
          paperFolderPath: file.parent?.path ?? "",
          projectTag: project.tag,
          projectTitle: project.title,
          todayIso: toIsoDate(new Date()),
        },
        this.createFilePort(),
      );

      await this.app.workspace.getLeaf(false).openFile(result.file);
      new Notice(
        result.status === "created"
          ? `Created ${result.path}.`
          : `${result.path} already exists.`,
      );
    } catch (error) {
      this.reportFailure("create annotation", error);
    }
  }

  private openLiteratureMatrixWizard(): void {
    new LiteratureMatrixWizardModal(this.app, (input) =>
      this.createLiteratureMatrixFromInput(input),
    ).open();
  }

  private async createLiteratureMatrixFromInput(
    input: LiteratureMatrixInput,
  ): Promise<void> {
    try {
      const result = await createLiteratureMatrix(
        input,
        this.createFilePort(),
      );

      if (result.status === "exists") {
        new Notice(`${result.path} already exists.`);
        return;
      }

      this.settings.projects = registerProject(this.settings.projects, {
        tag: input.projectTag,
        title: input.projectTitle,
      });
      await this.saveSettings();
      new Notice(`Created ${result.path}.`);
    } catch (error) {
      this.reportFailure("create literature matrix", error);
    }
  }

  private createFilePort(): FileCreationPort<TFile> {
    return {
      getFileByPath: (path) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        return file instanceof TFile ? file : null;
      },
      createFile: (path, content) => this.app.vault.create(path, content),
      ensureFolder: async (folderPath) => {
        if (this.app.vault.getAbstractFileByPath(folderPath)) return;

        await this.app.vault.createFolder(folderPath);
      },
    };
  }

  private createContributionPort(): ContributionNotePort {
    return {
      readContent: async (filePath) => {
        const file = this.requireFile(filePath);
        return this.app.vault.read(file);
      },
      readContribution: (filePath) => {
        const value =
          this.app.metadataCache.getCache(filePath)?.frontmatter?.[
            CONTRIBUTION_FRONTMATTER_KEY
          ];

        return typeof value === "string" ? value : undefined;
      },
      writeContribution: async (filePath, plainContribution) => {
        const file = this.requireFile(filePath);
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          frontmatter[CONTRIBUTION_FRONTMATTER_KEY] = plainContribution;
        });
      },
    };
  }

  private requireFile(filePath: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`Note not found: ${filePath}`);
    }

    return file;
  }

  private handleVaultModify(file: TAbstractFile): void {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (!this.isPaperNote(file)) return;

    this.contributionSync?.schedule(file.path);
  }

  private reportFailure(action: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[paper-workflow] ${action} failed`, error);
    new Notice(`Failed to ${action}: ${message}`, 8000);
  }
}
