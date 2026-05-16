#!/usr/bin/env node
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { githubRepoOverride, runCase } from "./runCase.js";
import { loadRepoContext } from "./loadRepoContext.js";
import { renderConsoleSummary } from "./report.js";
import { resolveRepoSource } from "./resolveRepoSource.js";

async function main(): Promise<void> {
  const [, , command, ...commandArgs] = process.argv;

  try {
    if (command === "run" || command === "compare") {
      const [casePath, ...args] = commandArgs;
      if (!casePath) {
        throw new Error(`Usage: pnpm ghostbench ${command} <casePath>`);
      }
      const cliOptions = parseRunArgs(args);
      const result = await runCase(casePath, {
        mode: command,
        repoOverride: cliOptions.repoUrl ? githubRepoOverride(cliOptions.repoUrl, cliOptions.repoRef) : undefined,
        provider: cliOptions.provider && cliOptions.model ? { provider: cliOptions.provider, model: cliOptions.model } : undefined,
      });
      console.log(renderConsoleSummary(result, command));
      return;
    }

    if (command === "init-case") {
      await initCase(commandArgs);
      return;
    }

    console.log(`Usage:
  pnpm ghostbench run <casePath> [--repo-url <url>] [--repo-ref <ref>]
  pnpm ghostbench run <casePath> [--provider openai --model <model>]
  pnpm ghostbench compare <casePath> [--repo-url <url>] [--repo-ref <ref>]
  pnpm ghostbench compare <casePath> [--provider openai --model <model>]
  pnpm ghostbench init-case [--repo-url <url>] [--repo-ref <ref>] [--id <slug>] [--title <title>]`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

interface CliRunOptions {
  repoUrl?: string;
  repoRef?: string;
  provider?: "openai";
  model?: string;
}

function parseRunArgs(args: string[]): CliRunOptions {
  const options: CliRunOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--repo-url") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--repo-url requires a value");
      }
      options.repoUrl = value;
      index += 1;
      continue;
    }
    if (arg === "--repo-ref") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--repo-ref requires a value");
      }
      options.repoRef = value;
      index += 1;
      continue;
    }
    if (arg === "--provider") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--provider requires a value");
      }
      if (value !== "openai") {
        throw new Error(`Unsupported provider: ${value}`);
      }
      options.provider = value;
      index += 1;
      continue;
    }
    if (arg === "--model") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--model requires a value");
      }
      options.model = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.repoRef && !options.repoUrl) {
    throw new Error("--repo-ref requires --repo-url");
  }
  if (options.provider && !options.model) {
    throw new Error("--provider openai requires --model <model>");
  }
  if (options.model && !options.provider) {
    throw new Error("--model requires --provider openai");
  }

  return options;
}

interface InitCaseOptions extends CliRunOptions {
  id: string;
  title: string;
}

function parseInitArgs(args: string[]): InitCaseOptions {
  const options: InitCaseOptions = {
    id: "new-case",
    title: "New repo-understanding eval case",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--repo-url") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--repo-url requires a value");
      }
      options.repoUrl = value;
      index += 1;
      continue;
    }
    if (arg === "--repo-ref") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--repo-ref requires a value");
      }
      options.repoRef = value;
      index += 1;
      continue;
    }
    if (arg === "--id") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--id requires a value");
      }
      options.id = slugify(value);
      index += 1;
      continue;
    }
    if (arg === "--title") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--title requires a value");
      }
      options.title = value;
      if (options.id === "new-case") {
        options.id = slugify(value);
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.repoRef && !options.repoUrl) {
    throw new Error("--repo-ref requires --repo-url");
  }

  return options;
}

async function initCase(args: string[]): Promise<void> {
  const options = parseInitArgs(args);
  const casesDir = path.resolve("cases");
  const fixturesDir = path.resolve("fixtures");
  const target = path.join(casesDir, `${options.id}.json`);
  await mkdir(casesDir, { recursive: true });
  await mkdir(fixturesDir, { recursive: true });

  try {
    await access(target);
    console.log(`Case already exists: ${path.relative(process.cwd(), target)}`);
    return;
  } catch {
    // File does not exist; create it below.
  }

  const expectedFiles = options.repoUrl ? await suggestExpectedFiles(options.repoUrl, options.repoRef) : ["src/relevant-area"];
  const groundedFixturePath = path.join(fixturesDir, `${options.id}-grounded-response.md`);
  const genericFixturePath = path.join(fixturesDir, `${options.id}-generic-response.md`);

  const template = {
    id: options.id,
    title: options.title,
    ...(options.repoUrl
      ? {
          repoUrl: options.repoUrl,
          ...(options.repoRef ? { repoRef: options.repoRef } : {}),
        }
      : {
          repoPath: "../path-to-target-repo",
        }),
    task: "Describe the user-style repository task the agent should answer.",
    expectedFiles,
    rubric: [
      {
        id: "grounded-repo-understanding",
        description: "Identifies task-relevant files, symbols, or repository areas without inventing unsupported details",
        weight: 3,
      },
      {
        id: "bounded-plan",
        description: "Proposes a bounded implementation or investigation plan that fits the requested task",
        weight: 2,
      },
      {
        id: "edge-cases",
        description: "Names important edge cases, risks, or constraints that affect the task",
        weight: 1,
      },
    ],
    responses: [
      {
        name: "Grounded response",
        fixturePath: `../fixtures/${path.basename(groundedFixturePath)}`,
      },
      {
        name: "Generic response",
        fixturePath: `../fixtures/${path.basename(genericFixturePath)}`,
      },
    ],
  };

  await writeFile(target, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  await writeFixtureIfMissing(
    groundedFixturePath,
    `Draft a grounded agent response for ${options.title}.

Reference real files, directories, commands, or constraints from the target repository. State uncertainty when repo context is incomplete, and keep the plan bounded to the task.
`,
  );
  await writeFixtureIfMissing(
    genericFixturePath,
    `Draft a weak or generic agent response for ${options.title}.

This fixture should intentionally miss repo-specific grounding, overreach, invent details, or ignore important constraints so Ghostbench can compare it against the grounded response.
`,
  );
  console.log(`Created ${path.relative(process.cwd(), target)}`);
  console.log(`Created ${path.relative(process.cwd(), groundedFixturePath)}`);
  console.log(`Created ${path.relative(process.cwd(), genericFixturePath)}`);
}

async function suggestExpectedFiles(repoUrl: string, repoRef: string | undefined): Promise<string[]> {
  const resolved = await resolveRepoSource(githubRepoOverride(repoUrl, repoRef));
  const repoContext = await loadRepoContext(resolved.localPath, resolved.sourceLabel);
  const preferred = repoContext.files
    .map((file) => file.path)
    .filter((filePath) => /^(README|CONTRIBUTING|AGENTS|CONTEXT|package\.json|src\/|docs\/)/i.test(filePath))
    .slice(0, 6);

  return preferred.length > 0 ? preferred : repoContext.files.slice(0, 6).map((file) => file.path);
}

async function writeFixtureIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await access(filePath);
    return;
  } catch {
    await writeFile(filePath, content, "utf8");
  }
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "new-case";
}

void main();
