import type { RouteDecision, RoutingModel } from "./domain.js";
import type { ModelDefinition, ModelRegistry } from "./model-registry.js";

const TIER_RANK: Record<RoutingModel, number> = {
  luna: 0,
  terra: 1,
  sol: 2,
  astra: 3,
};

export interface ResolvedRoute {
  route: RouteDecision;
  selectedModel: ModelDefinition;
  /** Provider-side effort setting; not the same as the router's logical effort. */
  providerEffort: string;
  tierEscalated: boolean;
}

/** Resolve an exact model without relaxing the routing policy's minimum tier/effort. */
export function resolveModelRoute(
  route: RouteDecision,
  registry: ModelRegistry,
): ResolvedRoute {
  const candidates = registry.models
    .filter((model) =>
      model.enabled !== false &&
      TIER_RANK[model.tier] >= TIER_RANK[route.model] &&
      Object.hasOwn(model.effortMapping, route.effort),
    )
    .sort((a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      (a.priority ?? 100) - (b.priority ?? 100) ||
      a.id.localeCompare(b.id),
    );

  const selectedModel = candidates[0];
  if (!selectedModel) {
    throw new Error(
      `No enabled model can satisfy minimum tier ${route.model} with effort ${route.effort}. ` +
      "Update models.json (or MODEL_REGISTRY_PATH); the router will not silently downgrade.",
    );
  }

  // Guaranteed by the hasOwn check; registry validation requires non-empty values.
  const providerEffort = selectedModel.effortMapping[route.effort];
  if (providerEffort === undefined) {
    throw new Error(`Missing effort mapping for ${selectedModel.id}/${route.effort}.`);
  }
  return {
    route,
    selectedModel,
    providerEffort,
    tierEscalated: selectedModel.tier !== route.model,
  };
}
