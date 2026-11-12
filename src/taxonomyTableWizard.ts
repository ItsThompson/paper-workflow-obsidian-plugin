import { Modal, Setting, type App } from "obsidian";
import type { Taxonomy } from "./taxonomy";
import { buildTaxonomyTablePath } from "./taxonomyTable";

export class TaxonomyTableWizardModal extends Modal {
  private readonly taxonomy: Taxonomy;
  private readonly onCreate: (taxonomy: Taxonomy) => void;

  constructor(
    app: App,
    taxonomy: Taxonomy,
    onCreate: (taxonomy: Taxonomy) => void,
  ) {
    super(app);
    this.taxonomy = taxonomy;
    this.onCreate = onCreate;
  }

  onOpen(): void {
    this.setTitle("Create taxonomy classification table");

    new Setting(this.contentEl)
      .setName("Taxonomy")
      .setDesc(this.taxonomy.name);

    new Setting(this.contentEl)
      .setName("Properties")
      .setDesc(this.taxonomy.properties.join(", "));

    new Setting(this.contentEl).setName("File").setDesc(
      buildTaxonomyTablePath(this.taxonomy.name),
    );

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => {
          this.close();
        }),
      )
      .addButton((button) =>
        button
          .setButtonText("Create")
          .setCta()
          .onClick(() => {
            this.close();
            this.onCreate(this.taxonomy);
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
