import assert from "node:assert/strict";
import test from "node:test";

import type { TaskAssessment, TaskInput } from "./domain.js";
import type { TaskAnalyzer } from "./task-analyzer.js";
import { chooseRoute } from "./routing-policy.js";

test("routing depends on the generic task analyzer contract", async () => {
  const input: TaskInput = {
    description: "Write a short commit message",
    metrics: { filesTouched: 1 },
  };

  const assessment: TaskAssessment = {
    nature: "documentation",
    complexity: 0.1,
    risk: 0.1,
    ambiguity: 0.1,
    confidence: {
      nature: 0.99,
      complexity: 0.99,
      risk: 0.99,
      ambiguity: 0.99,
      overall: 0.99,
    },
    probabilities: { nature: {}, complexity: {}, risk: {}, ambiguity: {} },
    analyzerModel: "test/fake-analyzer-v1",
    inputTokens: 0,
    outputTokens: 0,
  };

  const analyzer: TaskAnalyzer = {
    async analyze() {
      return assessment;
    },
  };

  const result = await analyzer.analyze(input);
  assert.equal(result.analyzerModel, "test/fake-analyzer-v1");
  const route = chooseRoute(input, result);
  assert.equal(route.model, "luna");
  assert.equal(route.effort, "low");
  assert.equal(route.requiresReview, false);
});

test("existing hard security constraints remain effective for any analyzer", async () => {
  const input: TaskInput = {
    description: "Review authentication permissions",
    metrics: { filesTouched: 10, touchesAuthentication: true, touchesPermissions: true },
  };
  const analyzer: TaskAnalyzer = {
    async analyze() {
      return {
        nature: "code_review",
        complexity: 0,
        risk: 0,
        ambiguity: 0,
        confidence: { nature: 1, complexity: 1, risk: 1, ambiguity: 1, overall: 1 },
        probabilities: { nature: {}, complexity: {}, risk: {}, ambiguity: {} },
        analyzerModel: "test/fake-analyzer",
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
  const route = chooseRoute(input, await analyzer.analyze(input));
  assert.equal(route.model, "sol");
  assert.equal(route.effort, "high");
  assert.equal(route.requiresReview, true);
});
