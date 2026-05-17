import test from "node:test";
import assert from "node:assert/strict";
import { averageDimensionScore, scoreDimensions } from "../src/assessScoring.js";
import { detectFrameworkSignals, readScriptInventory } from "../src/assessRuntime.js";
import type { ExecutionCheck, RepoContext } from "../src/types.js";

test("assessment helpers detect scripts, framework signals, and readiness evidence", () => {
  const repoContext: RepoContext = {
    repoPath: "/tmp/example",
    repoSource: "/tmp/example",
    exists: true,
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
