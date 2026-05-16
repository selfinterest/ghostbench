#!/usr/bin/env node
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { githubRepoOverride, runCase } from "./runCase.js";
import { renderConsoleSummary } from "./report.js";

async function main(): Promise<void> {
  const [, , command, casePath, ...args] = process.argv;

  try {
    if (command === "run" || command === "compare") {
      if (!casePath) {
        throw new Error(`Usage: pnpm ghostbench ${command} <casePath>`);
      }
      const cliOptions = parseRunArgs(args);
      const result = await runCase(casePath, {
        mode: command,
        repoOverride: cliOptions.repoUrl ? githubRepoOverride(cliOptions.repoUrl, cliOptions.repoRef) : undefined,
      });
      console.log(renderConsoleSummary(result, command));
      return;
    }

    if (command === "init-case") {
      await initCase();
      return;
    }

    console.log(`Usage:
  pnpm ghostbench run <casePath> [--repo-url <url>] [--repo-ref <ref>]
  pnpm ghostbench compare <casePath> [--repo-url <url>] [--repo-ref <ref>]
  pnpm ghostbench init-case`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

interface CliRunOptions {
  repoUrl?: string;
  repoRef?: string;
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
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.repoRef && !options.repoUrl) {
    throw new Error("--repo-ref requires --repo-url");
  }

  return options;
}

async function initCase(): Promise<void> {
  const casesDir = path.resolve("cases");
  const target = path.join(casesDir, "new-case.json");
  await mkdir(casesDir, { recursive: true });

  try {
    await access(target);
    console.log(`Case already exists: ${path.relative(process.cwd(), target)}`);
    return;
  } catch {
    // File does not exist; create it below.
  }

  const template = {
    id: "new-case",
    title: "New repo-understanding eval case",
    repoPath: "../path-to-target-repo",
    task: "Describe the user-style repository task the agent should answer.",
    expectedFiles: ["src/relevant-area"],
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
        name: "Fixture response",
        fixturePath: "../fixtures/new-response.md",
      },
    ],
  };

  await writeFile(target, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  console.log(`Created ${path.relative(process.cwd(), target)}`);
}

void main();
