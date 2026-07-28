# Scoper Doc Agent Demo

Local-first document intelligence in the browser: RFP qualification, scope creep analysis, visual citations, and on-device AI chat. Documents are parsed and stored in-memory — nothing is uploaded to a server.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | 20+ recommended |
| **pnpm** | 10+ via [Corepack](https://pnpm.io/installation#using-corepack): `corepack enable` |
| **Browser** | Chrome or Edge 120+ with **WebGPU** enabled (for on-device Bonsai chat) |

WebGPU is optional for parsing-only workflows (upload, extract, profiles without chat). If WebGPU is unavailable, the app shows a banner and document analysis still works.

First chat load downloads ~290 MB of model weights from the CDN; later visits use the browser cache.

## Quick start

```bash
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

### Try the sample RFP pack

After `pnpm install`, sample PDFs are in [`public/sample/`](public/sample/) (source: [`sample/`](sample/)):

1. **Analyse RFP** → upload `rfp-it-services.pdf`, `bidder-acme-response.pdf`, `bidder-contoso-response.pdf`
2. Open **Profiles** to compare bidder qualification cards
3. Click a criterion or citation chip to open split view with PDF highlight

See [`sample/README.md`](sample/README.md) for the full corpus (scope creep fixtures, OCR samples, Word/Markdown/Excel).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Copy WASM/worker assets + start Vite dev server |
| `pnpm build` | Typecheck, production build, bundle + asset checks |
| `pnpm preview` | Serve `dist/` locally (production parity) |
| `pnpm preview:smoke` | Start preview and verify shell, WASM, sample PDF paths |
| `pnpm lint` | Run oxlint |
| `node scripts/generate-sample-pdfs.mjs` | Regenerate RFP demo PDF corpus |

`postinstall` runs `pnpm copy:assets` (DuckDB, LiteParse, Tesseract, PDF.js workers into `public/`).

## Production build

```bash
pnpm build
pnpm preview   # http://localhost:4173
```

Build output is static files in `dist/` — suitable for any static host.

## Deploy (static hosting)

1. Run `pnpm build`
2. Upload the **`dist/`** directory to your host (GitHub Pages, Cloudflare Pages, S3 + CloudFront, Netlify, etc.)
3. Configure **SPA fallback** so unknown routes serve `index.html` (Vite `base: '/'` default)

### MIME types (required)

Hosts must serve WASM with a binary MIME type or LiteParse/DuckDB will fail to instantiate:

| Extension | Content-Type |
|-----------|----------------|
| `.wasm` | `application/wasm` (preferred) or `application/octet-stream` |
| `.mjs` | `text/javascript` or `application/javascript` |
| `.js` | `text/javascript` or `application/javascript` |

**Cloudflare Pages** and **GitHub Pages** (current defaults) serve `.wasm` correctly for this project.

**Optional headers** (already set in Vite dev/preview via `vite.config.ts`):

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Enable the same on production if you need cross-origin isolation for WASM threads.

### Deploy checklist

- [ ] `pnpm build` succeeds locally
- [ ] `pnpm preview:smoke` passes
- [ ] `/duckdb/duckdb-eh.wasm` returns 200 with WASM MIME on deployed URL
- [ ] Upload sample PDF from `/sample/` works in the deployed app

Detailed host-specific steps are covered in **BDA-092** (static deploy configuration).

## Architecture (short)

- **UI:** React 19 + Vite + Tailwind + shadcn
- **Parse:** LiteParse WASM (PDF), mammoth (Word), SheetJS (Excel), markdown splitter
- **Storage:** DuckDB WASM (in-memory session)
- **Chat:** bitgpu Bonsai 1.7B in a dedicated worker (lazy-loaded)
- **Agent:** ECP `@demo/*` extensions for governed tool calls

Full product spec: [`docs/PRD.md`](docs/PRD.md)  
Implementation tasks: [`docs/TASK_BREAKDOWN.md`](docs/TASK_BREAKDOWN.md)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| WebGPU banner / no chat | Use Chrome/Edge desktop; check `chrome://gpu` |
| WASM failed to fetch | Host MIME for `.wasm`; see table above |
| Empty extract after upload | Re-upload; confirm file type is supported (PDF, DOCX, MD, XLSX) |
| Model download slow | Expected on first chat; wait for load progress in chat sidebar |

## License

Demo / internal use — see repository policy.
