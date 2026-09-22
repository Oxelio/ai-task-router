# Jev Router Demo

Small TypeScript MVP that uses TypeSafe Jev to assess a software-development task and then applies a deterministic routing policy to recommend:

- model: `luna | terra | sol | astra`
- reasoning effort: `low | medium | high | xhigh | max | ultra`

The model names are routing labels in this demo. The project deliberately does **not** call an OpenAI model yet.

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
