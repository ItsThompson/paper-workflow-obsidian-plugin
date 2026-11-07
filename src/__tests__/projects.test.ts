import { describe, it, expect } from "vitest";
import {
  collectProjectChoices,
  normalizeProjectTag,
  readStoredProjects,
  registerProject,
  resolveProjectTitle,
} from "../projects";
import type { Project } from "../types";

function buildProject(overrides: Partial<Project> = {}): Project {
  return { tag: "research/dissertation", title: "Dissertation", ...overrides };
}

describe("normalizeProjectTag", () => {
  it("keeps a tag that already has the research prefix", () => {
    expect(normalizeProjectTag("research/dissertation")).toBe(
      "research/dissertation",
    );
  });

  it("strips a leading hash", () => {
    expect(normalizeProjectTag("#research/dissertation")).toBe(
      "research/dissertation",
    );
  });

  it("adds the research prefix to a bare name", () => {
    expect(normalizeProjectTag("dissertation")).toBe("research/dissertation");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeProjectTag("  #dissertation  ")).toBe(
      "research/dissertation",
    );
  });

  it("returns an empty string for an empty value", () => {
    expect(normalizeProjectTag("")).toBe("");
    expect(normalizeProjectTag("   ")).toBe("");
    expect(normalizeProjectTag("#")).toBe("");
  });
});

describe("resolveProjectTitle", () => {
  it("prefers the registered title", () => {
    const projects = [buildProject({ title: "Undergrad Dissertation" })];

    expect(resolveProjectTitle("research/dissertation", projects)).toBe(
      "Undergrad Dissertation",
    );
  });

  it("falls back to the tag with the prefix stripped", () => {
    expect(resolveProjectTitle("research/unregistered", [])).toBe(
      "unregistered",
    );
  });

  it("ignores a registration for a different tag", () => {
    const projects = [buildProject({ tag: "research/other" })];

    expect(resolveProjectTitle("research/dissertation", projects)).toBe(
      "dissertation",
    );
  });
});

describe("registerProject", () => {
  it("appends a project whose tag is new", () => {
    const existing = [buildProject()];

    const updated = registerProject(existing, {
      tag: "research/second",
      title: "Second",
    });

    expect(updated).toEqual([
      { tag: "research/dissertation", title: "Dissertation" },
      { tag: "research/second", title: "Second" },
    ]);
  });

  it("keeps the existing title when the tag is already registered", () => {
    const existing = [buildProject({ title: "Undergrad Dissertation" })];

    const updated = registerProject(existing, {
      tag: "research/dissertation",
      title: "Replacement",
    });

    expect(updated).toEqual([
      { tag: "research/dissertation", title: "Undergrad Dissertation" },
    ]);
  });

  it("does not mutate the input list", () => {
    const existing: Project[] = [];

    registerProject(existing, { tag: "research/second", title: "Second" });

    expect(existing).toEqual([]);
  });
});

describe("collectProjectChoices", () => {
  it("combines vault tags with registered projects", () => {
    const choices = collectProjectChoices(["research/alpha"], [
      buildProject({ tag: "research/beta", title: "Beta Project" }),
    ]);

    expect(choices).toEqual([
      { tag: "research/alpha", title: "alpha" },
      { tag: "research/beta", title: "Beta Project" },
    ]);
  });

  it("lists a shared tag once and applies the registered title", () => {
    const choices = collectProjectChoices(
      ["research/dissertation"],
      [buildProject({ title: "Undergrad Dissertation" })],
    );

    expect(choices).toEqual([
      { tag: "research/dissertation", title: "Undergrad Dissertation" },
    ]);
  });

  it("drops tags that are not research tags", () => {
    const choices = collectProjectChoices(["papers"], [
      buildProject({ tag: "", title: "Blank row" }),
    ]);

    expect(choices).toEqual([]);
  });

  it("sorts the choices by tag", () => {
    const choices = collectProjectChoices(
      ["research/gamma", "research/alpha", "research/beta"],
      [],
    );

    expect(choices.map((choice) => choice.tag)).toEqual([
      "research/alpha",
      "research/beta",
      "research/gamma",
    ]);
  });
});

describe("readStoredProjects", () => {
  it("reads a well-formed payload", () => {
    const stored = {
      projects: [{ tag: "research/dissertation", title: "Dissertation" }],
    };

    expect(readStoredProjects(stored)).toEqual([
      { tag: "research/dissertation", title: "Dissertation" },
    ]);
  });

  it("returns an empty list when nothing is stored", () => {
    expect(readStoredProjects(null)).toEqual([]);
    expect(readStoredProjects(undefined)).toEqual([]);
    expect(readStoredProjects({})).toEqual([]);
  });

  it("returns an empty list when projects is not an array", () => {
    expect(readStoredProjects({ projects: "research/dissertation" })).toEqual([]);
  });

  it("drops entries that are not tag/title string pairs", () => {
    const stored = {
      projects: [
        { tag: "research/valid", title: "Valid" },
        { tag: "research/missing-title" },
        { tag: 12, title: "Bad tag" },
        null,
        "research/string-entry",
      ],
    };

    expect(readStoredProjects(stored)).toEqual([
      { tag: "research/valid", title: "Valid" },
    ]);
  });
});
