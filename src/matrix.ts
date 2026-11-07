import {
  ANNOTATION_TAG,
  BASE_FILE_EXTENSION,
  GENERAL_NOTES_FOLDER,
  PAPER_TAG,
} from "./constants";
import { isResearchTag } from "./papers";
import { normalizeProjectTag } from "./projects";
import type { FileCreationPort } from "./types";

const PROJECT_TAG_PLACEHOLDER = "__PROJECT_TAG__";

/**
 * Mirrors the hand-authored dissertation matrix. Bases has no join or rollup, so
 * the annotation columns read the linked annotation note through `file.backlinks`
 * and need the project tag in both the row filter and the annotation filter.
 */
const LITERATURE_MATRIX_TEMPLATE = `filters:
  and:
    - file.tags.contains("${PAPER_TAG}")
    - file.tags.contains("${PROJECT_TAG_PLACEHOLDER}")
formulas:
  ann: file.backlinks.filter(value.asFile().hasTag("${ANNOTATION_TAG}") && value.asFile().hasTag("${PROJECT_TAG_PLACEHOLDER}"))
  connection: if(formula.ann.length > 0, formula.ann[0].asFile().properties.connection_to_own_research, "")
  gap: if(formula.ann.length > 0, formula.ann[0].asFile().properties.identified_gap, "")
  annotation: if(formula.ann.length > 0, formula.ann[0], "")
properties:
  note.contribution:
    displayName: Contribution (Purpose, Method, Implications)
  formula.connection:
    displayName: Connection to Own Research
  formula.gap:
    displayName: Identified Gap
  note.notable_experimentation_approaches:
    displayName: Notable Experimentation Approaches
  formula.annotation:
    displayName: Annotation
  note.link:
    displayName: Link
  note.pass:
    displayName: Pass
views:
  - type: table
    name: Table
    order:
      - file.name
      - pass
      - contribution
      - notable_experimentation_approaches
      - formula.connection
      - formula.gap
      - formula.annotation
      - link
    sort: []
    rowHeight: tall
    columnSize:
      file.name: 120
      note.pass: 76
      note.contribution: 354
      formula.gap: 265
      note.notable_experimentation_approaches: 315
`;

export interface LiteratureMatrixInput {
  baseFileName: string;
  projectTag: string;
  projectTitle: string;
}

export type LiteratureMatrixInputResult =
  | { ok: true; value: LiteratureMatrixInput }
  | { ok: false; error: string };

export type LiteratureMatrixCreationResult<FileHandle> =
  | { status: "created"; file: FileHandle; path: string }
  | { status: "exists"; path: string };

export function buildLiteratureMatrixContent(projectTag: string): string {
  return LITERATURE_MATRIX_TEMPLATE.split(PROJECT_TAG_PLACEHOLDER).join(
    projectTag,
  );
}

export function normalizeBaseFileName(rawName: string): string {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.endsWith(BASE_FILE_EXTENSION)) return trimmed;

  return `${trimmed}${BASE_FILE_EXTENSION}`;
}

export function buildLiteratureMatrixPath(baseFileName: string): string {
  return `${GENERAL_NOTES_FOLDER}/${normalizeBaseFileName(baseFileName)}`;
}

export function parseLiteratureMatrixInput(raw: {
  baseFileName: string;
  projectTag: string;
  projectTitle: string;
}): LiteratureMatrixInputResult {
  const baseFileName = normalizeBaseFileName(raw.baseFileName);
  if (baseFileName.length === 0) {
    return { ok: false, error: "Base file name is required." };
  }

  const projectTag = normalizeProjectTag(raw.projectTag);
  if (!isResearchTag(projectTag)) {
    return { ok: false, error: "Research tag is required, e.g. research/my_project." };
  }

  const projectTitle = raw.projectTitle.trim();
  if (projectTitle.length === 0) {
    return { ok: false, error: "Project title is required." };
  }

  return { ok: true, value: { baseFileName, projectTag, projectTitle } };
}

export async function createLiteratureMatrix<FileHandle>(
  input: LiteratureMatrixInput,
  port: FileCreationPort<FileHandle>,
): Promise<LiteratureMatrixCreationResult<FileHandle>> {
  const path = buildLiteratureMatrixPath(input.baseFileName);

  if (port.getFileByPath(path)) return { status: "exists", path };

  await port.ensureFolder(GENERAL_NOTES_FOLDER);
  const file = await port.createFile(
    path,
    buildLiteratureMatrixContent(input.projectTag),
  );

  return { status: "created", file, path };
}
