import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { minimatch } from "minimatch";
import type { RepoContext, RepoFile } from "./types.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "vendor"]);
const INCLUDED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".css",
  ".html",
  ".lua",
  ".xml",
  ".yaml",
  ".yml",
]);
const INCLUDED_FILENAMES = new Set([
  ".env",
  ".env.example",
  ".env.local",
  "readme",
  "license",
  "licence",
  "copying",
  "changelog",
  "authors",
  "contributors",
]);
const MAX_FILES = 200;
const MAX_BYTES_PER_FILE = 20 * 1024;

export interface LoadRepoContextOptions {
  ignoreGlobs?: string[];
}

export async function loadRepoContext(
  repoPath: string,
  sourceLabel = repoPath,
  options: LoadRepoContextOptions = {},
): Promise<RepoContext> {
  const warnings: string[] = [];
  const resolvedRepoPath = path.resolve(repoPath);
  const ignoreGlobs = options.ignoreGlobs ?? [];

  try {
    const repoStat = await stat(resolvedRepoPath);
    if (!repoStat.isDirectory()) {
      return emptyContext(resolvedRepoPath, sourceLabel, ignoreGlobs, [`Repo path is not a directory: ${resolvedRepoPath}`]);
    }
  } catch {
    return emptyContext(resolvedRepoPath, sourceLabel, ignoreGlobs, [`Repo path does not exist: ${resolvedRepoPath}`]);
  }

  const eligibleFiles = await collectEligibleFiles(resolvedRepoPath, ignoreGlobs, warnings);
  const selectedFiles = eligibleFiles.slice(0, MAX_FILES);

  if (eligibleFiles.length > MAX_FILES) {
    warnings.push(`Repo context scanned ${MAX_FILES} of ${eligibleFiles.length} eligible files.`);
  }

  const files: RepoFile[] = [];
  for (const absolutePath of selectedFiles) {
    const relativePath = path.relative(resolvedRepoPath, absolutePath);
    const buffer = await readFile(absolutePath);
    const truncated = buffer.byteLength > MAX_BYTES_PER_FILE;
    files.push({
      path: normalizePath(relativePath),
      extension: path.extname(absolutePath),
      content: buffer.subarray(0, MAX_BYTES_PER_FILE).toString("utf8"),
      truncated,
    });
    if (truncated) {
      warnings.push(`Truncated ${normalizePath(relativePath)} to ${MAX_BYTES_PER_FILE} bytes.`);
    }
  }

  return {
    repoPath: resolvedRepoPath,
    repoSource: sourceLabel,
    exists: true,
    ignoreGlobs,
    files,
    warnings,
    totalEligibleFiles: eligibleFiles.length,
    scannedFiles: files.length,
  };
}

async function collectEligibleFiles(repoPath: string, ignoreGlobs: string[], warnings: string[]): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      warnings.push(`Could not read directory: ${directory}`);
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = normalizePath(path.relative(repoPath, fullPath));
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !isIgnoredPath(relativePath, true, ignoreGlobs)) {
          await walk(fullPath);
        }
        continue;
      }

      if (entry.isFile() && isIncludedFile(entry.name) && !isIgnoredPath(relativePath, false, ignoreGlobs)) {
        files.push(fullPath);
      }
    }
  }

  await walk(repoPath);
  return files.sort();
}

function isIncludedFile(fileName: string): boolean {
  return INCLUDED_EXTENSIONS.has(path.extname(fileName)) || INCLUDED_FILENAMES.has(fileName.toLowerCase());
}

function isIgnoredPath(relativePath: string, isDirectory: boolean, ignoreGlobs: string[]): boolean {
  return ignoreGlobs.some((glob) => {
    const normalizedGlob = normalizePath(glob).replace(/^\.?\//, "");
    return (
      minimatch(relativePath, normalizedGlob, { dot: true }) ||
      (isDirectory && minimatch(`${relativePath}/`, normalizedGlob, { dot: true }))
    );
  });
}

function emptyContext(repoPath: string, repoSource: string, ignoreGlobs: string[], warnings: string[]): RepoContext {
  return {
    repoPath,
    repoSource,
    exists: false,
    ignoreGlobs,
    files: [],
    warnings,
    totalEligibleFiles: 0,
    scannedFiles: 0,
  };
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
