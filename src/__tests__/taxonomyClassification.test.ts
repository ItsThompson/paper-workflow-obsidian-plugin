import { describe, it, expect, vi } from "vitest";
import {
  buildClassificationMessage,
  classifyNote,
  type ApplyClassification,
  type ClassificationPort,
} from "../taxonomyClassification";
import type { Taxonomy } from "../taxonomy";

const NOTE_PATH = "general_notes/ALPS - Dissertation.md";
const TAXONOMY_PATH = "general_notes/Post-Training Sparsity Taxonomy.md";

function buildTaxonomy(overrides: Partial<Taxonomy> = {}): Taxonomy {
  return {
    path: TAXONOMY_PATH,
    name: "Post-Training Sparsity Taxonomy",
    properties: [
      "mask_contextuality",
      "training",
      "objective_scope",
      "criterion_derivation",
      "derivative_order",
    ],
    ...overrides,
  };
}

interface PortOptions {
  frontmatter: Record<string, unknown> | undefined;
  /** Link target to resolved path. Unlisted targets resolve to null. */
  resolvable?: Record<string, string>;
}

function buildPort(options: PortOptions) {
  const applied: ApplyClassification[] = [];

  return {
    readFrontmatter: vi.fn((_filePath: string) => options.frontmatter),
    resolveLinkPath: vi.fn((linkTarget: string) => {
      return options.resolvable?.[linkTarget] ?? null;
    }),
    applyClassification: vi.fn(
      (_filePath: string, apply: ApplyClassification) => {
        applied.push(apply);
        return Promise.resolve();
      },
    ),
    applied,
  } satisfies ClassificationPort & { applied: ApplyClassification[] };
}

const SAME_TAXONOMY_RESOLUTION = {
  "Post-Training Sparsity Taxonomy": TAXONOMY_PATH,
};

describe("classifyNote", () => {
  it("writes the taxonomy link and every property when the note has no taxonomy", async () => {
    const port = buildPort({ frontmatter: { tags: ["paper/annotation"] } });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome).toEqual({
      status: "applied",
      taxonomyName: "Post-Training Sparsity Taxonomy",
      addedKeys: [
        "mask_contextuality",
        "training",
        "objective_scope",
        "criterion_derivation",
        "derivative_order",
      ],
      keptKeyCount: 0,
      wroteTaxonomyLink: true,
    });
    expect(port.applied).toEqual([
      {
        taxonomyLink: "[[Post-Training Sparsity Taxonomy]]",
        propertyKeys: [
          "mask_contextuality",
          "training",
          "objective_scope",
          "criterion_derivation",
          "derivative_order",
        ],
      },
    ]);
  });

  it("treats a present but empty taxonomy field as unassigned", async () => {
    const port = buildPort({ frontmatter: { taxonomy: null } });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome.status).toBe("applied");
    expect(port.applied[0]?.taxonomyLink).toBe(
      "[[Post-Training Sparsity Taxonomy]]",
    );
  });

  it("repairs the same taxonomy by adding only absent keys", async () => {
    const port = buildPort({
      frontmatter: {
        taxonomy: "[[Post-Training Sparsity Taxonomy]]",
        mask_contextuality: "Contextual (per token)",
        training: "Training-free",
      },
      resolvable: SAME_TAXONOMY_RESOLUTION,
    });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome).toEqual({
      status: "applied",
      taxonomyName: "Post-Training Sparsity Taxonomy",
      addedKeys: ["objective_scope", "criterion_derivation", "derivative_order"],
      keptKeyCount: 2,
      wroteTaxonomyLink: false,
    });
    expect(port.applied).toEqual([
      {
        taxonomyLink: null,
        propertyKeys: [
          "objective_scope",
          "criterion_derivation",
          "derivative_order",
        ],
      },
    ]);
  });

  it("resolves an aliased wikilink to the same taxonomy", async () => {
    const port = buildPort({
      frontmatter: { taxonomy: "[[Post-Training Sparsity Taxonomy|Sparsity]]" },
      resolvable: SAME_TAXONOMY_RESOLUTION,
    });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(port.resolveLinkPath).toHaveBeenCalledWith(
      "Post-Training Sparsity Taxonomy",
      NOTE_PATH,
    );
    expect(outcome.status).toBe("applied");
  });

  it("blocks a note linked to a different taxonomy", async () => {
    const port = buildPort({
      frontmatter: { taxonomy: "[[Other Taxonomy]]" },
      resolvable: { "Other Taxonomy": "general_notes/Other Taxonomy.md" },
    });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome).toEqual({
      status: "blocked",
      reason: "different-taxonomy",
      existingRaw: "[[Other Taxonomy]]",
    });
    expect(port.applyClassification).not.toHaveBeenCalled();
  });

  it("blocks a taxonomy value that resolves to no note", async () => {
    const port = buildPort({ frontmatter: { taxonomy: "[[Renamed Away]]" } });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome).toEqual({
      status: "blocked",
      reason: "unresolved-taxonomy",
      existingRaw: "[[Renamed Away]]",
    });
    expect(port.applyClassification).not.toHaveBeenCalled();
  });

  it("blocks a note that is itself a taxonomy", async () => {
    const port = buildPort({
      frontmatter: { taxonomy_properties: ["mask_contextuality"] },
    });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome).toEqual({
      status: "blocked",
      reason: "taxonomy-note",
      existingRaw: null,
    });
    expect(port.applyClassification).not.toHaveBeenCalled();
  });

  it("does nothing when the note already carries every property", async () => {
    const port = buildPort({
      frontmatter: {
        taxonomy: "[[Post-Training Sparsity Taxonomy]]",
        mask_contextuality: "Contextual",
        training: "Training-free",
        objective_scope: "None",
        criterion_derivation: "Score",
        derivative_order: "Zeroth",
      },
      resolvable: SAME_TAXONOMY_RESOLUTION,
    });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome).toEqual({
      status: "nothing-to-do",
      taxonomyName: "Post-Training Sparsity Taxonomy",
    });
    expect(port.applyClassification).not.toHaveBeenCalled();
  });

  it("counts a property key that exists with an empty value as set", async () => {
    const port = buildPort({
      frontmatter: {
        taxonomy: "[[Post-Training Sparsity Taxonomy]]",
        mask_contextuality: null,
        training: null,
        objective_scope: null,
        criterion_derivation: null,
        derivative_order: null,
      },
      resolvable: SAME_TAXONOMY_RESOLUTION,
    });

    const outcome = await classifyNote(NOTE_PATH, buildTaxonomy(), port);

    expect(outcome.status).toBe("nothing-to-do");
    expect(port.applyClassification).not.toHaveBeenCalled();
  });

  it("adds a property that the taxonomy gained after the note was classified", async () => {
    const port = buildPort({
      frontmatter: {
        taxonomy: "[[Post-Training Sparsity Taxonomy]]",
        mask_contextuality: "Contextual",
        training: "Training-free",
        objective_scope: "None",
        criterion_derivation: "Score",
        derivative_order: "Zeroth",
      },
      resolvable: SAME_TAXONOMY_RESOLUTION,
    });

    const extended = buildTaxonomy({
      properties: [...buildTaxonomy().properties, "budget_scope"],
    });

    const outcome = await classifyNote(NOTE_PATH, extended, port);

    expect(outcome.status).toBe("applied");
    expect(port.applied).toEqual([
      { taxonomyLink: null, propertyKeys: ["budget_scope"] },
    ]);
  });
});

describe("buildClassificationMessage", () => {
  it("reports a full classification", () => {
    expect(
      buildClassificationMessage("ALPS - Dissertation", {
        status: "applied",
        taxonomyName: "Sparsity Taxonomy",
        addedKeys: ["a", "b", "c", "d", "e"],
        keptKeyCount: 0,
        wroteTaxonomyLink: true,
      }),
    ).toBe('Added 5 properties for "Sparsity Taxonomy".');
  });

  it("uses a singular noun for one property", () => {
    expect(
      buildClassificationMessage("ALPS - Dissertation", {
        status: "applied",
        taxonomyName: "Sparsity Taxonomy",
        addedKeys: ["a"],
        keptKeyCount: 0,
        wroteTaxonomyLink: true,
      }),
    ).toBe('Added 1 property for "Sparsity Taxonomy".');
  });

  it("reports a repair as a fraction of the taxonomy", () => {
    expect(
      buildClassificationMessage("ALPS - Dissertation", {
        status: "applied",
        taxonomyName: "Sparsity Taxonomy",
        addedKeys: ["a", "b"],
        keptKeyCount: 3,
        wroteTaxonomyLink: false,
      }),
    ).toBe('Added 2 of 5 properties for "Sparsity Taxonomy". 3 already set.');
  });

  it("reports a note that needs nothing", () => {
    expect(
      buildClassificationMessage("ALPS - Dissertation", {
        status: "nothing-to-do",
        taxonomyName: "Sparsity Taxonomy",
      }),
    ).toBe(
      '"ALPS - Dissertation" already has every property from "Sparsity Taxonomy".',
    );
  });

  it("names the existing taxonomy when a different one is set", () => {
    expect(
      buildClassificationMessage("ALPS - Dissertation", {
        status: "blocked",
        reason: "different-taxonomy",
        existingRaw: "[[Other Taxonomy]]",
      }),
    ).toBe(
      '"ALPS - Dissertation" already has a taxonomy: [[Other Taxonomy]]. Remove it before adding a new taxonomy.',
    );
  });

  it("reports an existing value that points nowhere", () => {
    expect(
      buildClassificationMessage("ALPS - Dissertation", {
        status: "blocked",
        reason: "unresolved-taxonomy",
        existingRaw: "[[Renamed Away]]",
      }),
    ).toBe(
      '"ALPS - Dissertation" has a taxonomy value that points nowhere: [[Renamed Away]]. Remove it before adding a new taxonomy.',
    );
  });

  it("refuses to classify a taxonomy note", () => {
    expect(
      buildClassificationMessage("Sparsity Taxonomy", {
        status: "blocked",
        reason: "taxonomy-note",
        existingRaw: null,
      }),
    ).toBe(
      '"Sparsity Taxonomy" defines a taxonomy. Open the note you want to classify instead.',
    );
  });
});
