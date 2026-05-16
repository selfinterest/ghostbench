import type { EvalCase, RepoContext, RepoFile } from "../types.js";

const MAX_PROMPT_CHARS = 80_000;
const MAX_FILE_CONTENT_CHARS = 8_000;
const MAX_FILE_LIST = 200;

export function buildAgentResponsePrompt(evalCase: EvalCase, repoContext: RepoContext): string {
  const header = [
    "You are generating an Agent Response for Ghostbench, a repo-understanding eval harness.",
    "",
    "Answer the user's repository task as a coding agent would before making changes.",
    "Be honest about uncertainty. Do not invent files, symbols, APIs, tests, or repository behavior.",
    "Ground your plan in the bounded repo context below. If context is missing or partial, say so.",
    "Keep the plan bounded to the task and call out important edge cases or verification steps.",
    "",
    `Eval case: ${evalCase.title}`,
    `Case id: ${evalCase.id}`,
    "",
    "Task:",
    evalCase.task,
    "",
    `Repo source: ${repoContext.repoSource}`,
    `Resolved repo path: ${repoContext.repoPath}`,
    `Repo context available: ${repoContext.exists ? "yes" : "no"}`,
    `Repo files scanned: ${repoContext.scannedFiles}/${repoContext.totalEligibleFiles}`,
    "",
    "Expected files or areas are advisory, not hidden gold labels:",
    ...(evalCase.expectedFiles.length > 0 ? evalCase.expectedFiles.map((file) => `- ${file}`) : ["- None provided."]),
    "",
    "Repo context file list:",
    ...repoContext.files.slice(0, MAX_FILE_LIST).map((file) => `- ${file.path}${file.truncated ? " (truncated by scanner)" : ""}`),
    "",
    "Included repo context excerpts:",
  ].join("\n");

  return addFileExcerpts(header, repoContext.files);
}

function addFileExcerpts(header: string, files: RepoFile[]): string {
  let prompt = header;
  let remaining = MAX_PROMPT_CHARS - prompt.length;

  if (files.length === 0) {
    return `${prompt}\n\nNo files were available in repo context.\n`;
  }

  for (const file of files) {
    if (remaining <= 0) {
      break;
    }

    const content = file.content.slice(0, Math.min(MAX_FILE_CONTENT_CHARS, Math.max(0, remaining - 200)));
    if (content.length === 0) {
      break;
    }

    const block = [
      "",
      `--- ${file.path}${file.truncated ? " (scanner truncated file)" : ""} ---`,
      "```",
      content,
      "```",
    ].join("\n");

    if (block.length > remaining) {
      prompt += `${block.slice(0, Math.max(0, remaining - 80))}\n...[prompt truncated]\n`;
      remaining = 0;
      break;
    }

    prompt += block;
    remaining = MAX_PROMPT_CHARS - prompt.length;
  }

  if (files.length > 0 && remaining <= 0) {
    prompt += "\n\nAdditional repo context omitted due to prompt size limits.\n";
  }

  return `${prompt}\n`;
}
