import type { TaskAssessment, TaskInput } from "./domain.js";

/** Contract for task-analysis backends (TypeSafe, local inference, or future providers). */
export interface TaskAnalyzer {
  analyze(input: TaskInput): Promise<TaskAssessment>;
}
