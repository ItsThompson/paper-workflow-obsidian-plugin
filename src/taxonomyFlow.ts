import { Notice, TFile, type App } from "obsidian";
import { TAXONOMY_FRONTMATTER_KEY, TAXONOMY_PROPERTIES_KEY } from "./constants";
import {
  buildClassificationMessage,
  classifyNote,
  type ApplyClassification,
  type ClassificationPort,
} from "./taxonomyClassification";
import { TaxonomyPickerModal } from "./taxonomyPicker";
import {
  collectTaxonomies,
  readExistingTaxonomyLink,
  type Taxonomy,
  type TaxonomySource,
} from "./taxonomy";
import { createTaxonomyTable } from "./taxonomyTable";
import { TaxonomyTableWizardModal } from "./taxonomyTableWizard";
import { TaxonomyWarningModal } from "./taxonomyWarningModal";
import type { FileCreationPort } from "./types";

export interface TaxonomyFlow {
  /** Prompts for a taxonomy, then classifies the note into it. */
  addToTaxonomy(file: TFile | null): void;
  /** Prompts for a taxonomy, then generates its `.base` file. */
  createTaxonomyTable(): void;
}

export function createTaxonomyFlow(
  app: App,
  filePort: FileCreationPort<TFile>,
  onFailure: (action: string, error: unknown) => void,
): TaxonomyFlow {
  function collectVaultTaxonomies(): Taxonomy[] {
    const sources: TaxonomySource[] = app.vault
      .getMarkdownFiles()
      .map((file) => ({
        path: file.path,
        basename: file.basename,
        frontmatter: app.metadataCache.getFileCache(file)?.frontmatter,
      }));

    return collectTaxonomies(sources);
  }

  function pickTaxonomy(onChoose: (taxonomy: Taxonomy) => void): void {
    const taxonomies = collectVaultTaxonomies();
    if (taxonomies.length === 0) {
      new Notice(
        `No taxonomy notes found. Add a "${TAXONOMY_PROPERTIES_KEY}" list to a note first.`,
      );
      return;
    }

    new TaxonomyPickerModal(app, taxonomies, onChoose).open();
  }

  function createClassificationPort(): ClassificationPort {
    return {
      readFrontmatter: (filePath) =>
        app.metadataCache.getCache(filePath)?.frontmatter,
      resolveLinkPath: (linkTarget, sourcePath) =>
        app.metadataCache.getFirstLinkpathDest(linkTarget, sourcePath)?.path ??
        null,
      applyClassification: async (
        filePath: string,
        apply: ApplyClassification,
      ) => {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
          throw new Error(`Note not found: ${filePath}`);
        }

        // processFrontMatter reads the note from disk, so these guards see the
        // current values even when the metadata cache lagged behind a save.
        await app.fileManager.processFrontMatter(
          file,
          (frontmatter: Record<string, unknown>) => {
            if (
              apply.taxonomyLink !== null &&
              readExistingTaxonomyLink(frontmatter) === null
            ) {
              frontmatter[TAXONOMY_FRONTMATTER_KEY] = apply.taxonomyLink;
            }

            for (const propertyKey of apply.propertyKeys) {
              if (propertyKey in frontmatter) continue;

              frontmatter[propertyKey] = null;
            }
          },
        );
      },
    };
  }

  async function applyTaxonomy(
    file: TFile,
    taxonomy: Taxonomy,
  ): Promise<void> {
    try {
      const outcome = await classifyNote(
        file.path,
        taxonomy,
        createClassificationPort(),
      );
      const message = buildClassificationMessage(file.basename, outcome);

      if (outcome.status === "blocked") {
        new TaxonomyWarningModal(app, message).open();
        return;
      }

      new Notice(message);
    } catch (error) {
      onFailure("add to taxonomy", error);
    }
  }

  async function writeTable(taxonomy: Taxonomy): Promise<void> {
    try {
      const result = await createTaxonomyTable(taxonomy, filePort);

      new Notice(
        result.status === "created"
          ? `Created ${result.path}.`
          : `${result.path} already exists.`,
      );
    } catch (error) {
      onFailure("create taxonomy classification table", error);
    }
  }

  return {
    addToTaxonomy(file: TFile | null): void {
      if (!file || file.extension !== "md") {
        new Notice("Open a note first.");
        return;
      }

      pickTaxonomy((taxonomy) => {
        void applyTaxonomy(file, taxonomy);
      });
    },

    createTaxonomyTable(): void {
      pickTaxonomy((taxonomy) => {
        new TaxonomyTableWizardModal(app, taxonomy, (chosenTaxonomy) => {
          void writeTable(chosenTaxonomy);
        }).open();
      });
    },
  };
}
