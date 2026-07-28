# Full v1 manual QA script (BDA-101)

Extends [`QA_SCRIPT.md`](QA_SCRIPT.md) (MVP F1–F9) with PRD §14 **Full v1 additions** and documentation/infrastructure sign-off.

**Environment:** Chrome or Edge 120+ desktop with WebGPU (for chat).  
**Record results in:** [`QA_V1_RESULTS.md`](QA_V1_RESULTS.md)

**Sample files:** `public/sample/` — RFP pack PDFs, `minimal.docx`, `minimal.xlsx`, plus any `.md` file for supporting context.

---

## Automated pre-check (no browser)

```bash
pnpm qa:v1
```

Runs production build, preview smoke (including office fixtures), and references harness coverage in `QA_V1_RESULTS.md`.

---

## V1 — Scope Creep mode + multi-doc

| ID | Steps | Pass criteria |
|----|--------|---------------|
| V1.1 | Landing → **Compare scope** quick action | Mode switches to Scope Creep; helper text mentions markdown supporting context |
| V1.2 | Upload `minimal.pdf` + tag **Baseline** in doc tab | Role persisted; visible in document list |
| V1.3 | Upload `minimal.docx` → tag **Change request** | Second doc ingested; roles distinct |
| V1.4 | Upload a `.md` file (or paste sample markdown) | Auto-tagged **Supporting** |
| V1.5 | Open **Profiles** (creep grid) | Scope Creep profile card(s) with flags and evidence |
| V1.6 | Click a flag / citation | Split view opens with highlighted source block |
| V1.7 | Chat after compare — check history markers | Scope creep markers visible in chat history (if flags present) |

---

## V2 — Word / Markdown / Excel parsers

| ID | Steps | Pass criteria |
|----|--------|---------------|
| V2.1 | Upload `minimal.docx` | Extract pane shows blocks; headings appear as section groups |
| V2.2 | Upload harness markdown or any `.md` | Supporting role; section paths from `#` headings |
| V2.3 | Upload `minimal.xlsx` | Sheet rows ingested; section path includes sheet name |
| V2.4 | Re-upload same PDF | No crash; blocks append or replace per ingest rules |

---

## V3 — Block comments (session persistence)

| ID | Steps | Pass criteria |
|----|--------|---------------|
| V3.1 | Open split view on any doc with blocks | Comment affordance on block row |
| V3.2 | Add comment text → save | Comment indicator appears on block |
| V3.3 | Navigate away and return to same block | Comment still listed (same tab session) |
| V3.4 | Full page reload | Comments cleared (expected — session not persisted across reload) |

---

## V4 — ECP freeze + full `@demo/*` set

| ID | Steps | Pass criteria |
|----|--------|---------------|
| V4.1 | DevTools console on `pnpm dev` load | `[dev-harness]` success for ECP + demo extensions + agent run |
| V4.2 | Confirm four extensions registered | `@demo/bitgpu`, `@demo/liteparse`, `@demo/duckdb`, `@demo/document` |
| V4.3 | Chat turn with `find_clause` query | Tool executes; registry was frozen before run (no post-freeze registration errors) |
| V4.4 | `compare_scope` via ECP path | Harness parity — flags returned with citations |

---

## V5 — Offline after cache

| ID | Steps | Pass criteria |
|----|--------|---------------|
| V5.1 | First visit: load chat once (model download) | Progress or load completes |
| V5.2 | DevTools → Application → Cache Storage | `scoper-model-v1` contains manifest + weights URLs |
| V5.3 | Reload app (network online) | Chat available without re-downloading full weights |
| V5.4 | Optional: DevTools → Network → Offline, reload | Shell + WASM from cache; parse-only works; chat may fail if weights not cached |

---

## V6 — Documentation & infrastructure (PRD §14)

| ID | Requirement | Pass criteria |
|----|-------------|---------------|
| V6.1 | README dev + deploy | `README.md` covers install, dev, build, deploy link |
| V6.2 | Architecture summary | `docs/ARCHITECTURE.md` present |
| V6.3 | Static deploy artifact | `pnpm build` → `dist/` with COOP/COEP headers files |
| V6.4 | Sample corpus | RFP pack PDFs + office fixtures in `public/sample/` |
| V6.5 | MVP QA complete | `docs/QA_RESULTS.md` MVP Pass |

---

## Sign-off checklist

All PRD §14 items must be **Pass** or **Deferred** with rationale in `QA_V1_RESULTS.md`.
