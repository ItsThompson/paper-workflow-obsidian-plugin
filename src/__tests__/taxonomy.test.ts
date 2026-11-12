import { describe, it, expect } from "vitest";
import {
  buildTaxonomyLink,
  collectTaxonomies,
  extractLinkTarget,
  readExistingTaxonomyLink,
  readTaxonomyProperties,
  type TaxonomySource,
} from "../taxonomy";

function buildSource(overrides: Partial<TaxonomySource> = {}): TaxonomySource {
  return {
    path: "general_notes/Sparsity Taxonomy.md",
    basename: "Sparsity Taxonomy",
    frontmatter: {
      taxonomy_properties: ["mask_contextuality", "training"],
    },
    ...overrides,
  };
}

describe("readTaxonomyProperties", () => {
  it("reads a frontmatter list in declaration order", () => {
    expect(
      readTaxonomyProperties({
        taxonomy_properties: ["objective_scope", "training"],
      }),
    ).toEqual(["objective_scope", "training"]);
  });

  it("splits a bare string into property names", () => {
    expect(
      readTaxonomyProperties({ taxonomy_properties: "training, objective_scope" }),
    ).toEqual(["training", "objective_scope"]);
  });

  it("trims entries and drops blanks", () => {
    expect(
      readTaxonomyProperties({ taxonomy_properties: [" training ", "", "  "] }),
    ).toEqual(["training"]);
  });

  it("removes duplicates while keeping the first position", () => {
    expect(
      readTaxonomyProperties({
        taxonomy_properties: ["training", "mask_contextuality", "training"],
      }),
    ).toEqual(["training", "mask_contextuality"]);
  });

  it("ignores non-string entries", () => {
    expect(
      readTaxonomyProperties({ taxonomy_properties: ["training", 7, null] }),
    ).toEqual(["training"]);
  });

  it("returns nothing when the field is absent or empty", () => {
    expect(readTaxonomyProperties(undefined)).toEqual([]);
    expect(readTaxonomyProperties({})).toEqual([]);
    expect(readTaxonomyProperties({ taxonomy_properties: [] })).toEqual([]);
    expect(readTaxonomyProperties({ taxonomy_properties: "" })).toEqual([]);
  });
});

describe("collectTaxonomies", () => {
  it("keeps only notes that declare properties", () => {
    const taxonomies = collectTaxonomies([
      buildSource(),
      buildSource({
        path: "general_notes/Empty Taxonomy.md",
        basename: "Empty Taxonomy",
        frontmatter: { taxonomy_properties: [] },
      }),
      buildSource({
        path: "general_notes/Plain Note.md",
        basename: "Plain Note",
        frontmatter: { tags: ["papers"] },
      }),
    ]);

    expect(taxonomies.map((taxonomy) => taxonomy.name)).toEqual([
      "Sparsity Taxonomy",
    ]);
  });

  it("carries the path as identity and the basename as display name", () => {
    const [taxonomy] = collectTaxonomies([buildSource()]);

    expect(taxonomy).toEqual({
      path: "general_notes/Sparsity Taxonomy.md",
      name: "Sparsity Taxonomy",
      properties: ["mask_contextuality", "training"],
    });
  });

  it("sorts by name", () => {
    const taxonomies = collectTaxonomies([
      buildSource({ path: "b.md", basename: "Zeta" }),
      buildSource({ path: "a.md", basename: "Alpha" }),
    ]);

    expect(taxonomies.map((taxonomy) => taxonomy.name)).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });

  it("keeps two same-named taxonomies because the path distinguishes them", () => {
    const taxonomies = collectTaxonomies([
      buildSource({ path: "one/Taxonomy.md" }),
      buildSource({ path: "two/Taxonomy.md" }),
    ]);

    expect(taxonomies.map((taxonomy) => taxonomy.path)).toEqual([
      "one/Taxonomy.md",
      "two/Taxonomy.md",
    ]);
  });
});

describe("readExistingTaxonomyLink", () => {
  it("returns nothing when the field is absent", () => {
    expect(readExistingTaxonomyLink(undefined)).toBeNull();
    expect(readExistingTaxonomyLink({ tags: ["papers"] })).toBeNull();
  });

  it("returns nothing for an empty or null field", () => {
    expect(readExistingTaxonomyLink({ taxonomy: null })).toBeNull();
    expect(readExistingTaxonomyLink({ taxonomy: "" })).toBeNull();
    expect(readExistingTaxonomyLink({ taxonomy: "   " })).toBeNull();
    expect(readExistingTaxonomyLink({ taxonomy: [] })).toBeNull();
  });

  it("strips brackets from a wikilink value", () => {
    expect(
      readExistingTaxonomyLink({ taxonomy: "[[Sparsity Taxonomy]]" }),
    ).toEqual({ raw: "[[Sparsity Taxonomy]]", target: "Sparsity Taxonomy" });
  });

  it("treats an unresolvable value as present", () => {
    expect(readExistingTaxonomyLink({ taxonomy: "Sparsity" })).toEqual({
      raw: "Sparsity",
      target: "Sparsity",
    });
  });

  it("joins a list value so the warning can show it", () => {
    expect(
      readExistingTaxonomyLink({ taxonomy: ["[[A]]", "[[B]]"] }),
    ).toEqual({ raw: "[[A]], [[B]]", target: "[[A]], [[B]]" });
  });

  it("stringifies a non-string, non-list value", () => {
    expect(readExistingTaxonomyLink({ taxonomy: 3 })).toEqual({
      raw: "3",
      target: "3",
    });
  });
});

describe("extractLinkTarget", () => {
  it("unwraps a plain wikilink", () => {
    expect(extractLinkTarget("[[Sparsity Taxonomy]]")).toBe("Sparsity Taxonomy");
  });

  it("drops an alias", () => {
    expect(extractLinkTarget("[[Sparsity Taxonomy|Sparsity]]")).toBe(
      "Sparsity Taxonomy",
    );
  });

  it("drops a heading", () => {
    expect(extractLinkTarget("[[Sparsity Taxonomy#Properties]]")).toBe(
      "Sparsity Taxonomy",
    );
  });

  it("keeps a path-qualified target", () => {
    expect(extractLinkTarget("[[general_notes/Sparsity Taxonomy]]")).toBe(
      "general_notes/Sparsity Taxonomy",
    );
  });

  it("passes a bare target through", () => {
    expect(extractLinkTarget("Sparsity Taxonomy")).toBe("Sparsity Taxonomy");
  });
});

describe("buildTaxonomyLink", () => {
  it("wraps the name in a wikilink", () => {
    expect(buildTaxonomyLink("Sparsity Taxonomy")).toBe(
      "[[Sparsity Taxonomy]]",
    );
  });
});
