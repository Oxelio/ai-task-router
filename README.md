# Jev Router Demo

Small TypeScript MVP that uses TypeSafe Jev to assess a software-development task and then applies a deterministic routing policy to recommend:

- minimum model tier: `luna | terra | sol | astra`
- concrete provider/model ID and version selected from `models.json`
- reasoning effort: `low | medium | high | xhigh | max | ultra`

The tier names are routing labels, not exact model identifiers. The project resolves a concrete model/version, but deliberately does **not** execute the selected OpenAI model.

## Requirements

- Node.js 20+
- a TypeSafe API key

## Install

```bash
npm install
```

Or with pnpm:

```bash
pnpm install
```

## Configure

Copy `.env.example` to `.env` and set:

```text
TYPESAFE_API_KEY=...
TYPESAFE_MODEL=jev-latest
```

## Execution model registry

Edit `models.json` or set `MODEL_REGISTRY_PATH` to an alternative JSON file. Each entry has a unique `id`, `provider`, exact API `modelId`, `version`, `tier`, and `effortMapping`. Optional fields are `revision` (for provider-exposed immutable snapshots), `enabled` and `priority` (lower values win within a tier).

The starter catalog uses published OpenAI model IDs (`gpt-6-luna`, `gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-astra`). **Effort mappings are operator-supplied examples, not verified provider capability claims**; confirm model access and supported reasoning parameters before connecting an execution API. The demo makes no execution-model API calls.

Resolution preserves the routing policy's minimum tier and effort. It chooses an enabled model in that tier (or escalates to a higher tier) only if an explicit effort mapping exists. Otherwise it fails clearly without silently downgrading. `max` and `ultra` are logical levels, not automatically provider-supported parameters: add mappings only when the execution layer can enforce them.

The analyzer is configured separately: `TYPESAFE_MODEL=kev:4b-q4_K_M` selects Kev for task assessment, **not** the OpenAI model that the router recommends.

## Run

```bash
npm run dev -- "Write a conventional commit for this tiny change" --files=1
```

```bash
npm run dev -- "Review an authentication refactor and identify regressions" --files=10 --modules=3 --auth --permissions
```

Running without a task uses a built-in example:

```bash
npm run dev
```

## Type-check

```bash
npm run typecheck
npm test
```

## Design

1. Objective metrics are supplied by code/CLI.
2. Jev independently evaluates task nature, complexity, risk, and ambiguity.
3. A deterministic routing policy combines these values.
4. Hard rules prevent risky tasks from being downgraded.
5. Low Jev confidence triggers conservative routing and review.

The thresholds are initial heuristics. They are meant to be calibrated later on a dataset of real tasks and outcomes.

## Upper reasoning tiers

The routing policy supports all six reasoning-effort labels:

```text
low < medium < high < xhigh < max < ultra
```

`max` and `ultra` are intentionally conservative in the initial policy. They are only selected for combinations of very high complexity, ambiguity, and risk. These thresholds are starter heuristics and should be calibrated from real routing outcomes.
