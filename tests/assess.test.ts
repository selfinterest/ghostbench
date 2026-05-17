import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { averageDimensionScore, scoreDimensions } from "../src/assessScoring.js";
import { detectFrameworkSignals, readScriptInventory } from "../src/assessRuntime.js";
import { loadRepoContext } from "../src/loadRepoContext.js";
import { compareReadinessAssessments, hasReadinessRegression } from "../src/regression.js";
import type { ExecutionCheck, ReadinessAssessment, RepoContext } from "../src/types.js";

test("assessment helpers detect scripts, framework signals, and readiness evidence", () => {
  const repoContext: RepoContext = {
    repoPath: "/tmp/example",
    repoSource: "/tmp/example",
    exists: true,
    ignoreGlobs: [],
    totalEligibleFiles: 4,
    scannedFiles: 4,
    warnings: [],
    files: [
      {
        path: "package.json",
        extension: ".json",
        truncated: false,
        content: JSON.stringify({
          packageManager: "pnpm@11.1.2",
          scripts: { typecheck: "tsc --noEmit", build: "tsc", test: "node --test" },
          dependencies: { react: "latest" },
          devDependencies: { typescript: "latest", vite: "latest" },
        }),
      },
      { path: "README.md", extension: ".md", truncated: false, content: "Inventory Desk tracks reorder decisions." },
      { path: "src/main.tsx", extension: ".tsx", truncated: false, content: "export const loading = false;" },
      { path: "vite.config.ts", extension: ".ts", truncated: false, content: "export default {};" },
    ],
  };
  const executionChecks: ExecutionCheck[] = [
    { name: "typecheck", command: "pnpm run typecheck", status: "passed", output: "" },
    { name: "build", command: "pnpm run build", status: "passed", output: "" },
    { name: "test", command: "pnpm run test", status: "passed", output: "" },
  ];

  const inventory = readScriptInventory(repoContext);
  const frameworkSignals = detectFrameworkSignals(repoContext, inventory);
  const dimensions = scoreDimensions({
    repoContext,
    scriptInventory: inventory,
    frameworkSignals,
    executionChecks,
    appBrief: "Inventory Desk tracks low-stock items and reorder decisions.",
    expectedAreas: ["src", "reorder decisions"],
  });

  assert.equal(inventory.packageManager, "pnpm");
  assert.deepEqual(Object.keys(inventory.scripts), ["typecheck", "build", "test"]);
  assert.deepEqual(
    frameworkSignals.map((signal) => signal.name),
    ["Vite", "React", "TypeScript"],
  );
  assert.equal(dimensions.length, 6);
  assert.ok(averageDimensionScore(dimensions) > 6);
});

test("repo context respects case ignore globs", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "ghostbench-ignore-"));
  try {
    await mkdir(path.join(repoPath, "reports"));
    await mkdir(path.join(repoPath, "src"));
    await writeFile(path.join(repoPath, "reports", "biased-report.md"), "# Old generated report\n", "utf8");
    await writeFile(path.join(repoPath, "reports", "run.json"), "{}\n", "utf8");
    await writeFile(path.join(repoPath, "src", "main.ts"), "export const ready = true;\n", "utf8");

    const repoContext = await loadRepoContext(repoPath, repoPath, { ignoreGlobs: ["reports/**"] });

    assert.deepEqual(repoContext.ignoreGlobs, ["reports/**"]);
    assert.deepEqual(
      repoContext.files.map((file) => file.path),
      ["src/main.ts"],
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("readiness regression detects new concerns and dimension deltas", () => {
  const previous = assessmentFixture({
    score: 7.8,
    blockingConcerns: [],
    concerns: ["No README, AGENTS, CONTEXT, or docs files were found for future agent orientation."],
    dimensions: [
      dimensionFixture("runtime-health", "Runtime Health", 8, [], ["pnpm run build passed."]),
      dimensionFixture("agent-readiness", "Agent Readiness", 5, ["No README, AGENTS, CONTEXT, or docs files were found for future agent orientation."], []),
    ],
  });
  const current = assessmentFixture({
    score: 6.9,
    blockingConcerns: ["pnpm run build failed."],
    concerns: [
      "No README, AGENTS, CONTEXT, or docs files were found for future agent orientation.",
      "No obvious loading, empty, error, accessibility, or responsive-state handling was found.",
    ],
    dimensions: [
      dimensionFixture("runtime-health", "Runtime Health", 5, ["pnpm run build failed."], []),
      dimensionFixture("agent-readiness", "Agent Readiness", 6, [], ["Agent-readable documentation exists: README.md."]),
    ],
  });

  const regression = compareReadinessAssessments(previous, current, "reports/previous.json");

  assert.equal(regression.status, "regressed");
  assert.equal(regression.previousScore, 7.8);
  assert.equal(regression.currentScore, 6.9);
  assert.deepEqual(
    regression.newBlockingConcerns.map((concern) => concern.text),
    ["pnpm run build failed."],
  );
  assert.deepEqual(
    regression.newConcerns.map((concern) => concern.text),
    ["No obvious loading, empty, error, accessibility, or responsive-state handling was found."],
  );
  assert.deepEqual(
    regression.improved.map((item) => item.name),
    ["Agent Readiness"],
  );
  assert.deepEqual(
    regression.regressed.map((item) => item.name),
    ["Runtime Health"],
  );
  assert.equal(hasReadinessRegression(regression), true);
});

function dimensionFixture(
  id: ReadinessAssessment["dimensions"][number]["id"],
  name: string,
  score: number,
  concerns: string[],
  evidence: string[],
): ReadinessAssessment["dimensions"][number] {
  return { id, name, score, maxScore: 10, concerns, evidence };
}

function assessmentFixture(
  overrides: Pick<ReadinessAssessment, "score" | "blockingConcerns" | "concerns" | "dimensions">,
): ReadinessAssessment {
  return {
    id: "fixture-readiness",
    title: "Fixture readiness",
    repoPath: "/tmp/fixture",
    appBrief: "Fixture app",
    briefSource: "test",
    executionPolicy: "check",
    repoContext: {
      repoPath: "/tmp/fixture",
      repoSource: "/tmp/fixture",
      exists: true,
      ignoreGlobs: [],
      files: [],
      warnings: [],
      totalEligibleFiles: 0,
      scannedFiles: 0,
    },
    expectedAreas: [],
    frameworkSignals: [],
    scriptInventory: {
      packageManager: "pnpm",
      scripts: {},
      dependencies: [],
      devDependencies: [],
      warnings: [],
    },
    executionChecks: [],
    verdict: overrides.blockingConcerns.length > 0 ? "not-ready" : "conditionally-ready",
    evidence: [],
    remediationGuidance: [],
    warnings: [],
    reportPath: "reports/current.json",
    ...overrides,
  };
}
