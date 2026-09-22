import type {
  ReasoningEffort,
  RouteDecision,
  RoutingModel,
  Scope,
  TaskAssessment,
  TaskInput,
} from "./domain.js";

const MODEL_RANK: Record<RoutingModel, number> = {
  luna: 0,
  terra: 1,
  sol: 2,
  astra: 3,
};

const EFFORT_RANK: Record<ReasoningEffort, number> = {
  low: 0,
  medium: 1,
  high: 2,
  xhigh: 3,
};

function maxModel(a: RoutingModel, b: RoutingModel): RoutingModel {
  return MODEL_RANK[a] >= MODEL_RANK[b] ? a : b;
}

function maxEffort(
  a: ReasoningEffort,
  b: ReasoningEffort,
): ReasoningEffort {
  return EFFORT_RANK[a] >= EFFORT_RANK[b] ? a : b;
}

export function computeScope(input: TaskInput): Scope {
  const { filesTouched, modulesTouched, estimatedContextTokens } = input.metrics;

  if (
    filesTouched === undefined &&
    modulesTouched === undefined &&
    estimatedContextTokens === undefined
  ) {
    return "unknown";
  }

  if (
    (filesTouched ?? 0) >= 15 ||
    (modulesTouched ?? 0) >= 4 ||
    (estimatedContextTokens ?? 0) >= 40_000
  ) {
    return "large";
  }

  if (
    (filesTouched ?? 0) >= 4 ||
    (modulesTouched ?? 0) >= 2 ||
    (estimatedContextTokens ?? 0) >= 12_000
  ) {
    return "medium";
  }

  return "small";
}

export function chooseRoute(
  input: TaskInput,
  assessment: TaskAssessment,
): RouteDecision {
  const scope = computeScope(input);
  const reasons: string[] = [];
  let requiresReview = false;

  let model: RoutingModel;
  let effort: ReasoningEffort;

  switch (assessment.nature) {
    case "classification":
    case "documentation":
    case "routine_code":
      model = "luna";
      effort = "low";
      reasons.push(`Base route for ${assessment.nature}: Luna/low.`);
      break;

    case "feature":
    case "refactoring":
    case "debugging":
    case "code_review":
      model = "terra";
      effort = "medium";
      reasons.push(`Base route for ${assessment.nature}: Terra/medium.`);
      break;

    case "architecture":
    case "research":
      model = "sol";
      effort = "medium";
      reasons.push(`Base route for ${assessment.nature}: Sol/medium.`);
      break;

    case "other":
      model = "terra";
      effort = "medium";
      reasons.push("Unclassified task: conservative Terra/medium baseline.");
      break;
  }

  // Complexity controls both capability and reasoning depth.
  if (assessment.complexity >= 3.6) {
    model = maxModel(model, "sol");
    effort = maxEffort(effort, "high");
    reasons.push(
      `Very high complexity (${assessment.complexity.toFixed(2)}): minimum Sol/high.`,
    );
  } else if (assessment.complexity >= 2.5) {
    model = maxModel(model, "sol");
    effort = maxEffort(effort, "medium");
    reasons.push(
      `High complexity (${assessment.complexity.toFixed(2)}): minimum Sol/medium.`,
    );
  } else if (assessment.complexity >= 1.5) {
    model = maxModel(model, "terra");
    effort = maxEffort(effort, "medium");
    reasons.push(
      `Moderate complexity (${assessment.complexity.toFixed(2)}): minimum Terra/medium.`,
    );
  }

  // Ambiguity mostly increases reasoning effort. Extreme ambiguity can justify Astra.
  if (assessment.ambiguity >= 3.6) {
    effort = maxEffort(effort, "xhigh");
    reasons.push(
      `Very high ambiguity (${assessment.ambiguity.toFixed(2)}): xhigh reasoning.`,
    );
  } else if (assessment.ambiguity >= 2.5) {
    effort = maxEffort(effort, "high");
    reasons.push(
      `High ambiguity (${assessment.ambiguity.toFixed(2)}): high reasoning.`,
    );
  }

  // Risk raises the minimum capability and effort.
  if (assessment.risk >= 3.5) {
    model = maxModel(model, "sol");
    effort = maxEffort(effort, "high");
    requiresReview = true;
    reasons.push(
      `Very high risk (${assessment.risk.toFixed(2)}): minimum Sol/high plus review.`,
    );
  } else if (assessment.risk >= 2.5) {
    model = maxModel(model, "sol");
    effort = maxEffort(effort, "medium");
    reasons.push(
      `High risk (${assessment.risk.toFixed(2)}): minimum Sol/medium.`,
    );
  }

  // Objective scope should come from code/repository metrics rather than Jev.
  if (scope === "large") {
    model = maxModel(model, "sol");
    effort = maxEffort(effort, "medium");
    reasons.push("Large measured scope: minimum Sol/medium.");
  } else if (scope === "medium") {
    model = maxModel(model, "terra");
    reasons.push("Medium measured scope: minimum Terra.");
  }

  // Hard rules: semantic classification must never be allowed to downgrade these.
  const m = input.metrics;

  if (
    m.touchesSecurity ||
    m.touchesAuthentication ||
    m.touchesPermissions ||
    m.destructiveOperation ||
    m.hasDatabaseMigration
  ) {
    model = maxModel(model, "sol");
    effort = maxEffort(effort, "high");
    requiresReview = true;
    reasons.push(
      "Hard rule triggered (security/auth/permissions/destructive/database migration): minimum Sol/high plus review.",
    );
  }

  if (m.touchesPublicApi || m.touchesDatabase) {
    model = maxModel(model, "terra");
    effort = maxEffort(effort, "medium");
    reasons.push(
      "Public API or database impact: minimum Terra/medium.",
    );
  }

  // Astra is reserved for genuinely difficult combinations, not merely large tasks.
  if (
    assessment.complexity >= 3.6 &&
    (assessment.ambiguity >= 3.2 || assessment.risk >= 3.2)
  ) {
    model = "astra";
    effort = maxEffort(effort, "high");
    reasons.push(
      "Combined very high complexity with high ambiguity/risk: escalate to Astra.",
    );
  }

  // Confidence gate. This is OUR policy, not a TypeSafe-prescribed threshold.
  if (assessment.confidence.overall < 0.45) {
    model = maxModel(model, "sol");
    effort = maxEffort(effort, "high");
    requiresReview = true;
    reasons.push(
      `Low Jev confidence (${assessment.confidence.overall.toFixed(2)}): conservative Sol/high fallback plus review.`,
    );
  } else if (assessment.confidence.overall < 0.65) {
    model = maxModel(model, "terra");
    effort = maxEffort(effort, "medium");
    requiresReview = true;
    reasons.push(
      `Moderate Jev confidence (${assessment.confidence.overall.toFixed(2)}): no aggressive downgrade; flag for review.`,
    );
  }

  return {
    model,
    effort,
    scope,
    requiresReview,
    reasons,
  };
}
