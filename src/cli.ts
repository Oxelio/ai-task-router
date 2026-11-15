import { existsSync } from "node:fs";

import type { TaskInput, TaskMetrics } from "./domain.js";
import { JevTaskAnalyzer } from "./jev-analyzer.js";
import { chooseRoute } from "./routing-policy.js";
import { loadModelRegistry } from "./model-registry.js";
import { resolveModelRoute } from "./model-resolver.js";

function loadEnvFile(): void {
  if (!existsSync(".env")) {
    return;
  }

  process.loadEnvFile(".env");
}

function numberFlag(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function parseArguments(args: string[]): TaskInput {
  const metrics: TaskMetrics = {};
  const descriptionParts: string[] = [];

  for (const arg of args) {
    if (arg === "--security") {
      metrics.touchesSecurity = true;
    } else if (arg === "--auth") {
      metrics.touchesAuthentication = true;
    } else if (arg === "--permissions") {
      metrics.touchesPermissions = true;
    } else if (arg === "--database") {
      metrics.touchesDatabase = true;
    } else if (arg === "--migration") {
      metrics.touchesDatabase = true;
      metrics.hasDatabaseMigration = true;
    } else if (arg === "--public-api") {
      metrics.touchesPublicApi = true;
    } else if (arg === "--destructive") {
      metrics.destructiveOperation = true;
    } else if (arg.startsWith("--files=")) {
      metrics.filesTouched = numberFlag(arg.slice("--files=".length), "--files");
    } else if (arg.startsWith("--modules=")) {
      metrics.modulesTouched = numberFlag(
        arg.slice("--modules=".length),
        "--modules",
      );
    } else if (arg.startsWith("--tokens=")) {
      metrics.estimatedContextTokens = numberFlag(
        arg.slice("--tokens=".length),
        "--tokens",
      );
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      descriptionParts.push(arg);
    }
  }

  const description = descriptionParts.join(" ").trim();

  if (description.length === 0) {
    return {
      description:
        "Review a branch that changes authentication and permissions across several services, identify regressions and propose the safest fix.",
      metrics: {
        filesTouched: 12,
        modulesTouched: 3,
        estimatedContextTokens: 24_000,
        touchesAuthentication: true,
        touchesPermissions: true,
      },
    };
  }

  return { description, metrics };
}

function printHelp(): void {
  console.log(`
Jev task router demo

Usage:
  npm run dev -- "<task>" [options]

Options:
  --files=N         Number of files touched
  --modules=N       Number of modules/components touched
  --tokens=N        Estimated context tokens
  --database        Task touches persistence/database code
  --migration       Task includes a database migration
  --public-api      Task changes a public API
  --auth            Task touches authentication
  --permissions     Task touches permissions/authorization
  --security        Security-sensitive task
  --destructive     Potentially destructive operation

Examples:
  npm run dev -- "Write a conventional commit for this small diff" --files=1

  npm run dev -- "Review this refactor across the rendering subsystem" --files=8 --modules=2 --tokens=18000

  npm run dev -- "Investigate an intermittent permissions regression after a device command" --files=6 --modules=3 --permissions --auth
`);
}

async function main(): Promise<void> {
  loadEnvFile();

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error(
      "TYPESAFE_API_KEY is missing. Copy .env.example to .env and put your TypeSafe API key in it.",
    );
  }

  const input = parseArguments(process.argv.slice(2));
  const analyzer = new JevTaskAnalyzer();

  console.log("\nTask");
  console.log("----");
  console.log(input.description);

  console.log("\nMetrics");
  console.log("-------");
  console.log(JSON.stringify(input.metrics, null, 2));

  const assessment = await analyzer.analyze(input);
  const route = chooseRoute(input, assessment);
  const resolved = resolveModelRoute(route, loadModelRegistry());

  console.log("\nJev assessment");
  console.log("--------------");
  console.table({
    nature: {
      value: assessment.nature,
      confidence: assessment.confidence.nature.toFixed(3),
    },
    complexity: {
      value: assessment.complexity.toFixed(3),
      confidence: assessment.confidence.complexity.toFixed(3),
    },
    risk: {
      value: assessment.risk.toFixed(3),
      confidence: assessment.confidence.risk.toFixed(3),
    },
    ambiguity: {
      value: assessment.ambiguity.toFixed(3),
      confidence: assessment.confidence.ambiguity.toFixed(3),
    },
  });

  console.log(`Overall confidence: ${assessment.confidence.overall.toFixed(3)}`);
  console.log(`Jev model: ${assessment.jevModel}`);
  console.log(
    `Jev usage: ${assessment.inputTokens} input tokens / ${assessment.outputTokens} output tokens`,
  );

  console.log("\nRouting decision");
  console.log("----------------");
  console.log(`Minimum tier:   ${route.model}`);
  console.log(`Provider:       ${resolved.selectedModel.provider}`);
  console.log(`Exact model ID: ${resolved.selectedModel.modelId}`);
  console.log(`Version:        ${resolved.selectedModel.version}`);
  if (resolved.selectedModel.revision) {
    console.log(`Revision:       ${resolved.selectedModel.revision}`);
  }
  console.log(`Provider effort:${resolved.providerEffort}`);
  console.log(`Selected tier:  ${resolved.selectedModel.tier}`);
  console.log(`Tier escalated: ${resolved.tierEscalated ? "yes" : "no"}`);
  console.log(`Effort:         ${route.effort}`);
  console.log(`Scope:          ${route.scope}`);
  console.log(`Requires review:${route.requiresReview ? " yes" : " no"}`);

  console.log("\nReasons");
  console.log("-------");
  for (const reason of route.reasons) {
    console.log(`- ${reason}`);
  }

  console.log("\nRaw probability distributions");
  console.log("-----------------------------");
  console.dir(assessment.probabilities, { depth: null });
}

main().catch((error: unknown) => {
  console.error("\nError");
  console.error("-----");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
