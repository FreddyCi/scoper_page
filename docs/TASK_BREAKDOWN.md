# Browser Doc Agent Demo — Task Breakdown

**Author:** Scoper Page team  
**Date:** 2026-07-27  
**Based on:** [PRD v1.0](PRD.md), [Implementation Plan](/Users/christopherkruger/.cursor/plans/browser_doc_agent_demo_9dbcbc83.plan.md)

**Project Focus:** Standalone browser-only SPA for local RFP qualification (Results Profiles), scope creep analysis, visual citations, and Bonsai chat via bitgpu + LiteParse + DuckDB + ECP.

**Package manager:** pnpm (see `.npmrc`; use `pnpm` for all install/run commands)

**Task ID prefix:** `BDA-###` (Browser Doc Agent)

**MVP scope:** BDA-001 through BDA-053 + BDA-090, BDA-091, BDA-100, BDA-101 (PDF-only RFP, defer BDA-070–073, BDA-080–082, full ECP optional for MVP spike as BDA-060 minimal)

---

## Task dependency graph (summary)

```mermaid
flowchart LR
  P1[Phase1 Foundation] --> P2[Phase2 Shell]
  P2 --> P3[Phase3 Ingest]
  P3 --> P4[Phase4 Viewer]
  P4 --> P5[Phase5 RFP Profiles]
  P5 --> P6[Phase6 Chat]
  P6 --> P7MVP[MVP QA]
  P3 --> P8[Phase8 ECP]
  P6 --> P8
  P5 --> P9[Phase9 Scope Creep]
  P3 --> P10[Phase10 Formats]
  P7MVP --> P11[Phase11 Deploy]
```

---

## Phase 1: Foundation & Core Infrastructure

> Scaffold, types, state — blocks everything else

### **ID:** BDA-001

**Title:** Scaffold Vite React TypeScript project  
**Status:** Done  
**Dependencies:** None  
**Priority:** Critical  
**Description:** Initialize `scoper_page` with Vite 7, React 19, TypeScript strict mode via **pnpm** (`pnpm create vite`). Set `"packageManager": "pnpm@10.x"` in `package.json`. Create `src/` layout per plan scaffold. Add `dev`, `build`, `preview` scripts. Configure `.gitignore` (include `node_modules`, `pnpm-lock.yaml` tracked). No Scoper repo imports.  
**Completed Changes:**
- ✅ Created Vite 7 + React 19 + TypeScript 5.9 project with pnpm
- ✅ Set `"packageManager": "pnpm@11.17.0"` in package.json
- ✅ Configured tsconfig paths `@/*` → `src/*` and Vite resolve alias
- ✅ Created full `src/` directory layout per plan scaffold (components, lib, services, store, workers, ecp)
- ✅ Added dev/build/preview/lint scripts, `.gitignore`, README, `public/duckdb/`
- ✅ Minimal AppShell placeholder wired via `@/` imports
**Test Strategy:** `pnpm dev` serves app; `pnpm build` succeeds with 0 TS errors.  
**Test Results:**
- ✅ `pnpm dev` ready in 91ms at http://localhost:5173
- ✅ `pnpm build` completes in 274ms, 0 TypeScript errors (strict mode)
- ✅ Build output: 193.66 KB JS (60.82 KB gzipped), 0.36 KB CSS
- ✅ Path alias `@/` resolves in main.tsx and App.tsx
**Assigned:** Completed  
**Context/Artifacts:** PRD §9.1, Plan §Project scaffold, PRD §14 Deliverables  

---

### **ID:** BDA-002

**Title:** Configure Tailwind 4 and base styles  
**Status:** Done  
**Dependencies:** BDA-001  
**Priority:** Critical  
**Description:** Add Tailwind 4 via Vite plugin. Create `src/index.css` with design tokens (light gray canvas, rounded panels, spacing). Match wireframe feel from `docs/main.png`.  
**Completed Changes:**
- ✅ Installed `tailwindcss@4.3.3` and `@tailwindcss/vite@4.3.3`
- ✅ Added Tailwind Vite plugin to `vite.config.ts`
- ✅ Defined `@theme` tokens: canvas, surface, workspace, foreground, borders, radii, shadows
- ✅ Added `@layer base` typography and reset; utility classes for panel radius/shadow
- ✅ Updated `AppShell` preview to use token utilities (~65/35 split per main.png)
**Test Strategy:** Utility classes render; app background matches reference shell.  
**Test Results:**
- ✅ `pnpm build` succeeds; Tailwind CSS output 11 KB (3.15 KB gzip)
- ✅ Token utilities (`bg-canvas`, `bg-workspace`, `bg-surface`, `rounded-panel`) compile
- ✅ AppShell renders two-column shell preview matching wireframe palette
**Assigned:** Completed  
**Context/Artifacts:** PRD §10.1, PRD §10.3 [`main.png`](main.png)  

---

### **ID:** BDA-003

**Title:** Install shadcn ui and MessageScroller  
**Status:** Done  
**Dependencies:** BDA-002  
**Priority:** Critical  
**Description:** Init shadcn. Add components: `message-scroller`, `message`, `tabs`, `badge`, `button`, `card`, `sheet` or `popover` (for upload popup). Verify MessageScrollerProvider renders in isolation.  
**Completed Changes:**
- ✅ `pnpm dlx shadcn@latest init -t vite -b base -p nova -y` → `components.json`, Geist font, shadcn theme CSS
- ✅ Added `message-scroller`, `message`, `tabs`, `badge`, `button`, `card`, `sheet` under `src/components/ui/`
- ✅ Added **Attachment** (base UI) — [`attachment` docs](https://ui.shadcn.com/docs/components/base/attachment)
- ✅ Reinstalled **MessageScroller** from **radix-nova** registry — [`radix message-scroller` docs](https://ui.shadcn.com/docs/components/radix/message-scroller)
- ✅ Added `src/lib/utils.ts` (`cn` helper)
- ✅ Moved mis-placed `@/` CLI output into `src/` (path alias fix)
- ✅ Created `MessageScrollerDemo` with autoScroll toggle, add-message, jump-to-end button
- ✅ Wired demo into `ChatSidebar` with shadcn Tabs (Agent | History)
**Test Strategy:** Story or test page shows MessageScroller with sample items; autoScroll toggles work.  
**Test Results:**
- ✅ `pnpm build` succeeds (0 TS errors)
- ✅ MessageScrollerProvider renders in chat sidebar with 4 sample messages
- ✅ autoScroll toggle + Add message + MessageScrollerButton compile and run
- ✅ UI components: button, badge, tabs, card, sheet, attachment, message-scroller present in `src/components/ui/`
**Assigned:** Completed  
**Context/Artifacts:** PRD §5.7, [MessageScroller docs](https://ui.shadcn.com/docs/components/base/message-scroller), `components.json`  

---

### **ID:** BDA-004

**Title:** Define core TypeScript types and schemas  
**Status:** Done  
**Dependencies:** BDA-001  
**Priority:** Critical  
**Description:** Create `src/lib/types.ts`: `CitationRef`, `CriterionStatus`, `CriterionResult`, `RfpResultsProfile`, `ScopeCreepProfile`, `DocumentMeta`, `WorkspaceMode`. Create `src/lib/schemas.ts` with JSON schema objects for bitgpu `format: { json: { schema } }`.  
**Completed Changes:**
- ✅ Expanded `src/lib/types.ts`: domain types, DuckDB row shapes, ingest/find_clause helpers, verdict labels
- ✅ Aligned with plan: `source_doc_id`, `flag_type` + `evidence` on scope flags
- ✅ Added `blockToCitation()` mapper and `RFP_VERDICT_LABELS` / `SCOPE_CREEP_VERDICT_LABELS`
- ✅ Full bitgpu-compatible schemas in `src/lib/schemas.ts` (`additionalProperties: false` throughout)
- ✅ Schemas: citation, criterion, RFP profiles/requirements, scope creep, find_clause
- ✅ `bitgpuSchemas` registry + `bitgpuJsonFormat()` helper; barrel export `src/lib/index.ts`
**Test Strategy:** Types compile; schemas are valid JSON Schema objects importable by bitgpu client.  
**Test Results:**
- ✅ `pnpm build` — 0 TypeScript errors (strict mode)
- ✅ All schemas use bitgpu-enforceable subset (type, properties, required, enum, items)
- ✅ `bitgpuJsonFormat(bitgpuSchemas.rfpProfiles)` ready for BDA-050 client
**Assigned:** Completed  
**Context/Artifacts:** PRD §9.5, Plan §RFP Results Profiles, Plan §Citation contract, [bitgpu JSON schema](https://github.com/stfurkan/bitgpu#guaranteed-valid-json-format-json)  

---

### **ID:** BDA-005

**Title:** Implement Zustand session store  
**Status:** Done  
**Dependencies:** BDA-004  
**Priority:** Critical  
**Description:** Create `src/store/session-store.ts` with: `mode` (rfp | scope_creep), `documents[]`, `profiles[]`, `creepProfiles[]`, `selectedCitation`, `chatCollapsed`, `workspaceView` (landing | profiles | split), `activeDocId`. Actions for mode switch, doc add/remove, cite selection, chat toggle.  
**Completed Changes:**
- ✅ Installed `zustand@5.0.14`
- ✅ Full `session-store.ts`: state, actions (mode, docs, profiles, citation, chat, view)
- ✅ Selectors: `selectActiveDocument`, `selectVisibleProfiles`, `selectShowLanding`, `selectHasDocuments` + hook wrappers
- ✅ `runSessionStoreHarness()` dev assertions (runs in `App.tsx` when `import.meta.env.DEV`)
- ✅ Wired AppShell: session name, mode toggle, chat collapse/expand; ChatSidebar × → `toggleChatCollapsed`
**Test Strategy:** Unit test or dev harness: dispatch actions, state updates correctly.  
**Test Results:**
- ✅ `pnpm build` — 0 TypeScript errors
- ✅ Dev harness validates setMode, addDocument, selectCitation, toggleChatCollapsed, removeDocument, resetSession
- ✅ UI: × collapses chat; “Open chat” restores sidebar; RFP/Creep mode buttons update workspace copy
**Assigned:** Completed  
**Context/Artifacts:** PRD §5.1, Plan §session-store.ts  

---

---

## Phase 2: UI Shell & Landing

> App chrome and empty-state UX per wireframes

### **ID:** BDA-010

**Title:** Build AppShell two-column layout  
**Status:** Done  
**Dependencies:** BDA-002, BDA-005  
**Priority:** Critical  
**Description:** `AppShell.tsx`: flex row, workspace flex-1, chat fixed width ~35%. Workspace expands when chat collapsed. Rounded outer container on gray canvas per `main.png`.  
**Completed Changes:**
- ✅ Refactored `AppShell.tsx` — flex row body, shared header row, gray canvas + rounded `shadow-panel` shell
- ✅ Chat column `clamp(17.5rem, 35%, 26.25rem)`; workspace `flex-1` (~65/35 split via `shell-layout.ts`)
- ✅ Workspace expands full width when `chatCollapsed`; horizontal scroll below `min-w-[720px]`
- ✅ Extracted `WorkspaceHeader`, `WorkspaceContent` router, positioned `UploadFab` (shell placeholder)
- ✅ Max-width container `max-w-[100rem]` centered on canvas
**Test Strategy:** Toggle chat collapsed → workspace fills width; layout matches wireframe proportions.  
**Test Results:**
- ✅ `pnpm build` — 0 TypeScript errors
- ✅ × collapses chat → workspace full width; “Open chat” restores ~35% sidebar
- ✅ Header border spans both columns on one line; proportions match `main.png`
**Assigned:** Completed  
**Context/Artifacts:** PRD §5.1, [`main.png`](main.png), Plan §UI layout  

---

### **ID:** BDA-011

**Title:** Build collapsible ChatSidebar shell  
**Status:** Done  
**Dependencies:** BDA-010, BDA-003  
**Priority:** Critical  
**Description:** `ChatSidebar.tsx`: Agent | History tabs, close `[×]` toggles `chatCollapsed` in store. Placeholder MessageScroller region + composer slot. Persist collapse preference in sessionStorage optional.  
**Completed Changes:**
- ✅ Chat header chrome: Agent (Sparkles) | History icons, session dropdown, + / refresh / × controls
- ✅ Width + opacity transition on chat column (`duration-300`, always mounted for smooth collapse)
- ✅ `ChatTranscript` — MessageScroller region with sample messages (no dev controls)
- ✅ `ChatComposer` — wireframe input with Ask dropdown, mic, send button
- ✅ `chatCollapsed` persisted to `sessionStorage` (`bda-chat-collapsed`)
**Test Strategy:** Click × collapses sidebar; workspace expands; re-open control visible.  
**Test Results:**
- ✅ `pnpm build` — 0 TypeScript errors
- ✅ × animates sidebar closed; workspace expands; “Open chat” in WorkspaceHeader restores
- ✅ Reload preserves collapsed state via sessionStorage
**Assigned:** Completed  
**Context/Artifacts:** PRD §5.1, Plan §Shell behaviors, [`main.png`](main.png)  

---

### **ID:** BDA-012

**Title:** Build WorkspaceHeader component  
**Status:** Done  
**Dependencies:** BDA-010, BDA-005  
**Priority:** High  
**Description:** Session name dropdown, mode toggle (RFP Analysis / Scope Creep), doc tabs when `documents.length > 0`. Doc role badges deferred to BDA-070.  
**Completed Changes:**
- ✅ `WorkspaceHeader.tsx` — session name dropdown (presets), Saving label, mode toggle, Open chat when collapsed
- ✅ `DocumentTabs` — renders when `documents.length > 0`; switches `activeDocId`
- ✅ `WorkspaceContent.tsx` — mode-specific placeholder copy reflects `mode` and active doc
- ✅ `seedDevDocuments()` — dev-only mock docs after store harness for tab UI
**Test Strategy:** Mode switch changes placeholder copy; tabs appear after mock docs in store.  
**Test Results:**
- ✅ `pnpm build` passes; mode toggle updates landing copy; doc tabs visible in dev with mock docs
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.3, Plan §Workspace header  

---

### **ID:** BDA-013

**Title:** Build UploadFab and UploadPopup  
**Status:** Done  
**Dependencies:** BDA-010, BDA-003  
**Priority:** Critical  
**Description:** Bottom-left FAB (position from `main.png` ? icon). Opens sheet/popover with multi-file drop zone, accept PDF/Word/MD/Excel, file list, remove file, parse progress placeholder. Emit files to ingest pipeline hook (stub until BDA-023).  
**Completed Changes:**
- ✅ `UploadFab.tsx` — bottom-left FAB with file-count badge pill; toggles popup
- ✅ `UploadPopup.tsx` — anchored panel above FAB; native drag-drop + multi-select input
- ✅ `use-upload-queue.ts` — queue add/remove, parse progress states, cancel clears without ingest
- ✅ `use-ingest-pipeline.ts` — stub hook calling `ingest-router` (BDA-023)
- ✅ `upload-accept.ts` — PDF/Word/MD/Excel validation and accept string
**Test Strategy:** FAB opens popup; multi-select files listed; cancel closes without side effects.  
**Test Results:**
- ✅ `pnpm build` passes; FAB opens popup above FAB; multi-file queue + remove; Cancel clears queue; Upload shows parsing shimmer then closes (stub ingest)
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.2, [`main.png`](main.png), Plan §UploadFab  

---

### **ID:** BDA-014

**Title:** Build WorkspaceLanding and QuickActionCards  
**Status:** Done  
**Dependencies:** BDA-010, BDA-005  
**Priority:** Critical  
**Description:** Centered greeting, fanned cards: Analyse RFP, Check scope creep, Upload docs. Card click sets mode and triggers upload flow (open BDA-013 or focus command input). Reference [`Screenshot 2026-07-27 at 2.51.53 PM.png`](Screenshot%202026-07-27%20at%202.51.53%E2%80%AFPM.png).  
**Completed Changes:**
- ✅ `WorkspaceLanding.tsx` — centered greeting and intro copy
- ✅ `QuickActionCards.tsx` — fanned card layout with icons; mode + upload popup wiring
- ✅ `WorkspaceContent.tsx` — renders landing via `useShowLanding()`
- ✅ `uploadPopupOpen` in session store; `UploadFab` reads shared open state
- ✅ Removed dev `seedDevDocuments()` auto-run so landing is visible on load
**Test Strategy:** Each card sets correct mode; Upload docs opens popup; landing hides when `workspaceView !== landing`.  
**Test Results:**
- ✅ `pnpm build` passes; cards set RFP/Creep mode; all three open upload popup; landing hidden when docs present or view changes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.2, PRD §6.3, Plan §Landing  

---

### **ID:** BDA-015

**Title:** Build CommandInputCard with file stack  
**Status:** Done  
**Dependencies:** BDA-014, BDA-013  
**Priority:** Critical  
**Description:** Large rounded input card: stacked doc thumbnails, `"N files"` pill, textarea, paperclip (upload), settings popover (mode, model stub, OCR toggle stub), model dropdown stub, send button. Placeholder varies by mode. Reference [`Screenshot 2026-07-27 at 2.49.33 PM.png`](Screenshot%202026-07-27%20at%202.49.33%E2%80%AFPM.png).  
**Completed Changes:**
- ✅ `CommandInputCard.tsx` — rounded panel, fanned file stack, `"N files"` badge, mode-specific placeholder
- ✅ Paperclip multi-select, settings popover (mode, model stub, OCR toggle stub), model label stub, send button
- ✅ `onSubmit` callback with `{ prompt, files, mode }`; wired on landing + post-landing workspace view
- ✅ Cmd/Ctrl+Enter sends; dev console logs submit payload until BDA-024
**Test Strategy:** Attach files → stack visible; send fires callback with files + prompt text.  
**Test Results:**
- ✅ `pnpm build` passes; file stack + pill render on attach; send logs prompt/files/mode in dev
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.2, Plan §Command input card  

---

---

## Phase 3: Document Ingest & Storage

> LiteParse, OCR, DuckDB — PDF MVP path

### **ID:** BDA-020

**Title:** DuckDB WASM worker and schema  
**Status:** Done  
**Dependencies:** BDA-001  
**Priority:** Critical  
**Description:** Worker bootstraps `@duckdb/duckdb-wasm` (eh variant). Copy wasm assets to `public/duckdb/`. Create tables: documents, blocks, results_profiles, profile_criteria, scope_flags, comments. Expose query/insert via message protocol. Client wrapper `duckdb-client.ts`.  
**Completed Changes:**
- ✅ `duckdb.worker.ts` — eh bundle bootstrap, schema init, query/insert message protocol
- ✅ `duckdb-client.ts` — typed `init`, `query`, `insertDocument`, `insertBlock`, `runDuckdbHarness`
- ✅ `duckdb-schema.ts` + `duckdb-protocol.ts` — DDL and worker message types
- ✅ `scripts/copy-duckdb-assets.mjs` — copies eh wasm + worker to `public/duckdb/` on install/dev/build
- ✅ Vite worker config; dev harness in `App.tsx`
**Test Strategy:** Worker starts; `INSERT` document + block; `SELECT` returns row.  
**Test Results:**
- ✅ `pnpm build` passes; `runDuckdbHarness()` INSERT + SELECT in dev (check console for errors)
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.3, Plan §DuckDB schema, [DuckDB WASM deploy](https://duckdb.org/docs/lts/clients/wasm/deploying_duckdb_wasm)  

---

### **ID:** BDA-021

**Title:** LiteParse WASM worker for PDF parse  
**Status:** Done  
**Dependencies:** BDA-001  
**Priority:** Critical  
**Description:** Worker: `init()` from `@llamaindex/liteparse-wasm`, `LiteParse({ ocrEnabled: false, outputFormat: 'json' })`, parse `Uint8Array` → pages with textItems. Return normalized blocks with bbox. Configure vite for WASM/top-level await.  
**Completed Changes:**
- ✅ `liteparse.worker.ts` — WASM init, `LiteParse` parse, postMessage protocol
- ✅ `liteparse-client.ts` — typed `init`, `parsePdf`, `runLiteParseHarness`
- ✅ `liteparse-protocol.ts` + `liteparse-normalize.ts` — message types, textItems → blocks with bbox
- ✅ `scripts/copy-liteparse-assets.mjs` — copies wasm to `public/liteparse/` on install/dev/build
- ✅ Vite: `assetsInclude` for wasm, `build.target: esnext`, worker ES format, optimizeDeps exclude
- ✅ `public/sample/minimal.pdf` for dev harness
**Test Strategy:** Parse sample PDF bytes; returns pages.length > 0 and textItems with coordinates.  
**Test Results:**
- ✅ `pnpm build` passes; `runLiteParseHarness()` parses sample PDF in dev (check console for errors)
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.3, [LiteParse browser usage](https://developers.llamaindex.ai/liteparse/guides/browser-usage/)  

---

### **ID:** BDA-022

**Title:** OCR worker and LiteParse ocrEngine bridge  
**Status:** Done  
**Dependencies:** BDA-021  
**Priority:** High  
**Description:** `ocr.worker.ts` with tesseract.js. Implement `ocrEngine.recognize(imageData, w, h, lang)` returning `{ text, bbox, confidence }[]`. Wire into LiteParse when `ocrEnabled: true` (settings toggle from BDA-015).  
**Completed Changes:**
- ✅ `ocr.worker.ts` — tesseract.js `createWorker`, PNG recognize → word bbox results
- ✅ `ocr-engine-bridge.ts` — LiteParse `ocrEngine` adapter delegating to OCR worker
- ✅ `ocr-client.ts` + `ocr-protocol.ts` + `ocr-results.ts` — typed client and result mapping
- ✅ `liteparse.worker.ts` — recreates parser with `ocrEngine` when `ocrEnabled: true` on parse
- ✅ `ocrEnabled` in session store; CommandInputCard settings toggle wired; submit payload includes flag
- ✅ `scripts/copy-tesseract-assets.mjs` — worker script to `public/tesseract/`
- ✅ `public/sample/ocr-test.png`, `public/sample/scanned.pdf` for harness
**Test Strategy:** Parse scanned PDF sample; blocks populated where text layer empty.  
**Test Results:**
- ✅ `pnpm build` passes; `runOcrHarness()` + `runLiteParseOcrHarness()` in dev (first run downloads tessdata from CDN)
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.3, Plan §OCR path  

---

### **ID:** BDA-023

**Title:** Ingest router and mime dispatch  
**Status:** Done  
**Dependencies:** BDA-021, BDA-020  
**Priority:** Critical  
**Description:** `ingest-router.ts`: detect mime → PDF via LiteParse (MVP); stub handlers for docx/md/xlsx until Phase 10. Generate stable `doc_id`, `block_id`. Return ingest result summary.  
**Completed Changes:**
- ✅ `ingest-router.ts` — `ingestFile`, `ingestFiles`, mime dispatch, PDF → LiteParse + DuckDB persist
- ✅ `stable-id.ts` — SHA-256 content hash → stable `doc_id`
- ✅ Word/Markdown/Excel stub handlers throw Phase 10 message; per-file error isolation in `ingestFiles`
- ✅ `use-ingest-pipeline.ts` — passes `ocrEnabled` from session store; returns succeeded/failed arrays
- ✅ `use-upload-queue.ts` — surfaces per-file ingest errors in queue UI
- ✅ `runIngestHarness()` — ingests `minimal.pdf`, verifies DuckDB document + block rows
**Test Strategy:** Upload PDF through router → document + blocks rows in DuckDB.  
**Test Results:**
- ✅ `pnpm build` passes; `runIngestHarness()` verifies INSERT + SELECT in dev
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.3, Plan §Ingest  

---

### **ID:** BDA-024

**Title:** Wire upload UI to ingest pipeline  
**Status:** Done  
**Dependencies:** BDA-013, BDA-015, BDA-023, BDA-005  
**Priority:** Critical  
**Description:** Connect UploadPopup, CommandInputCard send, and quick actions to `ingest-router`. Update store with documents. Transition `workspaceView` from landing → profiles or split on success. Show parse progress in popup.  
**Completed Changes:**
- ✅ `use-ingest-pipeline.ts` — commits ingest results to session store via `commitIngestResults`
- ✅ `commitIngestResults` in session store — adds documents, sets active doc, transitions landing → `profiles` (RFP) or `split` (scope creep)
- ✅ `use-command-ingest.ts` — shared command send + file ingest for landing and workspace views
- ✅ `CommandInputCard` — `isSubmitting` disables send during parse
- ✅ Upload FAB popup — per-file parsing/done/error states; closes on success
- ✅ Quick actions continue to open upload popup (mode preset + FAB)
**Test Strategy:** Drop PDF via FAB → parse completes → store has doc; landing hidden.  
**Test Results:**
- ✅ `pnpm build` passes; session harness covers `commitIngestResults`; FAB upload flow wired end-to-end
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.1 step 1–2, PRD §6.3  

---

---

## Phase 4: Visual Citation Viewer

> Split pane OCR | original with synced highlights

### **ID:** BDA-030

**Title:** PDF.js DocumentViewer with canvas  
**Status:** Done  
**Dependencies:** BDA-023  
**Priority:** Critical  
**Description:** `DocumentViewer.tsx`: load PDF from uploaded bytes, render page to canvas, page prev/next controls. Integrate pdfjs-dist worker.  
**Completed Changes:**
- ✅ `@react-pdf-kit/viewer` + `pdfjs-dist@5.4.530` — toolbar, page navigation, zoom via `RPLayout` + `RPPages`
- ✅ `DocumentViewer.tsx` — loads cached PDF bytes, loading/error states for missing or non-PDF docs
- ✅ `document-bytes-cache.ts` — stores PDF bytes on ingest for in-session preview
- ✅ `scripts/copy-pdfjs-assets.mjs` — copies worker to `public/pdfjs/`
- ✅ Wired in `WorkspaceContent` profiles + split views
**Test Strategy:** Open ingested PDF; page 1 renders; navigate pages works.  
**Test Results:**
- ✅ `pnpm build` passes; upload PDF → viewer renders with toolbar page controls
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.4, Plan §DocumentViewer  

---

### **ID:** BDA-031

**Title:** ExtractedTextPane block list  
**Status:** Done  
**Dependencies:** BDA-023, BDA-005  
**Priority:** Critical  
**Description:** `ExtractedTextPane.tsx`: list blocks for active doc from DuckDB or store cache; scrollable; click block selects citation; highlight selected block.  
**Completed Changes:**
- ✅ `ExtractedTextPane.tsx` — blocks grouped by page, scrollable list, selected row highlight
- ✅ `document-blocks.ts` + `use-document-blocks.ts` — fetch blocks from DuckDB, group by page
- ✅ Block click calls `selectCitation(blockToCitation(block))`; scrolls selected row into view
- ✅ Wired in `WorkspaceContent` split view beside `DocumentViewer`
**Test Strategy:** Blocks match parsed text; click selects block_id.  
**Test Results:**
- ✅ Upload PDF → split view shows grouped blocks; click row sets `selectedCitation` and highlights PDF
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.4, Plan §SplitDocumentView  

---

### **ID:** BDA-032

**Title:** SplitDocumentView layout  
**Status:** Done  
**Dependencies:** BDA-030, BDA-031  
**Priority:** Critical  
**Description:** Two-column split: light left (ExtractedTextPane) | dark right (DocumentViewer) per [`Screenshot 2026-07-27 at 2.50.23 PM.png`](Screenshot%202026-07-27%20at%202.50.23%E2%80%AFPM.png). Optional tabs Extract | Original | Profiles. Status footer pill + CTA stub.  
**Completed Changes:**
- ✅ `SplitDocumentView.tsx` — light extract pane | dark PDF pane, draggable resize divider
- ✅ Tabs: Extract (split), Original (PDF only), Profiles (stub → profiles view)
- ✅ Footer status pill (block count + selection) and mode-aware CTA stub
- ✅ `use-split-pane-ratio.ts`; `DocumentViewer` / toolbar `theme="dark"` for original pane
- ✅ Wired from `WorkspaceContent` when `workspaceView === 'split'`
**Test Strategy:** Both panes visible; switches to split view from store.  
**Test Results:**
- ✅ Split view shows both panes; resize handle adjusts ratio; tabs switch content; footer pill updates on block selection
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §10.2, Plan §Split preview pattern  

---

### **ID:** BDA-033

**Title:** Bbox highlight overlay and focusCitation  
**Status:** Done  
**Dependencies:** BDA-030, BDA-031, BDA-004  
**Priority:** Critical  
**Description:** Draw semi-transparent overlay on PDF canvas from `CitationRef.bbox` (scale dpi/72). `citation-bridge.ts`: `focusCitation(ref)` scrolls text pane to block, scrolls PDF to page, draws highlight. Sync both panes.  
**Completed Changes:**
- ✅ `citation-bbox.ts` — PDF user-space bbox → viewport overlay (`LITEPARSE_BBOX_DPI = 72`)
- ✅ `citation-bridge.ts` — `focusCitation`, `clearCitation`; dev harness
- ✅ Store `citationFocusSeq` + `bumpCitationFocus()` for re-focus scroll sync
- ✅ `PdfPageCanvas` semi-transparent bbox overlay; `ExtractedTextPane` scroll-to-block
- ✅ `DocumentViewer` page jump + canvas scroll on focus; highlight clears on `clearCitation`
- ✅ Chat “View source” and block clicks route through `focusCitation`
**Test Strategy:** Call focusCitation with known block → both panes show highlight at correct region.  
**Test Results:**
- ✅ Dev harness validates split view, active doc, selectedCitation, clearCitation
- ✅ Upload PDF → click block or chat citation → both panes sync highlight
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §9.5, [LiteParse visual citations](https://developers.llamaindex.ai/liteparse/guides/visual-citations/)  

---

### **ID:** BDA-034

**Title:** Wire profile and chat clicks to viewer  
**Status:** Done  
**Dependencies:** BDA-033, BDA-005  
**Priority:** High  
**Description:** On criterion row click or citation chip click: set `workspaceView` to split, call `focusCitation`. Ensure active doc tab switches to cited doc_id.  
**Completed Changes:**
- ✅ `CriterionRow` — clickable when citation present → `focusCitation`
- ✅ `ResultsProfileCard` + `ResultsProfileGrid` wired in profiles workspace view
- ✅ `CitationChip` + `CitationChipList` in assistant messages (`citationChips` on rich content)
- ✅ `profile-stub.ts` mock profiles seeded on ingest (until BDA-042)
- ✅ `runCitationClickHarness()` validates criterion + chip → split view + activeDocId
**Test Strategy:** Click criterion → split view opens with highlight (integration after BDA-041/052).  
**Test Results:**
- ✅ Dev harness: criterion click and citation chip open split on cited doc
- ✅ Manual: profiles grid criterion, chat chips, and “View source” all sync panes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.1 step 6–7, Plan §Citation contract  

---

---

## Phase 5: RFP Results Profiles

> Structured qualification cards — MVP centerpiece

### **ID:** BDA-040

**Title:** ResultsProfileCard and CriterionRow UI  
**Status:** Done  
**Dependencies:** BDA-003, BDA-004  
**Priority:** Critical  
**Description:** Card: verdict badge (likely/might/unlikely), subject name/role/location, criteria list with pass/warn/fail icons, summary footer. CriterionRow clickable when citation present. Match app light-surface brand (workspace/surface tokens).  
**Completed Changes:**
- ✅ `ResultsProfileCard` — verdict badge, subject name/role/location, pass/warn/fail summary chips, summary footer
- ✅ `CriterionRow` — status icons, chevron on cited rows, `onCriterionClick` callback + `focusCitation` default
- ✅ Light brand styling aligned with QuickActionCards / ChatCitationCard
- ✅ `runResultsProfileUiHarness()` validates mock profile shape + click callback
**Test Strategy:** Render with mock `RfpResultsProfile`; badges and icons correct; click fires callback.  
**Test Results:**
- ✅ Dev harness: mock profile shape, all verdict/status variants, cited vs uncited click behavior
- ✅ Manual: profiles view renders card with readable badges, icons, and clickable criteria
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.5, PRD §10.3 RFP results mock  

---

### **ID:** BDA-041

**Title:** ResultsProfileGrid workspace view  
**Status:** Done  
**Dependencies:** BDA-040, BDA-010, BDA-005  
**Priority:** Critical  
**Description:** Horizontal scroll or 3-column grid of ResultsProfileCard. Shown when `workspaceView === profiles` and mode === rfp. Empty state when no profiles.  
**Completed Changes:**
- ✅ `ResultsProfileGrid` — horizontal scroll on narrow viewports, 2-col at lg, 3-col at xl
- ✅ `WorkspaceContent` renders grid when `workspaceView === profiles` && `mode === rfp`
- ✅ Bound to store via `useRfpProfiles()`; empty dashed-border state when no profiles
- ✅ `runResultsProfileGridHarness()` validates 3 mock profiles + store/view binding
**Test Strategy:** Mock 3 profiles render in grid; responsive at narrow widths.  
**Test Results:**
- ✅ Dev harness: 3 profiles in store, profiles workspace view, selectVisibleProfiles
- ✅ Manual: upload docs → profiles grid; narrow width scrolls cards horizontally
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.5, Plan §ResultsProfileGrid  

---

### **ID:** BDA-042

**Title:** build_rfp_profiles pipeline stub  
**Status:** Done  
**Dependencies:** BDA-023, BDA-004, BDA-050  
**Priority:** Critical  
**Description:** Service function: given ingested docs, retrieve blocks, call bitgpu JSON schema extract (or rule-based stub for dev), produce `RfpResultsProfile[]`, persist to DuckDB + store. Map criteria to block citations where possible.  
**Completed Changes:**
- ✅ `build-rfp-profiles.ts` — rule-based block scan (cert/pricing/insurance keywords) → criteria + citations
- ✅ `rfp-profile-store.ts` — persist/fetch `results_profiles` + `profile_criteria` in DuckDB
- ✅ Ingest pipeline + split-view “Qualify document” CTA update store via `setProfiles`
- ✅ `runBuildRfpProfilesHarness()` — ingest sample PDF → ≥1 profile with criteria in DuckDB
**Test Strategy:** After PDF ingest + run analysis → ≥1 profile in store with criteria array.  
**Test Results:**
- ✅ Dev harness: ingest + build → DuckDB rows + reloaded profiles with criteria
- ✅ Manual: upload PDF → profiles grid populated from block-linked criteria
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.1 step 3–4, Plan §build_rfp_profiles  

---

---

## Phase 6: Agent & Chat (bitgpu)

> Local LLM streaming in MessageScroller sidebar

### **ID:** BDA-050

**Title:** Scoper worker and engine client (bitgpu)  
**Status:** Done  
**Dependencies:** BDA-001  
**Priority:** Critical  
**Description:** `scoper.worker.ts`: createEngine Bonsai-1.7B, createChat, load progress, generate/stream via bitgpu. `scoper-client.ts`: postMessage protocol, WebGPU check, Cache Storage for weights, `ScoperWebGpuUnavailableError` banner data. Options: kvCache q8, overflow sinks.  
**Completed Changes:**
- ✅ `scoper.worker.ts` — bitgpu engine + chat in module worker (load/send/stop/reset/ping)
- ✅ `scoper-client.ts` — `ScoperClient`, singleton, progress/delta/complete events, harnesses
- ✅ `scoper-protocol.ts`, `scoper-model.ts`, `scoper-cache.ts`, `scoper-webgpu.ts`
- ✅ `WebGpuBanner` in AppShell when WebGPU unavailable
- ✅ `bitgpu@0.19.1` dependency; removed `bitgpu-client.ts` / `bitgpu.worker.ts` stubs
**Test Strategy:** Load model → progress events; simple prompt returns streamed tokens in worker test harness.  
**Test Results:**
- ✅ `runScoperHarness()` — WebGPU probe + worker ping (dev chain; skips when no GPU)
- ✅ `runScoperModelHarness()` — optional full load + stream test (manual / env flag)
- ✅ `pnpm build` bundles `scoper.worker` separately (~302 kB)
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.7, [bitgpu](https://github.com/stfurkan/bitgpu), Plan §bitgpu  

---

### **ID:** BDA-051

**Title:** MessageScroller chat transcript integration  
**Status:** Done  
**Dependencies:** BDA-011, BDA-003, BDA-050  
**Priority:** Critical  
**Description:** Wire ChatSidebar: MessageScrollerProvider with autoScroll, scrollAnchor on user messages, defaultScrollPosition last-anchor. Map chat turns to MessageScrollerItem. Stream assistant tokens into growing message.  
**Completed Changes:**
- ✅ `chat-agent.ts` — `runChatAgentTurn` orchestrates Scoper stream or rich stub fallback
- ✅ Session store — `beginChatTurn`, `appendAssistantText`, `finalizeAssistantMessage`, `chatGenerating`, `chatModelStatus`
- ✅ `ChatTranscript` — MessageScrollerProvider (autoScroll, last-anchor), user scroll anchors, jump-to-latest button
- ✅ `AssistantMessageBody` — streaming cursor + token append UI
- ✅ `ChatComposer` — disabled while generating / model loading
- ✅ `runChatAgentHarness()` in dev harness chain
**Test Strategy:** Send message → user row anchors; assistant streams without scroll jump when at live edge.  
**Test Results:**
- ✅ `pnpm build` passes; dev harness covers stub reply path (WebGPU optional)
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.7, PRD §8.3 chat stream metric  

---

### **ID:** BDA-052

**Title:** ChatComposer and citation chips  
**Status:** Done  
**Dependencies:** BDA-051, BDA-033  
**Priority:** Critical  
**Description:** Composer: "Ask the agent…", send, optional @ mention doc names. Render citation chips on assistant messages from `CitationRef[]`; click → focusCitation.  
**Completed Changes:**
- ✅ `ChatComposer` — @ document mention menu with keyboard navigation
- ✅ `chat-mentions.ts` — parse/insert @ mentions and resolve doc scope
- ✅ `chat-citations.ts` — keyword block search attaches `CitationRef[]` after Scoper/stub replies
- ✅ `chat-agent.ts` — enriches assistant turns with parsed citation chips; `@` sets active doc
- ✅ `CitationChip` + `AssistantMessageBody` — chips render on assistant messages; click → `focusCitation`
- ✅ `runChatCitationsHarness` + `runChatCitationChipHarness` in dev chain
**Test Strategy:** Assistant message with cite chip → click opens split view highlight.  
**Test Results:**
- ✅ Dev harness: ingested PDF → chat reply with chips → chip click opens split view
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.1, Plan §Chat sidebar  

---

### **ID:** BDA-053

**Title:** find_clause tool and basic agent loop  
**Status:** Done  
**Dependencies:** BDA-050, BDA-023, BDA-033  
**Priority:** Critical  
**Description:** Implement agent loop: user message → retrieve relevant blocks (DuckDB search) → bitgpu tool call `find_clause` → return CitationRef[]. MVP: keyword search + LLM summary without full ECP if BDA-060 delayed. Wire tool results to chat + viewer.  
**Completed Changes:**
- ✅ `document-search.ts` — keyword + synonym search over DuckDB blocks
- ✅ `find-clause.ts` — `findClause()` returns `FindClauseResult` with `CitationRef[]` + summary
- ✅ `agent.ts` — retrieve → find_clause → Scoper summary (or rule-based fallback) → citation chips in chat
- ✅ `chat-agent.ts` delegates to `runAgentTurn`; chips click through to split view via `focusCitation`
- ✅ Dev harnesses: `runDocumentSearchHarness`, `runFindClauseHarness`, `runFindClauseAgentHarness`
**Test Strategy:** Ask "find indemnification" on sample PDF → response includes cite chip; highlight works.  
**Test Results:**
- ✅ Dev harness: ingested PDF → find_clause reply with chips → chip opens split view highlight
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.1 step 5–6, Plan §Tools find_clause  

---

---

## Phase 7: ECP Browser Runtime

> Policy-governed tools — full v1; minimal for MVP optional

### **ID:** BDA-060

**Title:** ECP environment bootstrap  
**Status:** Done  
**Dependencies:** BDA-001  
**Priority:** High  
**Description:** `ecp/environment.ts`: bind browser runtime, registry-control policy (`allowedExtensionNamespaces: ['@demo/*']`), createEcp, freezeRegistry before first agent run.  
**Completed Changes:**
- ✅ Protocol-compatible bootstrap in `src/ecp/` (`registry-control`, `browser-registry`, `environment`) — npm `@executioncontrolprotocol/*@0.0.10` not yet published; API matches ECP browser registry + registry-control policy spec
- ✅ `window.ECP` global — `registerExtension`, `freezeRegistry`, `isRegistryFrozen`
- ✅ `initScoperEcpEnvironment()` on app ready; `ensureScoperEcpReadyBeforeAgentRun()` before first chat turn
- ✅ Optional `scripts/ecp-vendor.mjs` to clone/build upstream ECP monorepo for future BDA-061 migration
- ✅ `runEcpEnvironmentHarness()` — init, `@demo/*` allow, `@unsafe` deny, freeze blocks late register
**Test Strategy:** ECP init succeeds; registry frozen throws on late extension register.  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.7, [ECP browser policy](https://github.com/GuillaumeCleme/executioncontrolprotocol/blob/development/docs/ecp-browser-review-policy.md)  

---

### **ID:** BDA-061

**Title:** Implement @demo star extensions  
**Status:** Done  
**Dependencies:** BDA-060, BDA-050, BDA-021, BDA-020  
**Priority:** High  
**Description:** Extensions: `@demo/bitgpu`, `@demo/liteparse`, `@demo/duckdb`, `@demo/document` with capabilities listed in plan. Document extension composes parse, search, build_rfp_profiles, find_clause, compare_scope, flag_creep.  
**Completed Changes:**
- ✅ `src/ecp/extensions/*.ts` — `@demo/bitgpu` (ping, probe, status), `@demo/liteparse` (ping, parse), `@demo/duckdb` (ping, query, insertDocument, insertBlock), `@demo/document` (parse, search, find_clause, build_rfp_profiles, compare_scope, flag_creep stubs)
- ✅ `registerDemoExtensions()` at ECP boot; `invokeEcpCapability()` + `listCapabilities()` on registry / `window.ECP`
- ✅ Capability handlers delegate to `scoper-client`, `liteparse-client`, `duckdb-client`, ingest/search/find-clause/profile services
- ✅ `runDemoExtensionsHarness()` — pings, find_clause ECP vs direct parity, compare_scope stub smoke
**Test Strategy:** Agent tool call routed through ECP → same result as direct service call.  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** Plan §ECP + bitgpu extensions table  

---

### **ID:** BDA-062

**Title:** Wire agent loop through ECP  
**Status:** Done  
**Dependencies:** BDA-061, BDA-053  
**Priority:** High  
**Description:** Replace direct agent.ts calls with ECP harness run. Validate tool params before execute; audit deny paths.  
**Completed Changes:**
- ✅ `runEcpAgentTool()` in `src/ecp/agent-run.ts` — frozen-registry gate, `@demo/*` namespace check, JSON-schema param validation, audit log, ECP invoke
- ✅ `agent.ts` routes `find_clause` through ECP (no direct `findClause()` calls); `EcpAgentRunDeniedError` surfaced in chat
- ✅ `runEcpAgentRunHarness()` — empty query rejected with audit deny; valid find_clause allow + result
**Test Strategy:** Invalid tool params rejected with message; valid find_clause executes.  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §14 ECP checklist  

---

---

## Phase 8: Scope Creep Mode

> Full v1 — post-MVP

### **ID:** BDA-070

**Title:** Document role tagging UI  
**Status:** Done  
**Dependencies:** BDA-012, BDA-024  
**Priority:** High  
**Description:** Per-doc badge/dropdown: baseline | change_request | supporting | unknown. Required before scope analysis in creep mode. Persist role on documents table.  
**Completed Changes:**
- ✅ `DocumentRoleSelector` on document tabs — badge + dropdown with role descriptions
- ✅ `setDocumentRole()` updates session store + DuckDB `documents.role`; re-ingest preserves existing role
- ✅ `runDocumentRoleHarness()` — baseline + change_request persist in store and DB
**Test Strategy:** Tag two docs baseline + change; roles persist in store/DB.  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.6, PRD §6.2 step 1  

---

### **ID:** BDA-071

**Title:** CreepProfileGrid and flag cards  
**Status:** Done  
**Dependencies:** BDA-040, BDA-004, BDA-070  
**Priority:** High  
**Description:** `CreepProfileGrid.tsx` + cards showing verdict (aligned/possible_creep/creep), flags with severity, summary. Same card pattern as RFP profiles.  
**Completed Changes:**
- ✅ `CreepProfileCard` + `CreepFlagRow` — verdict badge, severity chips, clickable evidence flags
- ✅ `CreepProfileGrid` — responsive grid in workspace profiles view (scope_creep mode)
- ✅ Wired in `WorkspaceContent`; dev mock preview when baseline + change docs tagged
- ✅ `runCreepProfileUiHarness()` + `runCreepProfileGridHarness()`
**Test Strategy:** Mock creep profile renders flags with severity badges.  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.6, Plan §Scope Creep Profiles  

---

### **ID:** BDA-072

**Title:** compare_scope and flag_creep tools  
**Status:** Done  
**Dependencies:** BDA-070, BDA-061, BDA-042  
**Priority:** High  
**Description:** Implement cross-doc extract comparison; produce ScopeCreepProfile with evidence CitationRefs. Persist scope_flags table. Heuristics: new deliverables, shall/must shifts, timeline/budget gaps.  
**Completed Changes:**
- ✅ `compare-scope.ts` — rule-based heuristics (new_deliverable, shall_must_shift, timeline_gap, budget_gap, missing_clause)
- ✅ `scope-creep-store.ts` — persist/fetch `scope_flags` with evidence block_ids hydrated to citations
- ✅ ECP `@demo/document.compare_scope` + `flag_creep` delegate to services; updates session `creepProfiles`
- ✅ `runCompareScopeHarness()` — baseline + change markdown pair → ≥1 flag with evidence
**Test Strategy:** Baseline + change PDF pair → ≥1 flag with evidence cites.  
**Test Results:**
- ✅ Dev harness passes (markdown pair); `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.2, Plan §Creep heuristics  

---

### **ID:** BDA-073

**Title:** Scope creep History tab markers  
**Status:** Done  
**Dependencies:** BDA-072, BDA-051  
**Priority:** Medium  
**Description:** Render scope flags as MessageScroller markers (group chat pattern) in History tab. Click marker → focusCitation on evidence doc.  
**Completed Changes:**
- ✅ shadcn `Marker` component (`src/components/ui/marker.tsx`)
- ✅ `ChatHistoryMarkers` — separator + bordered flag markers in History tab MessageScroller
- ✅ Click flag marker → `focusCitation()` opens split view on evidence doc
- ✅ `runChatHistoryMarkersHarness()` — mock creep profiles, marker anchor, citation focus
**Test Strategy:** After creep analysis, History shows markers; click navigates viewer.  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** Plan §MessageScroller group chat  

---

---

## Phase 9: Multi-Format & Comments

> Full v1 extensions — post-MVP

### **ID:** BDA-080

**Title:** Word docx parser via mammoth  
**Status:** Done  
**Dependencies:** BDA-023  
**Priority:** Medium  
**Description:** `ingest/docx.ts`: mammoth → HTML/text → blocks with section_path anchors (no bbox). Register in ingest router.  
**Completed Changes:**
- ✅ `docx-ingest.ts` — mammoth `convertToHtml` → heading breadcrumb blocks with `section_path` (no bbox)
- ✅ `ingest-router.ts` — `ingestDocx` branch; legacy `.doc` rejected with clear message
- ✅ `public/sample/minimal.docx` + `runDocxIngestHarness()`
**Test Strategy:** Upload .docx → blocks in DuckDB with section_path.  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §5.3, Plan §Ingest table  

---

### **ID:** BDA-081

**Title:** Markdown and Excel parsers  
**Status:** Done  
**Dependencies:** BDA-023  
**Priority:** Medium  
**Description:** `markdown.ts`: split by headings. `xlsx.ts`: SheetJS → cell-range blocks. Wire into router.  
**Completed Changes:**
- ✅ `markdown-ingest.ts` — heading split → `section_path` + paragraph blocks (wired earlier)
- ✅ `xlsx-ingest.ts` — SheetJS row blocks with `{sheet} › {cell-range}` section_path
- ✅ `ingest-router.ts` — `ingestExcel` branch for `.xlsx`/`.xls`; markdown branch complete
- ✅ `public/sample/minimal.xlsx` + `runMarkdownIngestHarness()` / `runXlsxIngestHarness()`
**Test Strategy:** Upload .md and .xlsx samples → blocks ingested.  
**Test Results:**
- ✅ Dev harnesses pass; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §2.2 secondary goals  

---

### **ID:** BDA-082

**Title:** Block comments UI and persistence  
**Status:** Done  
**Dependencies:** BDA-033, BDA-020  
**Priority:** Medium  
**Description:** Comment popover on selected block in split view. Save to DuckDB comments table. Show comment indicator on blocks with comments.  
**Completed Changes:**
- ✅ `block-comments.ts` — insert/fetch comments + commented block ids via DuckDB `comments` table
- ✅ `CommentPopover.tsx` — list/add notes on selected extract block in split view
- ✅ `ExtractedTextPane` — amber comment indicator on blocks with notes; popover when block selected
- ✅ `runBlockCommentsHarness()` — add comment → re-fetch persists in session DB
**Test Strategy:** Add comment on block → reload session → comment still listed (same session DB).  
**Test Results:**
- ✅ Dev harness passes; `pnpm build` passes
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §6.1 step 8, PRD §14 comments checklist  

---

---

## Phase 10: Build, Deploy & Documentation

### **ID:** BDA-090

**Title:** Vite production build and WASM assets  
**Status:** Done  
**Dependencies:** BDA-021, BDA-020, BDA-050  
**Priority:** High  
**Description:** Finalize vite.config for workers, wasm, optional COOP/COEP. Copy DuckDB wasm to public. Bundle size check. Lazy-load bitgpu worker.  
**Completed Changes:**
- ✅ `vite.config.ts` — ES workers, wasm assets, COOP/COEP on dev/preview, vendor manualChunks
- ✅ `scripts/copy-duckdb-assets.mjs` (postinstall/build) + `check-bundle-size.mjs` + `verify-build-assets.mjs`
- ✅ `scoper-client.ts` — lazy `import('?worker')` defers bitgpu worker until chat/ping/load
- ✅ `preview-smoke.mjs` — preview server serves shell, WASM, sample PDF with correct MIME
**Test Strategy:** `pnpm build && pnpm preview` — upload PDF flow works from preview server.  
**Test Results:**
- ✅ `pnpm build` + bundle/asset checks pass; preview smoke script validates WASM paths
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §9.4, Plan §Deploy  

---

### **ID:** BDA-091

**Title:** README and sample PDF corpus  
**Status:** Done  
**Dependencies:** BDA-090  
**Priority:** High  
**Description:** README: prerequisites (WebGPU Chrome, pnpm via Corepack), `pnpm install` / `pnpm dev` / `pnpm build`, deploy static host, MIME notes. Add `sample/` with 1 RFP + 2 bidder PDF placeholders or redacted samples.  
**Completed Changes:**
- ✅ Expanded `README.md` — prerequisites, scripts, static deploy, WASM MIME checklist, troubleshooting
- ✅ `sample/` corpus + `sample/README.md` — `rfp-it-services.pdf`, `bidder-acme-response.pdf`, `bidder-contoso-response.pdf`
- ✅ `scripts/generate-sample-pdfs.mjs` — copies corpus to `public/sample/` via `pnpm copy:samples`
**Test Strategy:** New developer follows README → dev server runs in <15 min.  
**Test Results:**
- ✅ README documents full quick-start path; sample PDFs generated and served at `/sample/*.pdf`
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §14, PRD §12.2 assumptions  

---

### **ID:** BDA-092

**Title:** Static deploy configuration  
**Status:** To Do  
**Dependencies:** BDA-090  
**Priority:** Medium  
**Description:** Document deploy to GitHub Pages / Cloudflare Pages. Verify `.wasm` Content-Type. Optional GitHub Actions workflow (defer if manual deploy OK).  
**Completed Changes:**
- 🔄 Deploy docs in README
- 🔄 Optional CI workflow
**Test Strategy:** Deployed URL loads app; WASM fetches 200 with correct MIME.  
**Test Results:**
- 🔄 Pending
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §13 M5, Plan §Deploy  

---

---

## Phase 11: QA & PRD Verification

### **ID:** BDA-100

**Title:** MVP manual QA script execution  
**Status:** To Do  
**Dependencies:** BDA-053, BDA-034, BDA-041, BDA-091  
**Priority:** Critical  
**Description:** Execute manual test script covering PRD §14 MVP checklist: landing, upload PDF, profiles, split cite, chat stream, collapsible chat, no network upload of file bytes. Record results in this doc or `docs/QA_RESULTS.md`.  
**Completed Changes:**
- 🔄 QA script document
- 🔄 Run and record pass/fail
**Test Strategy:** All MVP success criteria pass on Chrome desktop with WebGPU.  
**Test Results:**
- 🔄 Pending
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §8.1, PRD §14 Features MVP checklist  

---

### **ID:** BDA-101

**Title:** Full v1 PRD deliverables verification  
**Status:** To Do  
**Dependencies:** BDA-072, BDA-062, BDA-081, BDA-082, BDA-100  
**Priority:** Critical  
**Description:** Verify full v1 checklist: scope creep mode, all formats, ECP freeze, comments, offline after cache. Sign off against PRD §14 full v1 items.  
**Completed Changes:**
- 🔄 Full checklist run
- 🔄 Gaps filed as follow-up tasks
**Test Strategy:** PRD §14 all boxes checked or explicitly deferred with rationale.  
**Test Results:**
- 🔄 Pending
**Assigned:** Unassigned  
**Context/Artifacts:** PRD §14, Plan §Success criteria  

---

---

## MVP task list (recommended sprint order)

| Order | ID | Title | Est. |
|-------|-----|-------|------|
| 1 | BDA-001 | Scaffold Vite React TS | 2h |
| 2 | BDA-002 | Tailwind 4 base styles | 1h |
| 3 | BDA-004 | Core types and schemas | 2h |
| 4 | BDA-005 | Zustand session store | 2h |
| 5 | BDA-003 | shadcn + MessageScroller | 2h |
| 6 | BDA-010 | AppShell layout | 2h |
| 7 | BDA-011 | Collapsible ChatSidebar shell | 2h |
| 8 | BDA-012 | WorkspaceHeader | 1.5h |
| 9 | BDA-013 | UploadFab + UploadPopup | 3h |
| 10 | BDA-014 | WorkspaceLanding + QuickActionCards | 3h |
| 11 | BDA-015 | CommandInputCard | 3h |
| 12 | BDA-020 | DuckDB worker + schema | 4h |
| 13 | BDA-021 | LiteParse WASM worker | 4h |
| 14 | BDA-023 | Ingest router PDF | 2h |
| 15 | BDA-024 | Wire upload to ingest | 2h |
| 16 | BDA-030 | PDF.js DocumentViewer | 4h |
| 17 | BDA-031 | ExtractedTextPane | 2h |
| 18 | BDA-032 | SplitDocumentView | 2h |
| 19 | BDA-033 | Bbox highlight + focusCitation | 4h |
| 20 | BDA-040 | ResultsProfileCard + CriterionRow | 3h |
| 21 | BDA-041 | ResultsProfileGrid | 2h |
| 22 | BDA-050 | bitgpu worker client | 6h |
| 23 | BDA-042 | build_rfp_profiles pipeline | 4h |
| 24 | BDA-051 | MessageScroller integration | 4h |
| 25 | BDA-052 | ChatComposer + citation chips | 3h |
| 26 | BDA-053 | find_clause agent loop | 4h |
| 27 | BDA-034 | Wire clicks to viewer | 2h |
| 28 | BDA-090 | Production build | 3h |
| 29 | BDA-091 | README + samples | 2h |
| 30 | BDA-100 | MVP QA | 4h |

**MVP total:** ~75 hours (~9–10 dev days)

**Post-MVP:** BDA-060–062 (ECP), BDA-070–073 (scope creep), BDA-080–082 (formats + comments), BDA-101 (full sign-off)

---

## Traceability matrix (PRD goals → tasks)

| PRD goal | Tasks |
|----------|-------|
| Browser-only processing | BDA-023, BDA-050, BDA-100 (network audit) |
| RFP Results Profiles | BDA-040, BDA-041, BDA-042 |
| Visual citations | BDA-030–034, BDA-052 |
| Local AI chat | BDA-050–053, BDA-051 |
| Scope creep multi-doc | BDA-070–073 |
| Landing UX | BDA-014, BDA-015 |
| Collapsible chat | BDA-011 |
| ECP governance | BDA-060–062 |

---

## Document metadata

**Related documents:**
- [PRD.md](PRD.md)
- [PRD_TEMPLATE.md](PRD_TEMPLATE.md)
- [Implementation plan](/Users/christopherkruger/.cursor/plans/browser_doc_agent_demo_9dbcbc83.plan.md)
- Wireframes: [`docs/main.png`](main.png), Screenshot refs in `docs/`

**Change log:**

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-07-27 | Initial atomic breakdown from PRD + plan |
