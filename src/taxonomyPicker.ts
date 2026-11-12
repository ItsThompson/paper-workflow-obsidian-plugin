import { FuzzySuggestModal, type App } from "obsidian";
import type { Taxonomy } from "./taxonomy";

export class TaxonomyPickerModal extends FuzzySuggestModal<Taxonomy> {
  private readonly taxonomies: readonly Taxonomy[];
  private readonly onChoose: (taxonomy: Taxonomy) => void;

  constructor(
    app: App,
    taxonomies: readonly Taxonomy[],
    onChoose: (taxonomy: Taxonomy) => void,
  ) {
    super(app);
    this.taxonomies = taxonomies;
    this.onChoose = onChoose;
    this.setPlaceholder("Select a taxonomy");
  }

  getItems(): Taxonomy[] {
    return [...this.taxonomies];
  }

  getItemText(taxonomy: Taxonomy): string {
    return taxonomy.name;
  }

  /** Closes first, because a caller may open another modal from the callback. */
  onChooseItem(taxonomy: Taxonomy): void {
    this.close();
    this.onChoose(taxonomy);
  }
}
