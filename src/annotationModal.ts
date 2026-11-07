import { FuzzySuggestModal, type App } from "obsidian";
import type { Project } from "./types";

export class ProjectPickerModal extends FuzzySuggestModal<Project> {
  private readonly projects: readonly Project[];
  private readonly onChoose: (project: Project) => void;

  constructor(
    app: App,
    projects: readonly Project[],
    onChoose: (project: Project) => void,
  ) {
    super(app);
    this.projects = projects;
    this.onChoose = onChoose;
    this.setPlaceholder("Select a research project");
  }

  getItems(): Project[] {
    return [...this.projects];
  }

  /** Shows both title and tag so the user can search by either. */
  getItemText(project: Project): string {
    return `${project.title} (${project.tag})`;
  }

  onChooseItem(project: Project): void {
    this.onChoose(project);
  }
}
