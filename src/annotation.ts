import { ANNOTATION_TAG } from "./constants";
import type { FileCreationPort } from "./types";

export interface AnnotationNoteInput {
  paperTitle: string;
  paperFolderPath: string;
  projectTag: string;
  projectTitle: string;
  todayIso: string;
}

export type AnnotationCreationResult<FileHandle> =
  | { status: "created"; file: FileHandle; path: string }
  | { status: "exists"; file: FileHandle; path: string };

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function buildAnnotationContent(
  input: AnnotationNoteInput,
): string {
  return [
    "---",
    "tags:",
    `  - ${ANNOTATION_TAG}`,
    `  - ${input.projectTag}`,
    `date: ${input.todayIso}`,
    `paper: "[[${input.paperTitle}]]"`,
    "connection_to_own_research:",
    "identified_gap:",
    "---",
    "",
  ].join("\n");
}

export function buildAnnotationNotePath(input: AnnotationNoteInput): string {
  const folderPath = input.paperFolderPath.replace(/^\/+|\/+$/g, "");
  const fileName = `${input.paperTitle} - ${input.projectTitle}.md`;

  return folderPath.length > 0 ? `${folderPath}/${fileName}` : fileName;
}

export async function createAnnotationNote<FileHandle>(
  input: AnnotationNoteInput,
  port: FileCreationPort<FileHandle>,
): Promise<AnnotationCreationResult<FileHandle>> {
  const path = buildAnnotationNotePath(input);

  const existing = port.getFileByPath(path);
  if (existing) return { status: "exists", file: existing, path };

  const file = await port.createFile(path, buildAnnotationContent(input));

  return { status: "created", file, path };
}
