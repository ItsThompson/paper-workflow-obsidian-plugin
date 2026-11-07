export interface Project {
  tag: string;
  title: string;
}

/**
 * Vault operations needed to create a note whose path may already exist.
 * FileHandle is the vault's own file type, so callers keep their concrete
 * handle (TFile) without casting.
 */
export interface FileCreationPort<FileHandle> {
  getFileByPath(path: string): FileHandle | null;
  createFile(path: string, content: string): Promise<FileHandle>;
  ensureFolder(folderPath: string): Promise<void>;
}
