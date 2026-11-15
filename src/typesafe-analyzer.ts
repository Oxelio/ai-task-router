import { choice, score, TypeSafeClient } from "@typesafe-ai/sdk";

import type {
  TaskAssessment,
  TaskInput,
  TaskNature,
} from "./domain.js";
import type { TaskAnalyzer } from "./task-analyzer.js";

const QUESTIONS = {
  nature: choice(
    "What is the primary nature of this software-development task? Choose the single best category.",
    {
      classification:
        "Routing, categorizing, extracting, labeling, or transforming information without substantial implementation work.",
      documentation:
        "Writing or updating documentation, comments, release notes, or explanatory material.",
      routine_code:
        "A small, well-defined code change whose implementation is mostly mechanical or obvious.",
      feature:
        "Adding new software behavior or a new capability.",
      refactoring:
        "Changing internal code structure while intending to preserve externally observable behavior.",
      debugging:
        "Finding and fixing the cause of incorrect, unexpected, intermittent, or failing behavior.",
      code_review:
        "Reviewing existing code or a diff for correctness, regressions, design issues, security, or maintainability.",
      architecture:
        "Making structural design decisions involving boundaries, components, APIs, dependencies, data flow, or long-term trade-offs.",
      research:
        "Investigating an unfamiliar technical problem where the correct approach is not known up front.",
      other:
        "The task does not fit the other software-development categories well.",
    },
  ),

  complexity: score(
    "How much technical reasoning is required to complete this task correctly? Judge reasoning complexity, not merely the amount of text or code.",
    [
      "Mechanical or almost deterministic; little technical reasoning is needed.",
      "Limited reasoning; the approach is clear and localized.",
      "Several interacting concerns or non-trivial implementation choices must be considered.",
      "Complex reasoning across multiple components, constraints, or failure modes is required.",
      "Very difficult; deep investigation, novel reasoning, or many strongly interacting constraints are required.",
    ],
  ),

  risk: score(
    "How consequential would an incorrect solution be? Judge blast radius and reversibility, not difficulty.",
    [
      "Very low impact and easily reversible.",
      "Localized impact with straightforward recovery.",
      "Meaningful application impact; an error could cause regressions or wasted engineering time.",
      "High impact involving production behavior, public APIs, persistence, permissions, authentication, or important workflows.",
      "Critical impact involving security, destructive operations, data integrity, major infrastructure, or difficult recovery.",
    ],
  ),

  ambiguity: score(
    "How uncertain is the correct approach or diagnosis from the task description?",
    [
      "The required result and approach are explicit.",
      "Minor implementation choices exist, but the direction is clear.",
      "Multiple reasonable approaches or hypotheses exist.",
      "Important unknowns, competing hypotheses, or unclear requirements exist.",
      "The problem itself must first be discovered or framed before a solution can be chosen.",
    ],
  ),
} as const;

function toRecord(value: object): Record<string, number> {
  return Object.fromEntries(Object.entries(value)) as Record<string, number>;
}

export class TypeSafeTaskAnalyzer implements TaskAnalyzer {
  private readonly client: TypeSafeClient;

  public constructor() {
    this.client = new TypeSafeClient({
      defaultModel: process.env.TYPESAFE_MODEL ?? "jev-latest",
      logLevel: "off",
    });
  }

  public async analyze(input: TaskInput): Promise<TaskAssessment> {
    const response = await this.client.systemOne({
      state: {
        request: input.description,
        metrics: {
          files_touched: input.metrics.filesTouched ?? null,
          modules_touched: input.metrics.modulesTouched ?? null,
          estimated_context_tokens:
            input.metrics.estimatedContextTokens ?? null,
          touches_database: input.metrics.touchesDatabase ?? false,
          has_database_migration:
            input.metrics.hasDatabaseMigration ?? false,
          touches_public_api: input.metrics.touchesPublicApi ?? false,
          touches_authentication:
            input.metrics.touchesAuthentication ?? false,
          touches_permissions: input.metrics.touchesPermissions ?? false,
          touches_security: input.metrics.touchesSecurity ?? false,
          destructive_operation:
            input.metrics.destructiveOperation ?? false,
        },
      },
      questions: QUESTIONS,
    });

    const { nature, complexity, risk, ambiguity } = response.answers;
    const overallConfidence = Math.min(
      nature.confidence,
      complexity.confidence,
      risk.confidence,
      ambiguity.confidence,
    );

    return {
      nature: nature.choice as TaskNature,
      complexity: complexity.score,
      risk: risk.score,
      ambiguity: ambiguity.score,
      confidence: {
        nature: nature.confidence,
        complexity: complexity.confidence,
        risk: risk.confidence,
        ambiguity: ambiguity.confidence,
        overall: overallConfidence,
      },
      probabilities: {
        nature: toRecord(nature.probabilities),
        complexity: toRecord(complexity.probabilities),
        risk: toRecord(risk.probabilities),
        ambiguity: toRecord(ambiguity.probabilities),
      },
      analyzerModel: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
