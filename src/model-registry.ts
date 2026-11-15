import { readFileSync } from "node:fs";

import type { ReasoningEffort, RoutingModel } from "./domain.js";

const TIERS: readonly RoutingModel[] = ["luna", "terra", "sol", "astra"];
const EFFORTS: readonly ReasoningEffort[] = [
  "low", "medium", "high", "xhigh", "max", "ultra",
];

/** The effort map is explicit: an absent key means this model cannot serve that route. */
export interface ModelDefinition {
  id: string;
  provider: string;
  modelId: string;
  version: string;
  revision?: string;
  tier: RoutingModel;
  effortMapping: Partial<Record<ReasoningEffort, string>>;
  priority?: number;
  enabled?: boolean;
}

export interface ModelRegistry {
  models: ModelDefinition[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value;
}

export function parseModelRegistry(value: unknown): ModelRegistry {
  if (!record(value) || !Array.isArray(value.models) || value.models.length === 0) {
    throw new Error("Model registry must contain a non-empty models array.");
  }

  const ids = new Set<string>();
  const models = value.models.map((entry: unknown, index: number): ModelDefinition => {
    const field = `models[${index}]`;
    if (!record(entry)) {
      throw new Error(`${field} must be an object.`);
    }
    const id = requiredString(entry.id, `${field}.id`);
    if (ids.has(id)) {
      throw new Error(`Duplicate model id: ${id}.`);
    }
    ids.add(id);

    const provider = requiredString(entry.provider, `${field}.provider`);
    const modelId = requiredString(entry.modelId, `${field}.modelId`);
    const version = requiredString(entry.version, `${field}.version`);
    if (typeof entry.tier !== "string" || !TIERS.includes(entry.tier as RoutingModel)) {
      throw new Error(`${field}.tier must be luna, terra, sol, or astra.`);
    }
    const tier = entry.tier as RoutingModel;

    if (!record(entry.effortMapping) || Object.keys(entry.effortMapping).length === 0) {
      throw new Error(`${field}.effortMapping must contain at least one supported effort.`);
    }
    const effortMapping: Partial<Record<ReasoningEffort, string>> = {};
    for (const [effort, mapping] of Object.entries(entry.effortMapping)) {
      if (!EFFORTS.includes(effort as ReasoningEffort)) {
        throw new Error(`${field}.effortMapping has unknown effort: ${effort}.`);
      }
      effortMapping[effort as ReasoningEffort] = requiredString(
        mapping, `${field}.effortMapping.${effort}`,
      );
    }

    if (entry.priority !== undefined && (!Number.isInteger(entry.priority) || (entry.priority as number) < 0)) {
      throw new Error(`${field}.priority must be a non-negative integer.`);
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
      throw new Error(`${field}.enabled must be a boolean.`);
    }

    const model: ModelDefinition = { id, provider, modelId, version, tier, effortMapping };
    if (entry.revision !== undefined) {
      model.revision = requiredString(entry.revision, `${field}.revision`);
    }
    if (entry.priority !== undefined) model.priority = entry.priority as number;
    if (entry.enabled !== undefined) model.enabled = entry.enabled as boolean;
    return model;
  });
  return { models };
}

export function loadModelRegistry(
  path = process.env.MODEL_REGISTRY_PATH ?? "models.json",
): ModelRegistry {
  return parseModelRegistry(JSON.parse(readFileSync(path, "utf8")) as unknown);
}
