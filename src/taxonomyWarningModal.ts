import { Modal, Setting, type App } from "obsidian";

export class TaxonomyWarningModal extends Modal {
  private readonly warning: string;

  constructor(app: App, warning: string) {
    super(app);
    this.warning = warning;
  }

  onOpen(): void {
    this.setTitle("Add to taxonomy");

    new Setting(this.contentEl).setDesc(this.warning).addButton((button) =>
      button.setButtonText("Close").onClick(() => {
        this.close();
      }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
