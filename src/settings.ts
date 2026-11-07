import { PluginSettingTab, Setting, type App } from "obsidian";
import type PaperWorkflowPlugin from "./main";
import { normalizeProjectTag } from "./projects";
import type { Project } from "./types";

export interface PaperWorkflowSettings {
  projects: Project[];
}

export const DEFAULT_SETTINGS: PaperWorkflowSettings = {
  projects: [],
};

export class PaperWorkflowSettingTab extends PluginSettingTab {
  private readonly plugin: PaperWorkflowPlugin;

  constructor(app: App, plugin: PaperWorkflowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Research projects").setHeading();
    new Setting(containerEl).setDesc(
      "Project titles name the annotation notes. Projects are also discovered from research/* tags on notes.",
    );

    for (const project of this.plugin.settings.projects) {
      this.renderProject(containerEl, project);
    }

    new Setting(containerEl).addButton((button) =>
      button
        .setButtonText("Add project")
        .onClick(async () => {
          this.plugin.settings.projects = [
            ...this.plugin.settings.projects,
            { tag: "", title: "" },
          ];
          await this.plugin.saveSettings();
          this.display();
        }),
    );
  }

  private renderProject(containerEl: HTMLElement, project: Project): void {
    const setting = new Setting(containerEl);

    setting.addText((text) => {
      text
        .setPlaceholder("research/my_project")
        .setValue(project.tag)
        .onChange(async (value) => {
          project.tag = value;
          await this.plugin.saveSettings();
        });

      // The research/ prefix is added on blur so the field stays typeable.
      text.inputEl.addEventListener("blur", () => {
        const normalized = normalizeProjectTag(project.tag);
        if (normalized === project.tag) return;

        project.tag = normalized;
        text.setValue(normalized);
        void this.plugin.saveSettings();
      });
    });

    setting.addText((text) =>
      text
        .setPlaceholder("My Project")
        .setValue(project.title)
        .onChange(async (value) => {
          project.title = value;
          await this.plugin.saveSettings();
        }),
    );

    setting.addExtraButton((button) =>
      button
        .setIcon("trash")
        .setTooltip("Remove project")
        .onClick(async () => {
          this.plugin.settings.projects = this.plugin.settings.projects.filter(
            (candidate) => candidate !== project,
          );
          await this.plugin.saveSettings();
          this.display();
        }),
    );
  }
}
