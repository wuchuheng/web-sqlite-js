import { DEFAULT_VERSION } from "./constants";

/** Ensure the root directory exists and is not shadowed by a file. */
export const ensureDir = async (
  root: FileSystemDirectoryHandle,
  dirName: string,
): Promise<FileSystemDirectoryHandle> => {
  try {
    return await root.getDirectoryHandle(dirName);
  } catch (error) {
    const name = (error as Error).name;
    if (name !== "NotFoundError") {
      throw error;
    }
  }
  try {
    await root.getFileHandle(dirName);
    throw new Error(`A file already exists with the name ${dirName}`);
  } catch (error) {
    const name = (error as Error).name;
    if (name !== "NotFoundError") {
      throw error;
    }
  }
  return await root.getDirectoryHandle(dirName, { create: true });
};

/** Ensure a file handle exists. */
export const ensureFile = async (
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemFileHandle> => {
  return await dir.getFileHandle(name, { create: true });
};

/** Write a text file atomically. */
export const writeTextFile = async (
  dir: FileSystemDirectoryHandle,
  name: string,
  contents: string,
): Promise<void> => {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
};

/** Copy a file handle's contents to a target file handle. */
export const copyFileHandle = async (
  source: FileSystemFileHandle,
  target: FileSystemFileHandle,
): Promise<void> => {
  const file = await source.getFile();
  const writable = await target.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
};

/** Remove a directory tree. */
export const removeDir = async (
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<void> => {
  await dir.removeEntry(name, { recursive: true });
};

/** Resolve an OPFS path for a versioned database (v2.1.0 flat structure). */
export const getDbPathForVersion = (
  dirName: string,
  version: string,
  mode?: "release" | "dev",
): string => {
  if (version === DEFAULT_VERSION) {
    return `${dirName}/default.sqlite3`;
  }
  // v2.1.0: Use flat file naming {version}.sqlite3 instead of nested directories
  // For dev versions, use {version}.dev.sqlite3 suffix when mode is provided
  const filename =
    mode === "dev" ? `${version}.dev.sqlite3` : `${version}.sqlite3`;
  return `${dirName}/${filename}`;
};

/** Get a file handle for a versioned database (v2.1.0 flat structure). */
export const getDbHandleForVersion = async (
  baseDir: FileSystemDirectoryHandle,
  version: string,
  create: boolean,
  mode?: "release" | "dev",
): Promise<FileSystemFileHandle> => {
  if (version === DEFAULT_VERSION) {
    return await baseDir.getFileHandle("default.sqlite3", { create });
  }
  // v2.1.0: Use flat file naming {version}.sqlite3 instead of nested directories
  // For dev versions, use {version}.dev.sqlite3 suffix when mode is provided
  const versionFilename =
    mode === "dev" ? `${version}.dev.sqlite3` : `${version}.sqlite3`;
  return await baseDir.getFileHandle(versionFilename, { create });
};

/**
 * Check if a version string is a dev version (has .dev.sqlite3 suffix).
 * @param version - Version string with or without .sqlite3 suffix
 * @returns true if version is a dev version
 */
export const isDevVersion = (version: string): boolean => {
  return version.endsWith(".dev.sqlite3");
};
