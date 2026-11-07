import { describe, it, expect, vi } from "vitest";
import {
  buildLiteratureMatrixContent,
  buildLiteratureMatrixPath,
  createLiteratureMatrix,
  normalizeBaseFileName,
  parseLiteratureMatrixInput,
  type LiteratureMatrixInput,
} from "../matrix";
import type { FileCreationPort } from "../types";

function buildMatrixInput(
  overrides: Partial<LiteratureMatrixInput> = {},
): LiteratureMatrixInput {
  return {
    baseFileName: "Literature Matrix.base",
    projectTag: "research/dissertation",
    projectTitle: "Dissertation",
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

describe("buildLiteratureMatrixContent", () => {
  const content = buildLiteratureMatrixContent("research/dissertation");

  it("filters rows to papers of the project", () => {
    expect(content).toContain('file.tags.contains("papers")');
    expect(content).toContain('file.tags.contains("research/dissertation")');
  });

  it("scopes the annotation lookup to the project tag", () => {
    expect(content).toContain(
      'ann: file.backlinks.filter(value.asFile().hasTag("paper/annotation") && value.asFile().hasTag("research/dissertation"))',
    );
  });

  it("defines the annotation, connection, and gap formulas", () => {
    expect(content).toContain("formulas:");
    expect(content).toContain(
      "connection: if(formula.ann.length > 0, formula.ann[0].asFile().properties.connection_to_own_research, \"\")",
    );
    expect(content).toContain(
      'gap: if(formula.ann.length > 0, formula.ann[0].asFile().properties.identified_gap, "")',
    );
    expect(content).toContain(
      'annotation: if(formula.ann.length > 0, formula.ann[0], "")',
    );
  });

  it("declares the columns of the dissertation matrix", () => {
    expect(content).toContain(
      "note.contribution:\n    displayName: Contribution (Purpose, Method, Implications)",
    );
    expect(content).toContain(
      "formula.connection:\n    displayName: Connection to Own Research",
    );
    expect(content).toContain(
      "formula.gap:\n    displayName: Identified Gap",
    );
    expect(content).toContain(
      "note.notable_experimentation_approaches:\n    displayName: Notable Experimentation Approaches",
    );
    expect(content).toContain(
      "formula.annotation:\n    displayName: Annotation",
    );
    expect(content).toContain("note.link:\n    displayName: Link");
    expect(content).toContain("note.pass:\n    displayName: Pass");
  });

  it("declares a wrapping table view with the column order and widths", () => {
    expect(content).toContain("views:\n  - type: table\n    name: Table");
    expect(content).toContain("    rowHeight: tall");
    expect(content).toContain("      - formula.connection");
    expect(content).toContain("      - formula.gap");
    expect(content).toContain("      note.contribution: 354");
  });

  it("leaves no placeholder behind and substitutes the tag in filter and formula", () => {
    expect(content).not.toContain("__PROJECT_TAG__");
    expect(content.split("research/dissertation")).toHaveLength(3);
  });

  it("starts at the filter block and ends with a newline", () => {
    expect(content.startsWith("filters:\n")).toBe(true);
    expect(content.endsWith("\n")).toBe(true);
  });
});

describe("normalizeBaseFileName", () => {
  it("appends the .base extension when missing", () => {
    expect(normalizeBaseFileName("Literature Matrix")).toBe(
      "Literature Matrix.base",
    );
  });

  it("keeps an existing .base extension", () => {
    expect(normalizeBaseFileName("Literature Matrix.base")).toBe(
      "Literature Matrix.base",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeBaseFileName("  Literature Matrix  ")).toBe(
      "Literature Matrix.base",
    );
  });

  it("returns an empty string for an empty name", () => {
    expect(normalizeBaseFileName("   ")).toBe("");
  });
});

describe("buildLiteratureMatrixPath", () => {
  it("places the base file in the general notes folder", () => {
    expect(buildLiteratureMatrixPath("Literature Matrix.base")).toBe(
      "general_notes/Literature Matrix.base",
    );
  });

  it("appends the extension so a caller cannot create a file Obsidian ignores", () => {
    expect(buildLiteratureMatrixPath("Literature Matrix")).toBe(
      "general_notes/Literature Matrix.base",
    );
  });
});

describe("parseLiteratureMatrixInput", () => {
  it("normalizes the file name and project tag", () => {
    const result = parseLiteratureMatrixInput({
      baseFileName: " Literature Matrix ",
      projectTag: "#research/dissertation",
      projectTitle: "  Undergrad Dissertation  ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        baseFileName: "Literature Matrix.base",
        projectTag: "research/dissertation",
        projectTitle: "Undergrad Dissertation",
      },
    });
  });

  it("adds the research prefix to a bare tag", () => {
    const result = parseLiteratureMatrixInput({
      baseFileName: "Matrix",
      projectTag: "dissertation",
      projectTitle: "Dissertation",
    });

    expect(result.ok && result.value.projectTag).toBe("research/dissertation");
  });

  it("rejects a missing base file name", () => {
    const result = parseLiteratureMatrixInput({
      baseFileName: "  ",
      projectTag: "research/dissertation",
      projectTitle: "Dissertation",
    });

    expect(result).toEqual({
      ok: false,
      error: "Base file name is required.",
    });
  });

  it("rejects a missing project tag", () => {
    const result = parseLiteratureMatrixInput({
      baseFileName: "Matrix",
      projectTag: "  ",
      projectTitle: "Dissertation",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a missing project title", () => {
    const result = parseLiteratureMatrixInput({
      baseFileName: "Matrix",
      projectTag: "research/dissertation",
      projectTitle: "  ",
    });

    expect(result).toEqual({
      ok: false,
      error: "Project title is required.",
    });
  });
});

describe("createLiteratureMatrix", () => {
  it("creates the base file with the generated content", async () => {
    const port = buildFilePort();

    const result = await createLiteratureMatrix(buildMatrixInput(), port);

    expect(result.status).toBe("created");
    expect(result.path).toBe("general_notes/Literature Matrix.base");
    expect(port.createFile).toHaveBeenCalledWith(
      "general_notes/Literature Matrix.base",
      buildLiteratureMatrixContent("research/dissertation"),
    );
  });

  it("ensures the general notes folder exists before writing", async () => {
    const port = buildFilePort();

    await createLiteratureMatrix(buildMatrixInput(), port);

    expect(port.ensureFolder).toHaveBeenCalledWith("general_notes");
  });

  it("does not overwrite an existing base file", async () => {
    const port = buildFilePort({ path: "general_notes/Literature Matrix.base" });

    const result = await createLiteratureMatrix(buildMatrixInput(), port);

    expect(result.status).toBe("exists");
    expect(port.createFile).not.toHaveBeenCalled();
  });

  it("creates the base file when the input name has no extension", async () => {
    const port = buildFilePort();

    const result = await createLiteratureMatrix(
      buildMatrixInput({ baseFileName: "Literature Matrix" }),
      port,
    );

    expect(result.path).toBe("general_notes/Literature Matrix.base");
    expect(port.createFile).toHaveBeenCalledWith(
      "general_notes/Literature Matrix.base",
      expect.any(String),
    );
  });
});
