import { CONTRIBUTION_LABEL } from "./constants";

const WIKILINK_PATTERN = /\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\([^)]*\)/g;
/**
 * CommonMark renders `_` emphasis only at a word boundary, so `learning_rate`
 * keeps its underscore while `_italic_` loses it. `*` has no such restriction.
 */
const STRONG_PATTERN = /(^|[^\w])(\*\*|__)(\S(?:.*?\S)?)\2(?=[^\w]|$)/g;
const EMPHASIS_PATTERN = /(^|[^\w])([*_])(\S(?:.*?\S)?)\2(?=[^\w]|$)/g;
const CODE_TICK_PATTERN = /`+/g;
const HIGHLIGHT_PATTERN = /={2,}/g;
const STRIKETHROUGH_PATTERN = /~{2,}/g;
const WHITESPACE_PATTERN = /\s+/g;

const CONTRIBUTION_LINE_PATTERN = new RegExp(
  `^\\s*\\*\\*${CONTRIBUTION_LABEL}\\*\\*\\s*:\\s*(.*)$`,
);

function replaceWikilink(
  _match: string,
  target: string,
  alias: string | undefined,
): string {
  const trimmedAlias = alias?.trim();
  if (trimmedAlias !== undefined && trimmedAlias.length > 0) return trimmedAlias;

  return target.trim();
}

export function markdownToPlainText(markdown: string): string {
  const withoutWikilinks = markdown.replace(WIKILINK_PATTERN, replaceWikilink);
  const withoutLinks = withoutWikilinks.replace(MARKDOWN_LINK_PATTERN, "$1");
  const withoutStrong = withoutLinks.replace(STRONG_PATTERN, "$1$3");
  const withoutEmphasis = withoutStrong.replace(EMPHASIS_PATTERN, "$1$3");
  const withoutCode = withoutEmphasis.replace(CODE_TICK_PATTERN, "");
  const withoutMarkers = withoutCode
    .replace(HIGHLIGHT_PATTERN, "")
    .replace(STRIKETHROUGH_PATTERN, "");

  return withoutMarkers.replace(WHITESPACE_PATTERN, " ").trim();
}

/** Returns the raw markdown value of the first `**Contribution**:` line. */
export function extractContributionFromBody(body: string): string | null {
  for (const line of body.split("\n")) {
    const value = CONTRIBUTION_LINE_PATTERN.exec(line)?.[1]?.trim();
    if (value !== undefined && value.length > 0) return value;
  }

  return null;
}

export interface ContributionNotePort {
  readContent(filePath: string): Promise<string>;
  readContribution(filePath: string): string | undefined;
  writeContribution(filePath: string, plainContribution: string): Promise<void>;
}

export interface ContributionSync {
  schedule(filePath: string): void;
  dispose(): void;
}

/**
 * Keeps paper-note frontmatter `contribution` in step with the body line.
 *
 * Prevents a write loop in two ways: the value is compared before writing, and
 * a path is held in `writingPaths` while the plugin's own write is in flight.
 * The modify event caused by that write consumes the entry and returns, so the
 * plugin never reacts to its own edit even when the metadata cache still holds
 * the previous value.
 */
export function createContributionSync(
  port: ContributionNotePort,
  debounceMs: number,
): ContributionSync {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const writingPaths = new Set<string>();

  async function syncContribution(filePath: string): Promise<void> {
    if (writingPaths.has(filePath)) {
      writingPaths.delete(filePath);
      return;
    }

    let content: string;
    try {
      content = await port.readContent(filePath);
    } catch (error) {
      console.error("[paper-workflow] cannot read paper note", filePath, error);
      return;
    }

    const rawContribution = extractContributionFromBody(content);
    if (rawContribution === null) return;

    const plainContribution = markdownToPlainText(rawContribution);
    if (port.readContribution(filePath) === plainContribution) return;

    writingPaths.add(filePath);
    try {
      await port.writeContribution(filePath, plainContribution);
    } catch (error) {
      writingPaths.delete(filePath);
      console.error(
        "[paper-workflow] cannot write contribution",
        filePath,
        error,
      );
    }
  }

  return {
    schedule(filePath: string): void {
      const pending = timers.get(filePath);
      if (pending !== undefined) clearTimeout(pending);

      timers.set(
        filePath,
        setTimeout(() => {
          timers.delete(filePath);
          void syncContribution(filePath);
        }, debounceMs),
      );
    },

    dispose(): void {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      writingPaths.clear();
    },
  };
}
