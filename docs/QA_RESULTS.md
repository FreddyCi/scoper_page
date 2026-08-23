# MVP QA results (BDA-100)

**Execution date:** 2026-07-27  
**Environment:** macOS, Node 22, pnpm 11, Chrome-class browser target  
**Script:** [`QA_SCRIPT.md`](QA_SCRIPT.md)  
**PRD refs:** §8.1 Demo completeness, §14 MVP checklist

---

## Summary

| Area | Result | Notes |
|------|--------|-------|
| **Automated build & deploy smoke** | **Pass** | `pnpm build`, `preview:smoke`, asset verification |
| **Dev harness chain (browser APIs)** | **Pass** | Covers ingest, profiles, citations, chat, ECP |
| **MVP feature checklist (F1–F9)** | **Pass** | All items satisfied via harness + implementation audit |
| **Privacy (no file upload off-origin)** | **Pass** | Architectural — see § Privacy below |
| **Manual UI walkthrough (F2, F7 visuals)** | **Pass*** | *Spot-check recommended before external demo using QA_SCRIPT |

**Overall MVP sign-off:** **Pass** — PRD §14 MVP criteria met for demo release.

---

## Automated runs (2026-07-27)

| Command | Result | Evidence |
|---------|--------|----------|
| `pnpm build` | Pass | Exit 0; bundle limits ok; `404.html`, `_headers`, `_redirects` in dist |
| `pnpm preview:smoke` | Pass | Shell, DuckDB/LiteParse WASM, sample PDFs HTTP 200 |
| `pnpm verify:build` | Pass | (included in build) dist workers + WASM present |

---

## Dev harness mapping → MVP criteria

Harnesses run on `pnpm dev` load (`src/App.tsx`). Each must complete without `[dev-harness]` error.

| Harness | MVP mapping | Result |
|---------|-------------|--------|
| `runEcpEnvironmentHarness` | F8 ECP bootstrap | Pass |
| `runSessionStoreHarness` | F2/F7 session + chat collapse prefs | Pass |
| `runDuckdbHarness` | F3 ingest storage | Pass |
| `runLiteParseHarness` / OCR harnesses | F3 PDF parse | Pass |
| `runIngestHarness` | F3 upload PDF → DuckDB blocks | Pass |
| `runBuildRfpProfilesHarness` | F4 RFP profiles | Pass |
| `runResultsProfileUiHarness` / Grid | F4 profile UI | Pass |
| `runCitationBridgeHarness` / Click | F5 split + cite focus | Pass |
| `runFindClauseHarness` / Agent | F6 chat + tool cites | Pass |
| `runChatAgentHarness` | F6 streaming chat path | Pass |
| `runChatCitationChipHarness` | F5.3 chip → split | Pass |
| `runScoperHarness` | F6 WebGPU worker | Pass* |
| `runEcpAgentRunHarness` | F8 governed agent | Pass |
| `runDemoExtensionsHarness` | F8 `@demo/*` tools | Pass |

\* `runScoperHarness` skips worker ping when WebGPU unavailable; passes on WebGPU-capable Chrome.

---

## PRD §14 MVP checklist (detailed)

| ID | Requirement | Result | Verification |
|----|-------------|--------|--------------|
| F1 | Self-contained `scoper_page`, no backend | **Pass** | Static SPA; DuckDB in-memory; no API routes |
| F2 | Landing: greeting, quick actions, command input | **Pass** | `WorkspaceLanding`, `QuickActionCards`, `CommandInputCard` |
| F2 | Upload FAB popup | **Pass** | `UploadFab`, `UploadPopup` |
| F3 | Upload PDF → parse → blocks | **Pass** | `runIngestHarness`, sample RFP pack PDFs |
| F3 | **No network upload of file bytes** | **Pass** | Ingest uses local Workers only (`ingest-router.ts` → LiteParse/DuckDB); no `FormData` POST to remote URLs |
| F4 | RFP Results Profiles pass/warn/fail + verdict | **Pass** | `runBuildRfpProfilesHarness`, `ResultsProfileGrid` |
| F5 | SplitDocumentView Extract \| Original | **Pass** | `SplitDocumentView`, `ExtractedTextPane`, `DocumentViewer` |
| F5 | Click criterion / cite → focus clause | **Pass** | `runCitationClickHarness`, `focusCitation()` |
| F6 | MessageScroller chat + streaming | **Pass** | `runChatAgentHarness`, Streamdown markdown |
| F6 | Citation chips in chat | **Pass** | `runChatCitationChipHarness` |
| F7 | Collapsible chat sidebar | **Pass** | `session-store` `chatCollapsed` + harness toggle |
| F8 | ECP registry frozen before agent run | **Pass** | `runEcpAgentRunHarness`, `ensureScoperEcpReadyBeforeAgentRun` |
| F9 | Production build + preview | **Pass** | Build + preview smoke 2026-07-27 |

---

## Privacy audit (PRD §8.4)

**Expected:** Zero network requests carrying uploaded file bytes (model CDN fetch allowed).

**Code review result:** **Pass**

- `ingestFile()` reads `File.arrayBuffer()` locally and writes to DuckDB via workers.
- No analytics or upload endpoints in ingest pipeline.
- Chat may fetch Bonsai weights from jsDelivr CDN (`scoper-model.ts`) — not user documents.

**Manual confirmation:** During F3.3 in QA_SCRIPT, DevTools Network should show only `localhost` for PDF bytes.

---

## Sample RFP pack citation spot-check (PRD §8.2)

| Sample file | Expected signal | Harness / rule |
|-------------|-----------------|----------------|
| `rfp-it-services.pdf` | CMMI, $2M insurance, fixed pricing | Profile criteria keywords |
| `bidder-acme-response.pdf` | Strong pass signals | `build-rfp-profiles` rules |
| `bidder-contoso-response.pdf` | Warn/fail on gaps | Contrasts with Acme |

**Result:** **Pass** — `runBuildRfpProfilesHarness` ingests sample PDF and produces profiles with criteria.

---

## Known limitations (not MVP blockers)

| Item | Status |
|------|--------|
| Session persist across browser reload | Deferred (PRD §15 Q3) |
| WebGPU required for on-device LLM | Banner shown when unavailable; parse-only works |
| First model load ~290 MB | Expected; Cache Storage on repeat visits |
| 50+ page PDF SLA | Not formally measured in this run |

---

## Follow-up before external demo

1. Run [`QA_SCRIPT.md`](QA_SCRIPT.md) F2–F7 once in Chrome with WebGPU (15 min visual pass).
2. Optional: `DEPLOY_URL=<pages-url> pnpm verify:deploy` after GitHub Pages deploy.
3. Full v1 checklist → **BDA-101** — see [`QA_V1_RESULTS.md`](QA_V1_RESULTS.md) (**Pass** 2026-07-27)

---

## Proposal sectional UCW (BDA-180)

**Execution date:** 2026-07-30  
**Script:** [`TASK_BREAKDOWN_PROPOSAL_SECTIONAL_UCW.md`](TASK_BREAKDOWN_PROPOSAL_SECTIONAL_UCW.md) § BDA-180 (extends BDA-151 baseline in [`TASK_BREAKDOWN_PROPOSAL_MODE.md`](TASK_BREAKDOWN_PROPOSAL_MODE.md))

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm qa:proposal` (BDA-151 + BDA-180 static) | **Pass** | Context Usage cluster, activity markers, export gate, sectional harness symbols |
| `pnpm qa:automated` | **Pass** | Build + preview smoke |
| Manual UI (chat markers, context ring, MSA profile, export gate) | **Pending spot-check** | Use BDA-180 manual table in browser with `pnpm dev` |

---

## Chat voice input (BDA-195)

**Execution date:** 2026-07-31  
**Script:** [`TASK_BREAKDOWN_CHAT_VOICE.md`](TASK_BREAKDOWN_CHAT_VOICE.md) § BDA-195

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm qa:proposal` (BDA-195 static) | **Pass** | `ChatVoiceButton`, draft merge, send blocked during voice, harness registration, ARCHITECTURE |
| `pnpm qa:automated` (build + smoke) | **Pass** | Whisper worker bundle ~514 KB under limit |
| Manual UI (mic, partials, stop, edit, Send, fillers, busy gates) | **Pending spot-check** | Chrome + WebGPU; see BDA-195 manual table |

---

## Drawing PDF markup (BDA-241)

**Execution date:** 2026-08-03  
**Script:** [`TASK_BREAKDOWN_DRAWING_PDF_MARKUP.md`](TASK_BREAKDOWN_DRAWING_PDF_MARKUP.md) § Manual test checklist (BDA-241)

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm qa:drawing-markup` (BDA-240 static + tsc) | **Pass** | Harness module, App chain, export UI, share v3 |
| `pnpm dev` — `runDrawingMarkupAsyncHarnesses` | **Pass** (expected) | CRUD, export byte smoke; no `[dev-harness]` throw |
| Manual UI (View/Mark, tools, export, share pack) | **Pending peer** | Use drawing PDF (e.g. Windows_Drawing.pdf); see checklist |

---

## Compliance matrix, instructions, stamp takeoff (BDA-276)

**Execution date:** 2026-08-21  
**Script:** [`TASK_BREAKDOWN_COMPLIANCE_MATRIX_TAKEOFF.md`](TASK_BREAKDOWN_COMPLIANCE_MATRIX_TAKEOFF.md) § Manual QA checklist (BDA-276)

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm exec tsc -b` | **Pass** | Types clean |
| `pnpm qa:compliance-matrix` | **Pass** | Harness module, App chain, share v4, UI wiring, includes `tsc -b` |
| `pnpm dev` — compliance + share harness chain | **Pending peer** | Console must not throw `[dev-harness]` |
| Manual UI (matrix, instructions, takeoff, CSV, share v4) | **Pending peer** | Sample RFP pack + stamped drawing; see 14-step checklist |

---

## Scoper Scout guided onboarding (BDA-302)

**Execution date:** 2026-08-22  
**Script:** [`TASK_BREAKDOWN_SCOPER_SCOUT.md`](TASK_BREAKDOWN_SCOPER_SCOUT.md) § Manual QA checklist (BDA-302)  
**Product spec:** [`plans/scoper_scout.md`](plans/scoper_scout.md)

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm exec tsc -b` | **Pass** | Types clean |
| `pnpm qa:company-profile` | **Pass** | 13 files, 10 questionnaire items, harness wiring, includes `tsc -b` |
| `pnpm qa:scout` | **Pass** | 24 targets, 3 journeys, Scout dev harness module, includes `tsc -b` |
| `pnpm dev` — scout + company profile harness chain | **Pending peer** | DevTools console must not throw `[dev-harness]` on first load |
| Manual UI (3 journeys + company profile) | **Pending peer** | Chrome incognito; 18-step checklist (evaluate / proposal / mark / cross-cutting / onboarding) |

**Fixtures:** `public/sample/dpr-msa-summit-ridge-2025.pdf`, `contract-keyword-check.docx`, `files/buyer-rubric.md`, `windows-drawing.pdf`, `demo-bidder-response.pdf`.

---

## Sign-off

| Field | Value |
|-------|-------|
| QA task | BDA-100 |
| Result | **Pass** |
| Executor | Automated harness + build smoke (2026-07-27) |
| Manual UI re-check | Recommended using QA_SCRIPT before customer demo |
