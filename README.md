# AI Task Router

AI-powered task router that analyzes software engineering requests and selects an LLM, model version, and reasoning effort using configurable policies.

A TypeScript MVP that assesses a software-development task with a configurable analyzer (TypeSafe Jev or local Kev via an Ollama-compatible API) and then applies a deterministic routing policy to recommend:

- minimum model tier: `luna | terra | sol | astra`
- concrete provider/model ID and version selected from `models.json`
- reasoning effort: `low | medium | high | xhigh | max | ultra` (`none` is also represented for models that support it)

The tier names are routing labels, not exact model identifiers. The project resolves a concrete model/version, but deliberately does **not** execute the selected OpenAI model.

## Requirements

- Node.js 20+
- a TypeSafe API key when using the hosted API, or Ollama with Kev for local analysis

## Install

This project uses pnpm and commits `pnpm-lock.yaml`. Avoid mixing npm and pnpm in the same `node_modules` directory.

```bash
pnpm install --frozen-lockfile
```

## Configure

Copy `.env.example` to `.env`. Choose one analysis backend:

Hosted TypeSafe / Jev:
```text
TYPESAFE_API_KEY=<your-api-key>
TYPESAFE_MODEL=jev-latest
```

Local Kev / Ollama (tested by the project user on Windows):
```text
TYPESAFE_API_KEY=local
TYPESAFE_BASE_URL=http://127.0.0.1:11434
TYPESAFE_MODEL=kev:4b-q4_K_M
```

Keep the Ollama model downloaded locally (`ollama pull kev:4b-q4_K_M`). Environment variables already set in PowerShell can override the file's values depending on the runtime configuration.

## Execution model registry

Edit `models.json` or set `MODEL_REGISTRY_PATH` to an alternative JSON file. Each entry has a unique `id`, `provider`, exact API `modelId`, `version`, `tier`, and `effortMapping`. Optional fields are `revision` (for provider-exposed immutable snapshots), `enabled` and `priority` (lower values win within a tier).

The catalog includes eight **documented OpenAI API model IDs**: GPT-6 Luna, GPT-6.1 Terra, GPT-6 Sol, GPT-6.1 Sol, GPT-6 Astra, and the GPT-5.6 Luna/Terra/Sol variants. Their `effortMapping` entries match the reasoning efforts described in the official model documentation as of 2026-11-15. GPT-6.1 Sol and GPT-6 Astra do not support `none`. All eight models support `max`. See [OpenAI model catalog](https://developers.openai.com/api/docs/models) and the individual model pages under `https://developers.openai.com/api/docs/models/<modelId>`.

Current-generation models have priority `0`, GPT-6 Sol has priority `50` behind GPT-6.1 Sol, and the GPT-5.6 models have priority `100`. Lower priority values win within a routing tier. An older version can still be selected if the preferred model is disabled or lacks a required effort (for example, GPT-6 Sol can serve `sol/none`). **The registry describes API capabilities, not access granted to your account**; check availability before executing any selected model. The CLI only recommends a model; it does not call it.

Resolution preserves the routing policy's minimum tier and effort. It chooses an enabled model in that tier (or escalates to a higher tier) only if an explicit effort mapping exists. Otherwise it fails clearly without silently downgrading. `none` is a supported API setting for some models but is not selected automatically by the current deterministic routing policy. `max` is an actual supported OpenAI reasoning effort. `ultra` remains a **router-only** tier with no OpenAI API mapping; the resolver deliberately fails closed for `ultra`, rather than falsely mapping it to `max`. `reasoning.mode: "pro"` is separate from effort and is not currently modeled in this registry.

The analyzer is configured separately: `TYPESAFE_MODEL=kev:4b-q4_K_M` selects Kev for task assessment, **not** the OpenAI model that the router recommends.

## Architecture

- `TaskAnalyzer` (`src/task-analyzer.ts`) is the provider-independent analysis contract.
- `TypeSafeTaskAnalyzer` (`src/typesafe-analyzer.ts`) uses the TypeSafe-compatible SDK for hosted Jev or local Kev; no change to the routing policy is needed when switching between them.
- `chooseRoute` (`src/routing-policy.ts`) combines analyzer scores, objective metrics, and conservative security rules.
- `resolveModelRoute` selects an exact model ID and provider effort from `models.json`, without silently weakening the route.

The CLI **only recommends** an execution model: it does not run it. Analyzer confidence handling remains a preliminary, conservative heuristic pending calibration.

## Run

```bash
pnpm run dev "Write a conventional commit for this tiny change" --files=1
```

```bash
pnpm run dev "Review an authentication refactor and identify regressions" --files=10 --modules=3 --auth --permissions
```

Running without a task uses a built-in example:

```bash
pnpm run dev
```

## Type-check

```bash
pnpm typecheck
pnpm test
```

## Design

1. Objective metrics are supplied by code/CLI.
2. A configured analysis backend evaluates task nature, complexity, risk, and ambiguity.
3. A deterministic routing policy combines these values.
4. Hard rules prevent risky tasks from being downgraded.
5. Low analyzer confidence triggers conservative routing and review until calibrated.

The thresholds are initial heuristics. They are meant to be calibrated later on a dataset of real tasks and outcomes.

## Upper reasoning tiers

The routing policy currently selects one of six internal reasoning-effort labels (model capability metadata additionally supports `none`):

```text
low < medium < high < xhigh < max < ultra
```

`max` and `ultra` are intentionally conservative in the initial policy. They are only selected for combinations of very high complexity, ambiguity, and risk. `ultra` requires a future explicitly modeled execution strategy (such as a separate pro mode with validated semantics), otherwise the resolver will reject it. These thresholds are starter heuristics and should be calibrated from real routing outcomes.

## Migrating an existing Git clone

The GitHub repository has moved from `Oxelio/jev-router` to `Oxelio/ai-task-router`. Update any existing clone's remote URL (the local directory name does not need to change):

```bash
git remote set-url origin https://github.com/Oxelio/ai-task-router.git
git pull --ff-only origin main
```
