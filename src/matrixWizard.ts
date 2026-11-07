import { Modal, Notice, Setting, type App } from "obsidian";
import { GENERAL_NOTES_FOLDER } from "./constants";
import { parseLiteratureMatrixInput, type LiteratureMatrixInput } from "./matrix";

export class LiteratureMatrixWizardModal extends Modal {
  private baseFileName = "";
  private projectTag = "";
  private projectTitle = "";

  private readonly onSubmit: (input: LiteratureMatrixInput) => Promise<void>;

  constructor(
    app: App,
    onSubmit: (input: LiteratureMatrixInput) => Promise<void>,
  ) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.setTitle("Create literature matrix");

    new Setting(this.contentEl)
      .setName("Base file name")
      .setDesc(`Created in ${GENERAL_NOTES_FOLDER}. ".base" is appended when missing.`)
      .addText((text) =>
        text
          .setPlaceholder("Literature Matrix")
          .onChange((value) => {
            this.baseFileName = value;
          }),
      );

    new Setting(this.contentEl)
      .setName("Research tag")
      .setDesc('Project tag for this matrix, e.g. "research/my_project".')
      .addText((text) =>
        text.setPlaceholder("research/my_project").onChange((value) => {
          this.projectTag = value;
        }),
      );

    new Setting(this.contentEl)
      .setName("Project title")
      .setDesc("Names this project's annotation notes.")
      .addText((text) =>
        text.setPlaceholder("My Project").onChange((value) => {
          this.projectTitle = value;
        }),
      );

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Create")
        .setCta()
        .onClick(() => {
          void this.submit();
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    const parsed = parseLiteratureMatrixInput({
      baseFileName: this.baseFileName,
      projectTag: this.projectTag,
      projectTitle: this.projectTitle,
    });

    if (!parsed.ok) {
      new Notice(parsed.error);
      return;
    }

    this.close();
    await this.onSubmit(parsed.value);
  }
}
