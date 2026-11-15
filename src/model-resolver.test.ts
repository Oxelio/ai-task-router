import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { RouteDecision } from "./domain.js";
import { parseModelRegistry } from "./model-registry.js";
import { resolveModelRoute } from "./model-resolver.js";

const fixture = parseModelRegistry(JSON.parse(readFileSync("models.json", "utf8")) as unknown);

function route(model: RouteDecision["model"], effort: RouteDecision["effort"]): RouteDecision {
  return { model, effort, scope: "small", requiresReview: false, reasons: [] };
}

test("resolves concrete model and version for each ordinary tier", () => {
  assert.deepEqual(
    [route("luna", "low"), route("terra", "medium"), route("sol", "high"), route("astra", "xhigh")]
      .map((decision) => resolveModelRoute(decision, fixture).selectedModel.modelId),
    ["gpt-6-luna", "gpt-6.1-terra", "gpt-6.1-sol", "gpt-6-astra"],
  );
  assert.equal(resolveModelRoute(route("sol", "high"), fixture).selectedModel.version, "6.1");
});

test("escalates tier rather than silently lowering the requested effort", () => {
  const resolved = resolveModelRoute(route("luna", "high"), fixture);
  assert.equal(resolved.selectedModel.tier, "terra");
  assert.equal(resolved.providerEffort, "high");
  assert.equal(resolved.tierEscalated, true);
});

test("fails closed when max or ultra has no explicitly configured mapping", () => {
  for (const effort of ["max", "ultra"] as const) {
    assert.throws(() => resolveModelRoute(route("astra", effort), fixture), /No enabled model/);
  }
});

test("respects enabled models and priority within the eligible tier", () => {
  const registry = parseModelRegistry({ models: [
    { id: "disabled", provider: "test", modelId: "disabled", version: "1", tier: "sol", enabled: false, priority: 0, effortMapping: { high: "high" } },
    { id: "slow", provider: "test", modelId: "slow", version: "1", tier: "sol", priority: 20, effortMapping: { high: "high" } },
    { id: "preferred", provider: "test", modelId: "preferred", version: "2", tier: "sol", priority: 10, effortMapping: { high: "custom-high" } },
  ] });
  const selected = resolveModelRoute(route("sol", "high"), registry);
  assert.equal(selected.selectedModel.modelId, "preferred");
  assert.equal(selected.providerEffort, "custom-high");
});

test("rejects duplicate IDs and invalid effort declarations", () => {
  const sample = { id: "same", provider: "test", modelId: "model", version: "1", tier: "luna", effortMapping: { low: "low" } };
  assert.throws(() => parseModelRegistry({ models: [sample, sample] }), /Duplicate model id/);
  assert.throws(() => parseModelRegistry({ models: [{ ...sample, effortMapping: { bogus: "low" } }] }), /unknown effort/);
  assert.throws(() => parseModelRegistry({ models: [{ ...sample, effortMapping: {} }] }), /at least one/);
});
