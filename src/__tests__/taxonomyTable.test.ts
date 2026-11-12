import { describe, it, expect, vi } from "vitest";
import {
  assertSupportedPropertyKeys,
  buildTaxonomyTableContent,
  buildTaxonomyTableFileName,
  buildTaxonomyTablePath,
  createTaxonomyTable,
  displayNameFromPropertyKey,
  escapeQuotedYamlScalar,
} from "../taxonomyTable";
import type { Taxonomy } from "../taxonomy";
import type { FileCreationPort } from "../types";

function buildTaxonomy(overrides: Partial<Taxonomy> = {}): Taxonomy {
  return {
    path: "general_notes/Post-Training Sparsity Taxonomy.md",
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

function buildFilePort(
  existingFile: { path: string } | null = null,
): FileCreationPort<{ path: string }> {
  return {
    getFileByPath: vi.fn().mockReturnValue(existingFile),
    createFile: vi
      .fn()
      .mockImplementation((path: string) => Promise.resolve({ path })),
    ensureFolder: vi.fn().mockResolvedValue(undefined),
  };
}

describe("displayNameFromPropertyKey", () => {
  it("splits on underscores and capitalizes each word", () => {
    expect(displayNameFromPropertyKey("mask_contextuality")).toBe(
      "Mask Contextuality",
    );
    expect(displayNameFromPropertyKey("objective_scope")).toBe(
      "Objective Scope",
    );
  });

  it("keeps a single word capitalized", () => {
    expect(displayNameFromPropertyKey("training")).toBe("Training");
  });

  it("leaves existing capitals inside a word alone", () => {
    expect(displayNameFromPropertyKey("gpu_count")).toBe("Gpu Count");
    expect(displayNameFromPropertyKey("GPU_count")).toBe("GPU Count");
  });
});

describe("escapeQuotedYamlScalar", () => {
  it("escapes double quotes and backslashes", () => {
    expect(escapeQuotedYamlScalar('A "quoted" name')).toBe('A \\"quoted\\" name');
    expect(escapeQuotedYamlScalar("back\\slash")).toBe("back\\\\slash");
  });
});

describe("buildTaxonomyTableFileName", () => {
  it("uses the classification table convention", () => {
    expect(buildTaxonomyTableFileName("Post-Training Sparsity Taxonomy")).toBe(
      "Post-Training Sparsity Taxonomy Classification Table.base",
    );
  });
});

describe("buildTaxonomyTablePath", () => {
  it("places the table beside the other matrices", () => {
    expect(buildTaxonomyTablePath("Post-Training Sparsity Taxonomy")).toBe(
      "general_notes/Post-Training Sparsity Taxonomy Classification Table.base",
    );
  });
});

describe("assertSupportedPropertyKeys", () => {
  it("accepts keys made of letters, digits, underscores, and hyphens", () => {
    expect(() =>
      assertSupportedPropertyKeys(buildTaxonomy({ properties: ["a_b-c9"] })),
    ).not.toThrow();
  });

  it("rejects a key YAML cannot take bare", () => {
    expect(() =>
      assertSupportedPropertyKeys(buildTaxonomy({ properties: ["mask contextuality"] })),
    ).toThrow(/Property "mask contextuality"/);
  });

  it("rejects a taxonomy with no properties", () => {
    expect(() =>
      assertSupportedPropertyKeys(buildTaxonomy({ properties: [] })),
    ).toThrow(/declares no properties/);
  });
});

describe("buildTaxonomyTableContent", () => {
  const content = buildTaxonomyTableContent(buildTaxonomy());

  it("scopes rows to notes linked to this taxonomy", () => {
    expect(content).toContain(
      '    - taxonomy == link("Post-Training Sparsity Taxonomy")',
    );
  });

  it("keeps only notes that carry every property", () => {
    expect(content).toContain("    - formula.missing_properties.isEmpty()");
  });

  it("reads the required properties from the taxonomy note", () => {
    expect(content).toContain(
      '  required_properties: link("Post-Training Sparsity Taxonomy").asFile().properties.taxonomy_properties',
    );
    expect(content).toContain(
      "  missing_properties: formula.required_properties.filter(!file.hasProperty(value))",
    );
  });

  it("declares one column per property with a derived display name", () => {
    expect(content).toContain(
      "  note.mask_contextuality:\n    displayName: Mask Contextuality",
    );
    expect(content).toContain(
      "  note.criterion_derivation:\n    displayName: Criterion Derivation",
    );
  });

  it("orders the properties as the taxonomy declares them", () => {
    expect(content).toContain(
      [
        "    order:",
        "      - file.name",
        "      - mask_contextuality",
        "      - training",
        "      - objective_scope",
        "      - criterion_derivation",
        "      - derivative_order",
        "    sort:",
      ].join("\n"),
    );
  });

  it("sizes the file name column and each property column", () => {
    expect(content).toContain(
      [
        "    columnSize:",
        "      file.name: 200",
        "      note.mask_contextuality: 300",
        "      note.training: 300",
        "      note.objective_scope: 300",
        "      note.criterion_derivation: 300",
        "      note.derivative_order: 300",
      ].join("\n"),
    );
  });

  it("sorts by date descending and uses a medium row height", () => {
    expect(content).toContain(
      "    sort:\n      - property: date\n        direction: DESC",
    );
    expect(content).toContain("    rowHeight: medium");
  });

  it("escapes a taxonomy name that carries quotes", () => {
    const quoted = buildTaxonomyTableContent(
      buildTaxonomy({ name: 'A "quoted" Taxonomy', properties: ["training"] }),
    );

    expect(quoted).toContain(
      '    - taxonomy == link("A \\"quoted\\" Taxonomy")',
    );
  });

  it("starts at the filter block and ends with a newline", () => {
    expect(content.startsWith("filters:\n")).toBe(true);
    expect(content.endsWith("\n")).toBe(true);
  });

  it("refuses to build content for an unsupported key", () => {
    expect(() =>
      buildTaxonomyTableContent(buildTaxonomy({ properties: ["a:b"] })),
    ).toThrow(/cannot be a YAML key/);
  });
});

describe("createTaxonomyTable", () => {
  it("creates the base file with the generated content", async () => {
    const port = buildFilePort();

    const result = await createTaxonomyTable(buildTaxonomy(), port);

    expect(result.status).toBe("created");
    expect(result.path).toBe(
      "general_notes/Post-Training Sparsity Taxonomy Classification Table.base",
    );
    expect(port.createFile).toHaveBeenCalledWith(
      "general_notes/Post-Training Sparsity Taxonomy Classification Table.base",
      buildTaxonomyTableContent(buildTaxonomy()),
    );
  });

  it("ensures the general notes folder exists before writing", async () => {
    const port = buildFilePort();

    await createTaxonomyTable(buildTaxonomy(), port);

    expect(port.ensureFolder).toHaveBeenCalledWith("general_notes");
  });

  it("does not overwrite an existing table", async () => {
    const port = buildFilePort({
      path: "general_notes/Post-Training Sparsity Taxonomy Classification Table.base",
    });

    const result = await createTaxonomyTable(buildTaxonomy(), port);

    expect(result.status).toBe("exists");
    expect(port.createFile).not.toHaveBeenCalled();
  });

  it("refuses before touching the vault when a key is unsupported", async () => {
    const port = buildFilePort();

    await expect(
      createTaxonomyTable(buildTaxonomy({ properties: ["a b"] }), port),
    ).rejects.toThrow(/cannot be a YAML key/);
    expect(port.ensureFolder).not.toHaveBeenCalled();
    expect(port.createFile).not.toHaveBeenCalled();
  });
});
