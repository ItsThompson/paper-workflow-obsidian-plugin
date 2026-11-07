import { describe, it, expect, vi } from "vitest";
import {
  buildAnnotationContent,
  buildAnnotationNotePath,
  createAnnotationNote,
  toIsoDate,
  type AnnotationNoteInput,
} from "../annotation";
import type { FileCreationPort } from "../types";

function buildAnnotationInput(
  overrides: Partial<AnnotationNoteInput> = {},
): AnnotationNoteInput {
  return {
    paperTitle: "CATS",
    paperFolderPath: "general_notes",
    projectTag: "research/undergrad_dissertation",
    projectTitle: "Dissertation",
    todayIso: "2026-11-07",
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

describe("toIsoDate", () => {
  it("formats a date as YYYY-MM-DD in local time", () => {
    expect(toIsoDate(new Date(2026, 10, 7))).toBe("2026-11-07");
  });

  it("pads single-digit months and days", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("buildAnnotationContent", () => {
  it("writes frontmatter tags, date, paper link, and empty judgement fields", () => {
    const content = buildAnnotationContent(buildAnnotationInput());

    expect(content).toBe(
      [
        "---",
        "tags:",
        "  - paper/annotation",
        "  - research/undergrad_dissertation",
        "date: 2026-11-07",
        'paper: "[[CATS]]"',
        "connection_to_own_research:",
        "identified_gap:",
        "---",
        "",
      ].join("\n"),
    );
  });

  it("links back to the paper with a quoted wikilink", () => {
    const content = buildAnnotationContent(
      buildAnnotationInput({ paperTitle: "Attention Is All You Need" }),
    );

    expect(content).toContain('paper: "[[Attention Is All You Need]]"');
  });

  it("carries the chosen project tag, not a fixed one", () => {
    const content = buildAnnotationContent(
      buildAnnotationInput({ projectTag: "research/phd" }),
    );

    expect(content).toContain("  - research/phd");
    expect(content).not.toContain("research/undergrad_dissertation");
  });
});

describe("buildAnnotationNotePath", () => {
  it("names the note after the paper and project title in the paper's folder", () => {
    expect(buildAnnotationNotePath(buildAnnotationInput())).toBe(
      "general_notes/CATS - Dissertation.md",
    );
  });

  it("omits the folder when the paper sits at the vault root", () => {
    const path = buildAnnotationNotePath(
      buildAnnotationInput({ paperFolderPath: "" }),
    );

    expect(path).toBe("CATS - Dissertation.md");
  });

  it("treats the vault root folder path as no folder", () => {
    const path = buildAnnotationNotePath(
      buildAnnotationInput({ paperFolderPath: "/" }),
    );

    expect(path).toBe("CATS - Dissertation.md");
  });

  it("does not double the separator when the folder path has a trailing slash", () => {
    const path = buildAnnotationNotePath(
      buildAnnotationInput({ paperFolderPath: "papers/2026/" }),
    );

    expect(path).toBe("papers/2026/CATS - Dissertation.md");
  });
});

describe("createAnnotationNote", () => {
  it("creates the note with the built content", async () => {
    const port = buildFilePort();

    const result = await createAnnotationNote(buildAnnotationInput(), port);

    expect(result.status).toBe("created");
    expect(result.path).toBe("general_notes/CATS - Dissertation.md");
    expect(port.createFile).toHaveBeenCalledWith(
      "general_notes/CATS - Dissertation.md",
      buildAnnotationContent(buildAnnotationInput()),
    );
  });

  it("returns the created file handle and its path", async () => {
    const port = buildFilePort();

    const result = await createAnnotationNote(buildAnnotationInput(), port);

    expect(result.file).toEqual({ path: "general_notes/CATS - Dissertation.md" });
  });

  it("returns the existing note without creating a duplicate", async () => {
    const existing = { path: "general_notes/CATS - Dissertation.md" };
    const port = buildFilePort(existing);

    const result = await createAnnotationNote(buildAnnotationInput(), port);

    expect(result.status).toBe("exists");
    expect(result.file).toBe(existing);
    expect(port.createFile).not.toHaveBeenCalled();
  });
});
