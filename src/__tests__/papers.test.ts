import { describe, it, expect } from "vitest";
import {
  hasPaperTag,
  isResearchTag,
  readFrontmatterTags,
  uniqueResearchTags,
} from "../papers";

describe("readFrontmatterTags", () => {
  it("reads an array of tags", () => {
    const tags = readFrontmatterTags({ tags: ["papers", "research/dissertation"] });

    expect(tags).toEqual(["papers", "research/dissertation"]);
  });

  it("returns an empty array when frontmatter is missing", () => {
    expect(readFrontmatterTags(undefined)).toEqual([]);
    expect(readFrontmatterTags(null)).toEqual([]);
    expect(readFrontmatterTags({})).toEqual([]);
  });

  it("returns an empty array when tags hold a non-list value", () => {
    expect(readFrontmatterTags({ tags: 7 })).toEqual([]);
    expect(readFrontmatterTags({ tags: { name: "papers" } })).toEqual([]);
  });

  it("splits a comma-separated tag string and strips the leading hash", () => {
    const tags = readFrontmatterTags({ tags: "#papers, #research/dissertation" });

    expect(tags).toEqual(["papers", "research/dissertation"]);
  });

  it("drops empty entries and trims surrounding space", () => {
    const tags = readFrontmatterTags({ tags: ["  papers ", "", "   "] });

    expect(tags).toEqual(["papers"]);
  });

  it("ignores non-string entries in the tag array", () => {
    const tags = readFrontmatterTags({ tags: ["papers", 42, null] });

    expect(tags).toEqual(["papers"]);
  });
});

describe("hasPaperTag", () => {
  it("is true when the papers tag is present", () => {
    expect(hasPaperTag(["papers", "research/dissertation"])).toBe(true);
  });

  it("is false when the papers tag is absent", () => {
    expect(hasPaperTag(["paper", "research/dissertation"])).toBe(false);
    expect(hasPaperTag([])).toBe(false);
  });
});

describe("isResearchTag", () => {
  it("is true for a namespaced research tag", () => {
    expect(isResearchTag("research/undergrad_dissertation")).toBe(true);
  });

  it("is false for the bare prefix", () => {
    expect(isResearchTag("research/")).toBe(false);
    expect(isResearchTag("research")).toBe(false);
  });

  it("is false for tags outside the research namespace", () => {
    expect(isResearchTag("papers")).toBe(false);
    expect(isResearchTag("myresearch/project")).toBe(false);
  });
});

describe("uniqueResearchTags", () => {
  it("keeps only research tags, deduplicated and sorted", () => {
    const tags = uniqueResearchTags([
      "research/beta",
      "papers",
      "research/alpha",
      "research/beta",
      "computer-science/AI",
    ]);

    expect(tags).toEqual(["research/alpha", "research/beta"]);
  });

  it("returns an empty array when no research tags exist", () => {
    expect(uniqueResearchTags(["papers", "meta"])).toEqual([]);
  });
});
