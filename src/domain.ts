export type TaskNature =
  | "classification"
  | "documentation"
  | "routine_code"
  | "feature"
  | "refactoring"
  | "debugging"
  | "code_review"
  | "architecture"
  | "research"
  | "other";

export type RoutingModel = "luna" | "terra" | "sol" | "astra";
export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";
export type Scope = "unknown" | "small" | "medium" | "large";

export interface TaskMetrics {
  filesTouched?: number;
  modulesTouched?: number;
  estimatedContextTokens?: number;

  touchesDatabase?: boolean;
  hasDatabaseMigration?: boolean;
  touchesPublicApi?: boolean;
  touchesAuthentication?: boolean;
  touchesPermissions?: boolean;
  touchesSecurity?: boolean;
  destructiveOperation?: boolean;
}

export interface TaskInput {
  description: string;
  metrics: TaskMetrics;
}

export interface TaskAssessment {
  nature: TaskNature;
  complexity: number;
  risk: number;
  ambiguity: number;

  confidence: {
    nature: number;
    complexity: number;
    risk: number;
    ambiguity: number;
    overall: number;
  };

  probabilities: {
    nature: Record<string, number>;
    complexity: Record<string, number>;
    risk: Record<string, number>;
    ambiguity: Record<string, number>;
  };

  jevModel: string;
  inputTokens: number;
  outputTokens: number;
}

export interface RouteDecision {
  model: RoutingModel;
  effort: ReasoningEffort;
  scope: Scope;
  requiresReview: boolean;
  reasons: string[];
}
