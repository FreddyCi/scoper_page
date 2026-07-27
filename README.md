# Browser Doc Agent Demo

Local-first document intelligence in the browser: RFP qualification, scope creep analysis, visual citations, and on-device AI chat.

## Prerequisites

- [pnpm](https://pnpm.io/) 10+ (via Corepack: `corepack enable`)
- Chrome/Edge 120+ with WebGPU (for full agent features)

## Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Typecheck + production build |
| `pnpm preview` | Preview production build |
| `pnpm lint` | Run oxlint |

## Project docs

- [PRD](docs/PRD.md)
- [Task breakdown](docs/TASK_BREAKDOWN.md)
