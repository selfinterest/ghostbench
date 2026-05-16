import { createHash } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepoSource } from "./types.js";

const execFileAsync = promisify(execFile);

export interface ResolvedRepoSource {
  localPath: string;
  sourceLabel: string;
  warnings: string[];
}

export async function resolveRepoSource(repoSource: RepoSource): Promise<ResolvedRepoSource> {
  if (repoSource.type === "local") {
    return {
      localPath: repoSource.path,
      sourceLabel: repoSource.path,
      warnings: [],
    };
  }

  validateGitHubUrl(repoSource.url);

  const cacheDir = repoCacheDir(repoSource.url, repoSource.ref);
  const sourceLabel = `${repoSource.url}${repoSource.ref ? `#${repoSource.ref}` : ""}`;

  await mkdir(path.dirname(cacheDir), { recursive: true });

  if (await exists(cacheDir)) {
    if (repoSource.ref) {
      await runGit(["-C", cacheDir, "fetch", "--depth=1", "origin", repoSource.ref]);
      await runGit(["-C", cacheDir, "checkout", "--detach", "FETCH_HEAD"]);
    } else {
      await runGit(["-C", cacheDir, "pull", "--ff-only"]);
    }
  } else {
    const cloneArgs = ["clone", "--depth=1"];
    if (repoSource.ref) {
      cloneArgs.push("--branch", repoSource.ref);
    }
    cloneArgs.push(repoSource.url, cacheDir);
    await runGit(cloneArgs);
  }

  const commitSha = (await runGit(["-C", cacheDir, "rev-parse", "HEAD"])).trim();

  return {
    localPath: cacheDir,
    sourceLabel: `${sourceLabel}@${commitSha.slice(0, 12)}`,
    warnings: [],
  };
}

function validateGitHubUrl(url: string): void {
  const isHttpsGitHub = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/i.test(url);
  const isSshGitHub = /^git@github\.com:[^/\s]+\/[^/\s]+(?:\.git)?$/i.test(url);
  if (!isHttpsGitHub && !isSshGitHub) {
    throw new Error(`repoUrl must be a GitHub repository URL: ${url}`);
  }
}

function repoCacheDir(url: string, ref: string | undefined): string {
  const cacheRoot = process.env.XDG_CACHE_HOME
    ? path.join(process.env.XDG_CACHE_HOME, "ghostbench", "repos")
    : path.join(os.homedir(), ".cache", "ghostbench", "repos");
  const hash = createHash("sha256").update(`${url}\n${ref ?? ""}`).digest("hex").slice(0, 16);
  const name = repoName(url);
  return path.join(cacheRoot, `${name}-${hash}`);
}

function repoName(url: string): string {
  const withoutGit = url.replace(/\.git$/i, "");
  const parts = withoutGit.split(/[/:]/).filter(Boolean);
  return sanitize(parts.at(-1) ?? "repo");
}

function sanitize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    if (isExecError(error)) {
      throw new Error(`git ${args.join(" ")} failed: ${error.stderr || error.message}`);
    }
    throw error;
  }
}

function isExecError(error: unknown): error is Error & { stderr?: string } {
  return error instanceof Error;
}
