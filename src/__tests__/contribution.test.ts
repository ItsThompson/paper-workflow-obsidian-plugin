import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createContributionSync,
  extractContributionFromBody,
  markdownToPlainText,
} from "../contribution";

function buildPaperBody(contributionLine: string): string {
  return [
    "---",
    "tags:",
    "  - papers",
    "---",
    "[[Research Papers]]",
    "# CATS: Contextually-Aware Thresholding",
    contributionLine,
    "",
    "## Method",
  ].join("\n");
}

interface NotePortOptions {
  content: string;
  contribution: string | undefined;
}

/** Keyed by file path so a single sync can be exercised across several notes. */
function buildNotePort(initial: NotePortOptions) {
  const contents = new Map<string, string>();
  const contributions = new Map<string, string | undefined>();

  return {
    readContent: vi.fn((filePath: string) =>
      Promise.resolve(contents.get(filePath) ?? initial.content),
    ),
    readContribution: vi.fn((filePath: string) =>
      contributions.has(filePath)
        ? contributions.get(filePath)
        : initial.contribution,
    ),
    writeContribution: vi.fn(
      (filePath: string, plainContribution: string) => {
        contributions.set(filePath, plainContribution);
        return Promise.resolve();
      },
    ),
    setContent(filePath: string, content: string): void {
      contents.set(filePath, content);
    },
    contributionFor(filePath: string): string | undefined {
      return contributions.has(filePath)
        ? contributions.get(filePath)
        : initial.contribution;
    },
  };
}

describe("markdownToPlainText", () => {
  it("uses the alias of a wikilink with one", () => {
    expect(markdownToPlainText("[[Target|Alias]]")).toBe("Alias");
  });

  it("uses the target of a wikilink without an alias", () => {
    expect(markdownToPlainText("[[Target]]")).toBe("Target");
  });

  it("drops a heading subpath from a wikilink", () => {
    expect(markdownToPlainText("[[Target#Heading]]")).toBe("Target");
  });

  it("drops a block subpath from a wikilink", () => {
    expect(markdownToPlainText("[[Target#^block-id]]")).toBe("Target");
  });

  it("prefers the alias when a wikilink has both a subpath and an alias", () => {
    expect(markdownToPlainText("[[Target#Heading|Alias]]")).toBe("Alias");
  });

  it("reduces a markdown link to its text", () => {
    expect(markdownToPlainText("[text](https://example.com)")).toBe("text");
  });

  it("strips bold markers", () => {
    expect(markdownToPlainText("**bold**")).toBe("bold");
    expect(markdownToPlainText("__bold__")).toBe("bold");
  });

  it("strips italic markers", () => {
    expect(markdownToPlainText("*italic*")).toBe("italic");
    expect(markdownToPlainText("_italic_")).toBe("italic");
  });

  it("strips nested emphasis", () => {
    expect(markdownToPlainText("**_both_**")).toBe("both");
    expect(markdownToPlainText("***both***")).toBe("both");
  });

  it("strips emphasis in the middle of a sentence", () => {
    expect(markdownToPlainText("tuned **hard** for _speed_")).toBe(
      "tuned hard for speed",
    );
  });

  it("keeps underscores inside identifiers", () => {
    expect(markdownToPlainText("learning_rate is tuned")).toBe(
      "learning_rate is tuned",
    );
    expect(markdownToPlainText("a_snake_case_name and another_one")).toBe(
      "a_snake_case_name and another_one",
    );
  });

  it("keeps a single tilde and a single equals sign", () => {
    expect(markdownToPlainText("reaches base within ~500 steps")).toBe(
      "reaches base within ~500 steps",
    );
    expect(markdownToPlainText("sparsity = 0.5")).toBe("sparsity = 0.5");
  });

  it("keeps a literal asterisk that is not emphasis", () => {
    expect(markdownToPlainText("2 * 3 * 4")).toBe("2 * 3 * 4");
  });

  it("strips inline code ticks", () => {
    expect(markdownToPlainText("`code`")).toBe("code");
  });

  it("strips highlight markers", () => {
    expect(markdownToPlainText("==highlight==")).toBe("highlight");
  });

  it("strips strikethrough markers", () => {
    expect(markdownToPlainText("~~strike~~")).toBe("strike");
  });

  it("collapses whitespace and trims", () => {
    expect(markdownToPlainText("  a \n\n  b \t c  ")).toBe("a b c");
  });

  it("converts the contribution line of a real paper note", () => {
    const contribution =
      "Proposes a framework & non-linear [[Activation Functions|activation function]] " +
      "with the objective of [[Feed-Forward Neural Network (FFN)#Sparsity of FFN|sparsity]] " +
      "activation of LLMs.";

    expect(markdownToPlainText(contribution)).toBe(
      "Proposes a framework & non-linear activation function with the objective of sparsity activation of LLMs.",
    );
  });

  it("leaves plain prose untouched", () => {
    expect(markdownToPlainText("Plain (prose) stays as-is.")).toBe(
      "Plain (prose) stays as-is.",
    );
  });
});

describe("extractContributionFromBody", () => {
  it("returns the raw markdown value of the contribution line", () => {
    const body = buildPaperBody("**Contribution**: Uses [[CATS|a threshold]].");

    expect(extractContributionFromBody(body)).toBe("Uses [[CATS|a threshold]].");
  });

  it("returns null when the body has no contribution line", () => {
    const body = buildPaperBody("**Note**: nothing here.");

    expect(extractContributionFromBody(body)).toBeNull();
  });

  it("returns null when the contribution value is empty", () => {
    const body = buildPaperBody("**Contribution**:   ");

    expect(extractContributionFromBody(body)).toBeNull();
  });

  it("ignores a contribution marker that is not at the start of a line", () => {
    const body = buildPaperBody("Note: **Contribution**: not a field.");

    expect(extractContributionFromBody(body)).toBeNull();
  });

  it("takes the first contribution line when several exist", () => {
    const body = buildPaperBody(
      ["**Contribution**: first", "**Contribution**: second"].join("\n"),
    );

    expect(extractContributionFromBody(body)).toBe("first");
  });

  it("tolerates spacing around the label and colon", () => {
    const body = buildPaperBody("  **Contribution** :   spaced value  ");

    expect(extractContributionFromBody(body)).toBe("spaced value");
  });
});

describe("createContributionSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const filePath = "general_notes/CATS.md";
  const debounceMs = 10;

  it("writes the plain text when the frontmatter differs", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Uses [[CATS|a threshold]]."),
      contribution: "stale value",
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).toHaveBeenCalledWith(
      filePath,
      "Uses a threshold.",
    );
  });

  it("does not write when the frontmatter already matches", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Same text."),
      contribution: "Same text.",
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).not.toHaveBeenCalled();
  });

  it("does not write when the body has no contribution line", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Note**: nothing here."),
      contribution: "existing value",
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).not.toHaveBeenCalled();
  });

  it("coalesces rapid saves of one file into a single write", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Final text."),
      contribution: undefined,
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    sync.schedule(filePath);
    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).toHaveBeenCalledTimes(1);
  });

  it("tracks each file path separately", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Text."),
      contribution: undefined,
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    sync.schedule("general_notes/Other.md");
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).toHaveBeenCalledTimes(2);
  });

  it("ignores the modify event caused by its own write", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: First text."),
      contribution: undefined,
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);
    expect(port.writeContribution).toHaveBeenCalledTimes(1);

    // The plugin's own frontmatter write fires a modify event.
    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);
    expect(port.writeContribution).toHaveBeenCalledTimes(1);
  });

  it("still reacts to a later edit after ignoring its own write", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: First text."),
      contribution: undefined,
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);
    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    port.setContent(filePath, buildPaperBody("**Contribution**: Second text."));
    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).toHaveBeenCalledTimes(2);
    expect(port.contributionFor(filePath)).toBe("Second text.");
  });

  it("cancels pending work on dispose", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Text."),
      contribution: undefined,
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    sync.dispose();
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).not.toHaveBeenCalled();
  });

  it("does not throw when the note cannot be read", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const port = buildNotePort({ content: "", contribution: undefined });
    port.readContent.mockRejectedValue(new Error("file deleted"));
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.writeContribution).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not throw when the frontmatter write fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Text."),
      contribution: undefined,
    });
    port.writeContribution.mockRejectedValue(new Error("locked file"));
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("recovers after a failed write instead of swallowing the next edit", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: First text."),
      contribution: undefined,
    });
    port.writeContribution.mockRejectedValueOnce(new Error("locked file"));
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);
    expect(consoleError).toHaveBeenCalledTimes(1);

    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.contributionFor(filePath)).toBe("First text.");
    consoleError.mockRestore();
  });
});

describe("createContributionSync.reconcile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const filePath = "general_notes/CATS.md";
  const debounceMs = 2000;

  it("writes the plain text without waiting for the debounce", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Drifted text."),
      contribution: "stale value",
    });
    const sync = createContributionSync(port, debounceMs);

    await sync.reconcile(filePath);

    expect(port.writeContribution).toHaveBeenCalledWith(
      filePath,
      "Drifted text.",
    );
  });

  it("does not write when the note is already in step", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Same text."),
      contribution: "Same text.",
    });
    const sync = createContributionSync(port, debounceMs);

    await sync.reconcile(filePath);

    expect(port.writeContribution).not.toHaveBeenCalled();
  });

  it("does not write when the body has no contribution line", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Note**: nothing here."),
      contribution: "existing value",
    });
    const sync = createContributionSync(port, debounceMs);

    await sync.reconcile(filePath);

    expect(port.writeContribution).not.toHaveBeenCalled();
  });

  it("drops a pending debounced run instead of reading twice", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: Drifted text."),
      contribution: "stale value",
    });
    const sync = createContributionSync(port, debounceMs);

    sync.schedule(filePath);
    await sync.reconcile(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(port.readContent).toHaveBeenCalledTimes(1);
  });

  it("settles at one write across open, own-write modify, and re-open", async () => {
    const port = buildNotePort({
      content: buildPaperBody("**Contribution**: New text."),
      contribution: "stale value",
    });
    const sync = createContributionSync(port, debounceMs);

    await sync.reconcile(filePath);
    expect(port.contributionFor(filePath)).toBe("New text.");

    // The modify event caused by the plugin's own frontmatter write.
    sync.schedule(filePath);
    await vi.advanceTimersByTimeAsync(debounceMs);

    await sync.reconcile(filePath);

    expect(port.writeContribution).toHaveBeenCalledTimes(1);
  });

  it("resolves without throwing when the note cannot be read", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const port = buildNotePort({ content: "", contribution: undefined });
    port.readContent.mockRejectedValue(new Error("file deleted"));
    const sync = createContributionSync(port, debounceMs);

    await expect(sync.reconcile(filePath)).resolves.toBeUndefined();

    expect(port.writeContribution).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
