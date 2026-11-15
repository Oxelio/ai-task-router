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
  const registry = parseModelRegistry({ models: [
    { id: "luna-only-low", provider: "test", modelId: "luna", version: "1", tier: "luna", effortMapping: { low: "low" } },
    { id: "terra-high", provider: "test", modelId: "terra", version: "1", tier: "terra", effortMapping: { high: "high" } },
  ] });
  const resolved = resolveModelRoute(route("luna", "high"), registry);
  assert.equal(resolved.selectedModel.tier, "terra");
  assert.equal(resolved.providerEffort, "high");
  assert.equal(resolved.tierEscalated, true);
});

test("resolves documented max reasoning and rejects unsupported ultra", () => {
  const resolved = resolveModelRoute(route("astra", "max"), fixture);
  assert.equal(resolved.selectedModel.modelId, "gpt-6-astra");
  assert.equal(resolved.providerEffort, "max");
  assert.throws(() => resolveModelRoute(route("astra", "ultra"), fixture), /No enabled model/);
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

test("the catalog contains the documented GPT-5.6, GPT-6 and GPT-6.1 families", () => {
  const withNone = ["none", "low", "medium", "high", "xhigh", "max"];
  const withoutNone = ["low", "medium", "high", "xhigh", "max"];
  const expected: Record<string, string[]> = {
    "gpt-6-luna": withNone,
    "gpt-5.6-luna": withNone,
    "gpt-6.1-terra": withNone,
    "gpt-5.6-terra": withNone,
    "gpt-6.1-sol": withoutNone,
    "gpt-6-sol": withNone,
    "gpt-5.6-sol": withNone,
    "gpt-6-astra": withoutNone,
  };
  assert.equal(fixture.models.length, Object.keys(expected).length);
  for (const model of fixture.models) {
    assert.deepEqual(Object.keys(model.effortMapping), expected[model.modelId], model.modelId);
    for (const [effort, providerEffort] of Object.entries(model.effortMapping)) {
      assert.equal(providerEffort, effort, model.modelId);
    }
  }
});

test("prefers the current generation and falls back to an older model when required", () => {
  assert.equal(resolveModelRoute(route("luna", "max"), fixture).selectedModel.modelId, "gpt-6-luna");
  assert.equal(resolveModelRoute(route("terra", "none"), fixture).selectedModel.modelId, "gpt-6.1-terra");
  assert.equal(resolveModelRoute(route("sol", "none"), fixture).selectedModel.modelId, "gpt-6-sol");
  assert.equal(resolveModelRoute(route("sol", "high"), fixture).selectedModel.modelId, "gpt-6.1-sol");

  const olderOnly = parseModelRegistry({
    models: fixture.models.filter((model) => model.version === "5.6"),
  });
  assert.equal(resolveModelRoute(route("luna", "low"), olderOnly).selectedModel.modelId, "gpt-5.6-luna");
  assert.equal(resolveModelRoute(route("terra", "high"), olderOnly).selectedModel.modelId, "gpt-5.6-terra");
  assert.equal(resolveModelRoute(route("sol", "max"), olderOnly).selectedModel.modelId, "gpt-5.6-sol");
});
