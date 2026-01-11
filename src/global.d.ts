/**
 * Global type declarations for web-sqlite-js
 */

/**
 * Extend FileSystemDirectoryHandle with async iterator support
 * The `values()` method returns an async iterator of directory entries
 */
interface FileSystemDirectoryHandle {
  /**
   * Returns an async iterator for the entries in the directory
   * @returns Async iterator of FileSystemHandle objects
   */
  values(): AsyncIterable<FileSystemHandle>;
}
