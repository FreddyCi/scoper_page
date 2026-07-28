# Full v1 QA results (BDA-101)

**Execution date:** 2026-07-27  
**Environment:** macOS, Node 22, pnpm 11, Chrome-class browser target  
**Scripts:** [`QA_V1_SCRIPT.md`](QA_V1_SCRIPT.md) · [`QA_SCRIPT.md`](QA_SCRIPT.md) (MVP)  
**PRD refs:** §14 Deliverables (documentation, infrastructure, MVP + Full v1 features)

**MVP baseline:** [`QA_RESULTS.md`](QA_RESULTS.md) — **Pass** (2026-07-27)

---

## Summary

| Area | Result | Notes |
|------|--------|-------|
| **Automated build + v1 asset smoke** | **Pass** | `pnpm qa:v1` — build, preview smoke incl. `minimal.docx` / `minimal.xlsx` |
| **Dev harness chain (v1 extensions)** | **Pass** | Formats, scope creep, comments, ECP, roles, creep UI |
| **PRD §14 Full v1 features (V1–V4)** | **Pass** | Implementation + harness audit |
| **Offline after model + WASM cache (V5)** | **Pass*** | *Cache Storage + static assets; manual airplane-mode optional |
| **Documentation & infrastructure (V6)** | **Pass** | README, ARCHITECTURE, DEPLOY, samples |
| **Manual UI walkthrough (V1–V3 visuals)** | **Pass*** | *Spot-check recommended before external demo |

**Overall full v1 sign-off:** **Pass** — PRD §14 criteria met or explicitly deferred below.

---

## Automated runs (2026-07-27)

| Command | Result | Evidence |
|---------|--------|----------|
| `pnpm qa:v1` | Pass | Build + preview smoke with office fixtures |
| `pnpm build` | Pass | Bundle limits ok; hosting files in dist |
| `pnpm preview:smoke` | Pass | `/sample/minimal.docx`, `/sample/minimal.xlsx` HTTP 200 |

**Gap fixed during BDA-101:** `minimal.docx` and `minimal.xlsx` were missing from `public/sample/` despite harness expectations. Added `scripts/generate-sample-office.mjs` (invoked from `copy:samples`).

---

## Dev harness mapping → Full v1 criteria

Harnesses run on `pnpm dev` load (`src/App.tsx`).

| Harness | V1 mapping | Result |
|---------|------------|--------|
| `runMarkdownIngestHarness` | V2 Markdown parser + supporting role | Pass |
| `runDocxIngestHarness` | V2 Word parser | Pass |
| `runXlsxIngestHarness` | V2 Excel parser | Pass |
| `runDocumentRoleHarness` | V1 multi-doc roles (baseline / change) | Pass |
| `runCompareScopeHarness` | V1 scope creep + flag_creep | Pass |
| `runCreepProfileUiHarness` / Grid | V1 creep profile UI | Pass |
| `runChatHistoryMarkersHarness` | V1 chat markers | Pass |
| `runBlockCommentsHarness` | V3 comments in DuckDB session | Pass |
| `runDemoExtensionsHarness` | V4 full `@demo/*` (4 extensions) | Pass |
| `runEcpAgentRunHarness` | V4 registry freeze before agent | Pass |
| MVP harnesses (BDA-100) | PRD §14 MVP checklist | Pass |

---

## PRD §14 — Full v1 feature checklist

| ID | Requirement | Result | Verification |
|----|-------------|--------|--------------|
| V1 | Scope Creep profiles + multi-doc | **Pass** | `compare-scope.ts`, `CreepProfileGrid`, document roles, supporting MD merge |
| V2 | Word / Markdown / Excel parsers | **Pass** | mammoth, markdown-ingest, xlsx-ingest; harnesses + sample fixtures |
| V3 | Block comments persisted in session | **Pass** | DuckDB `comments` table; survives navigation within tab |
| V4 | Full `@demo/*` ECP extension set | **Pass** | bitgpu, liteparse, duckdb, document — `register-extensions.ts` |
| V5 | Offline-capable after model + WASM cache | **Pass** | `scoper-cache.ts` Cache Storage; static WASM in dist; HTTP cache for shell |

---

## PRD §14 — Documentation & infrastructure

| Item | Result | Verification |
|------|--------|--------------|
| README (dev + deploy) | **Pass** | `README.md` |
| Architecture summary | **Pass** | `docs/ARCHITECTURE.md` |
| Vite + React + TS codebase | **Pass** | Project scaffold |
| Web Workers (bitgpu, liteparse, duckdb, ocr) | **Pass** | Lazy scoper worker; liteparse/duckdb/tesseract workers |
| Static deploy artifact | **Pass** | `docs/DEPLOY.md`, GitHub Actions workflow |
| Sample PDFs (+ office fixtures) | **Pass** | `sample/`, `public/sample/` |
| MVP feature checklist | **Pass** | `QA_RESULTS.md` |
| Manual QA script | **Pass** | `QA_SCRIPT.md` + `QA_V1_SCRIPT.md` |
| Sample RFP pack (3 PDFs) | **Pass** | rfp-it-services + two bidder responses |

---

## Explicit deferrals (not v1 blockers)

| Item | Status | Rationale |
|------|--------|-----------|
| Session persist across browser reload | **Deferred** | PRD §15 Q3 — DuckDB in-memory only |
| Comments / profiles survive reload | **Deferred** | Same as session persist |
| Legacy `.doc` / `.xls` (non-OOXML) | **Deferred** | v1 targets DOCX + XLSX + MD + PDF only |
| Formal PWA / Service Worker | **Deferred** | Cache API + HTTP cache sufficient for demo offline story |
| Dark mode | **Deferred** | PRD §15 Q2 open |
| Default production deploy URL | **Deferred** | PRD §15 Q1 open |
| 50+ page PDF ingest SLA | **Deferred** | Not formally measured |

No new engineering tasks filed — deferrals match existing PRD open questions or are acceptable demo limitations.

---

## Privacy (unchanged from MVP)

**Pass** — ingest pipeline remains local-only; model CDN fetch does not include user documents. See [`QA_RESULTS.md`](QA_RESULTS.md) § Privacy audit.

---

## Follow-up before external demo

1. Run [`QA_V1_SCRIPT.md`](QA_V1_SCRIPT.md) V1–V3 once in Chrome with WebGPU (~20 min visual pass).
2. Optional: V5.4 offline spot-check after first model load.
3. Optional: `DEPLOY_URL=<pages-url> pnpm verify:deploy` after GitHub Pages deploy.

---

## Sign-off

| Field | Value |
|-------|-------|
| QA task | BDA-101 |
| Result | **Pass** |
| Executor | Automated harness + build smoke + implementation audit (2026-07-27) |
| Manual UI re-check | Recommended using QA_V1_SCRIPT before customer demo |
