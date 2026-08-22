# Static deploy guide (BDA-092)

Deploy the Vite build output (`dist/`) to any static host. The app is a single-page application with no client-side URL router — all views are in-memory — but asset paths and WASM MIME types must be correct.

## Build artifact

```bash
pnpm install
pnpm build
```

This runs:

1. WASM/worker asset copy into `public/`
2. Typecheck + Vite production build → `dist/`
3. Bundle size checks
4. Static hosting prep (`404.html` for GitHub Pages, Cloudflare `_headers` / `_redirects`)

Verify locally:

```bash
pnpm preview          # http://localhost:4173
pnpm preview:smoke    # automated asset + WASM MIME checks
```

Optional — verify a deployed URL:

```bash
DEPLOY_URL=https://your-site.example pnpm verify:deploy
```

---

## GitHub Pages

### Option A — GitHub Actions (recommended)

The repo includes [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml).

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions
2. Push to `main` (or run the workflow manually)
3. After the workflow completes, open the deployment URL from the Actions run

The workflow:

- Installs pnpm via Corepack
- Runs `pnpm build`
- Uploads `dist/` as a Pages artifact
- Deploys with `actions/deploy-pages`

**Project site URL** (`https://<user>.github.io/<repo>/`): set repository variable or secret:

```bash
VITE_BASE_PATH=/<repo-name>/
```

In GitHub: **Settings → Secrets and variables → Actions → Variables** → `VITE_BASE_PATH` = `/scoper_page/` (example).

**User/org site** (`https://<user>.github.io/`): leave `VITE_BASE_PATH` unset (default `/`).

### Option B — Manual upload

```bash
pnpm build
# Upload contents of dist/ to gh-pages branch or Pages artifact
```

`scripts/prepare-static-hosting.mjs` copies `index.html` → `404.html` so GitHub Pages serves the app shell for unknown paths.

---

## Cloudflare Pages

### Connect repository

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select this repository
3. Build settings:

| Setting | Value |
|---------|--------|
| Framework preset | None |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |
| Environment variable | `NODE_VERSION=22` |

4. **Save and deploy**

Corepack/pnpm: add environment variable `ENABLE_COREPACK=1` or set install command to:

```bash
corepack enable && pnpm install
```

### Headers and SPA fallback

Files in `public/` are copied to `dist/` on build:

- **`_headers`** — COOP/COEP + explicit `application/wasm` for `.wasm` paths
- **`_redirects`** — SPA fallback (`/* → /index.html` 200) for deep links

Cloudflare serves `.wasm` correctly by default; `_headers` documents and reinforces MIME types.

### Custom domain

Add the domain in Pages → **Custom domains**. No special WASM config needed beyond `_headers`.

---

## Cloudflare Workers (`scout`)

Use the **`scout` Worker** for the full RFP app (e.g. `scout.myscoper.app`). Keep **`myscoper.app`** on the separate Pages splash project.

### Deploy

```bash
pnpm install
npx wrangler login    # once
pnpm deploy:scout     # build dist/ + wrangler deploy
```

`wrangler.jsonc` serves `dist/` with SPA fallback (`not_found_handling: single-page-application`). `public/_headers` is copied into `dist/` on build for COOP/COEP and WASM MIME types.

### Custom domain

In Cloudflare → **Workers & Pages** → **scout** → **Settings** → **Domains & Routes**, add `scout.myscoper.app` (proxied). Or ask the Cloudflare agent to create a proxied CNAME:

| Type | Name | Content |
|------|------|---------|
| CNAME | `scout` | `scout.<account>.workers.dev` (or value shown in dashboard) |

Verify after deploy:

```bash
DEPLOY_URL=https://scout.myscoper.app pnpm verify:deploy
```

---

## MIME types (all hosts)

LiteParse and DuckDB **fail to instantiate** if `.wasm` is served as `text/plain`.

| Extension | Required Content-Type |
|-----------|------------------------|
| `.wasm` | `application/wasm` (or `application/octet-stream`) |
| `.mjs` | `application/javascript` or `text/javascript` |
| `.js` | `application/javascript` or `text/javascript` |

### Verify on a live URL

```bash
curl -sI https://YOUR-SITE/duckdb/duckdb-eh.wasm | grep -i content-type
# expect: application/wasm  OR  application/octet-stream

curl -sI https://YOUR-SITE/liteparse/liteparse_wasm_bg.wasm | grep -i content-type
```

Or:

```bash
DEPLOY_URL=https://YOUR-SITE pnpm verify:deploy
```

---

## Cross-origin isolation (optional)

Vite dev/preview set:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Production: mirrored in `public/_headers` for Cloudflare. For other hosts (S3, nginx), add the same headers on HTML and WASM routes if you need `SharedArrayBuffer` / threaded WASM.

---

## Deploy checklist

- [ ] `pnpm build` succeeds in CI or locally
- [ ] `pnpm preview:smoke` passes
- [ ] Deployed site loads shell (no blank page / 404 on `/`)
- [ ] `/duckdb/duckdb-eh.wasm` → HTTP 200 + WASM MIME
- [ ] `/liteparse/liteparse_wasm_bg.wasm` → HTTP 200 + WASM MIME
- [ ] Upload `public/sample/rfp-it-services.pdf` in the app → extract blocks appear
- [ ] (Optional) WebGPU chat loads after model download

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `WebAssembly.instantiate` failed | Wrong WASM MIME | Fix host headers; see table above |
| Blank page on project GitHub Pages URL | Wrong asset base path | Set `VITE_BASE_PATH=/<repo>/` and rebuild |
| 404 on refresh (if you add routes later) | Missing SPA fallback | Use `_redirects` (Cloudflare) or `404.html` (GitHub) |
| CORS / isolation errors | Missing COOP/COEP on CDN | Copy rules from `public/_headers` |

---

## Related

- [README](../README.md) — local dev quick start
- [sample/README.md](../sample/README.md) — demo PDF corpus
- BDA-090 — Vite worker/WASM build configuration
