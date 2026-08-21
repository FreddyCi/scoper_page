# PRD — Browser Doc Agent Demo
*(Local-first document intelligence in the browser)*

**Author:** Scoper Page team  
**Date:** 2026-07-27  
**Version:** v1.1  
**Status:** Draft  

**Related plan:** [browser_doc_agent_demo_9dbcbc83.plan.md](/Users/christopherkruger/.cursor/plans/browser_doc_agent_demo_9dbcbc83.plan.md)

---

## 1. Overview

Browser Doc Agent Demo is a **standalone, browser-only** web application that lets users upload procurement and project documents (PDF, Word, Markdown, Excel), parse them locally with OCR when needed, and interact with an on-device AI agent to analyze RFP qualification and detect scope creep.

**Problem:** Reviewing RFPs, bidder responses, and change documents is slow, fragmented, and often requires sending sensitive files to cloud LLMs. Finding the exact clause that causes risk requires manual search across long PDFs.

**Primary users:** Delivery leads, proposal managers, and technical reviewers who need to qualify vendors, flag risky clauses, and compare baseline scope against new asks.

**Key outputs:**
- **RFP Results Profiles** — structured qualification cards (Likely / Might / Does not qualify) with pass/warn/fail criteria
- **Scope Creep Profiles** — cross-document drift flags with evidence citations
- **Visual citations** — side-by-side OCR text and original document with synced highlights
- **Local chat** — persistent agent sidebar powered by Bonsai via bitgpu (WebGPU)

**Ecosystem fit:** This is an **independent demo** in `scoper_page`. It does not integrate with Scoper Personal, Scoper Studio, or any Scoper backend. It proves that bitgpu, LiteParse WASM, DuckDB WASM, and ECP browser runtime can work together as a cohesive product experience.

---

## 2. Goals

### 2.1 Primary Goals

1. **Browser-only processing** — All parse, store, infer, and chat run client-side; no server upload of document content.
2. **RFP Results Profiles** — After upload, render qualification cards with criteria checklist, verdict badge, and summary per bidder/response doc.
3. **Visual citations** — Every criterion, flag, or chat answer that references a doc must link to a `CitationRef` and highlight the source in a split OCR | original viewer.
4. **Local AI chat** — Stream responses from Bonsai (bitgpu) in a collapsible sidebar using shadcn MessageScroller without scroll jank.
5. **Multi-doc scope comparison** — Scope Creep mode compares baseline vs change documents and surfaces flags with evidence (full v1).

### 2.2 Secondary Goals

* Word, Markdown, and Excel ingest (beyond PDF MVP)
* User comments anchored to document blocks
* **PDF drawing markup (Mark mode)** — pen, highlighter, shapes, text, and window stamp on plan/elevation PDFs; persisted in session; **burned-in** vector export and share pack v3 round-trip ([`TASK_BREAKDOWN_DRAWING_PDF_MARKUP.md`](TASK_BREAKDOWN_DRAWING_PDF_MARKUP.md))
* **Mark voice notation** — hold Space to dictate field notes on a selected mark; Web Speech API; persisted on `voice_note` with share-pack round-trip ([`TASK_BREAKDOWN_MARK_VOICE_NOTATION.md`](TASK_BREAKDOWN_MARK_VOICE_NOTATION.md))
* IndexedDB session restore for chat KV cache (bitgpu) and workspace state
* Model picker (Bonsai 1.7B default, 4B optional)
* Voice input on composer (defer post-MVP)

---

## 3. Non-Goals

This PRD **does not** define:

* Integration with Scoper Personal, Scoper Studio, Tauri, Bun server, or Temporal workflows
* User accounts, authentication, or cloud sync
* Server-side inference, public API, or MCP server exposure
* Legal verdicts or guaranteed compliance — outputs are **assistant flags**, not certified audits
* DOCX/XLSX conversion via LiteParse native CLI (browser uses client-side parsers only)
* Mobile-native apps or offline-first PWA install flow (offline after cache is acceptable, not a dedicated PWA product)
* **Drawing markup (v1 scope limits):** AI window detection; multi-user realtime ink sync; full Adobe Acrobat ink compatibility; drawing tools on non-PDF previews; arbitrary color picker; native PDF Ink annotations for the drawing layer (burned-in vectors are primary)
* Production SLA, multi-tenant hosting, or enterprise admin

---

## 4. Users & Personas

### 4.1 Delivery Lead (Primary)

**Role:** Owns delivery planning and scope integrity for client engagements  
**Needs:** Quickly understand if a bidder meets RFP requirements; spot scope additions before they become change orders  
**Pain Points:** Manual clause hunting in 100+ page PDFs; cloud paste privacy concerns; repetitive doc review across email threads  
**Success Criteria:** Finds a risky clause in under 2 minutes with a visible highlight; can explain *why* a bidder is borderline using structured criteria

### 4.2 Proposal / Bid Manager (Secondary)

**Role:** Evaluates multiple vendor responses against one RFP  
**Needs:** Side-by-side qualification comparison across bidders  
**Pain Points:** Spreadsheet-driven checklists disconnected from source text  
**Success Criteria:** Results Profile grid shows 3+ bidders with pass/warn/fail at a glance; click-through to source evidence

### 4.3 Technical Reviewer (Secondary)

**Role:** Validates technical requirements in procurement docs  
**Needs:** Ask natural-language questions (*"where does it require CMMI Level 3?"*) and jump to exact sections  
**Pain Points:** Ctrl+F misses context; scanned PDFs have no selectable text without OCR  
**Success Criteria:** OCR + citation highlight works on scanned PDFs; chat cites `block_id` consistently

---

## 5. System Components

### 5.1 UI Shell (Vite + React + TypeScript)

**Purpose:** Two-column application shell and workspace state management  

**Key features:**
* Workspace (~65%) + collapsible Agent sidebar (~35%) per [`docs/main.png`](main.png)
* Workspace modes: Landing, Profiles grid, SplitDocumentView drill-in
* Session header: name dropdown, mode toggle (RFP / Scope Creep), doc tabs
* Bottom-left UploadFab → multi-file upload popup
* Zustand session store for docs, profiles, selection, chat collapse state

**Technologies:** Vite 7, React 19, TypeScript, Tailwind 4, shadcn/ui, Zustand, pnpm  
**Dependencies:** None on Scoper repos

---

### 5.2 Landing & Command Center

**Purpose:** First-run and empty-state experience  

**Key features:**
* Greeting + fanned quick-action cards: Analyse RFP, Check scope creep, Upload docs ([`Screenshot 2026-07-27 at 2.51.53 PM.png`](Screenshot%202026-07-27%20at%202.51.53%E2%80%AFPM.png))
* Command input card with file stack pill, paperclip, settings, model picker, send ([`Screenshot 2026-07-27 at 2.49.33 PM.png`](Screenshot%202026-07-27%20at%202.49.33%E2%80%AFPM.png))
* Submit with attachments → parse → transition to Profiles or split view

**Technologies:** React components (`WorkspaceLanding`, `CommandInputCard`, `QuickActionCards`)  
**Dependencies:** Upload popup, ingest pipeline

---

### 5.3 Document Ingest & Storage

**Purpose:** Parse uploaded files into queryable blocks with optional bounding boxes  

**Key features:**
* Multi-format router: PDF, .docx, .md, .xlsx
* LiteParse WASM for PDF (+ tesseract.js OCR worker for scanned pages)
* mammoth, SheetJS, markdown splitter for non-PDF
* DuckDB WASM in-memory schema: documents, blocks, profiles, flags, comments

**Technologies:** `@llamaindex/liteparse-wasm`, `@duckdb/duckdb-wasm`, `tesseract.js`, `mammoth`, `xlsx`, Web Workers  
**Dependencies:** Static WASM/worker assets in `public/duckdb/`

---

### 5.4 Visual Citation Viewer

**Purpose:** Show extracted text beside original document with synced highlights  

**Key features:**
* SplitDocumentView: light left (OCR/blocks) | dark right (PDF.js / doc preview) ([`Screenshot 2026-07-27 at 2.50.23 PM.png`](Screenshot%202026-07-27%20at%202.50.23%E2%80%AFPM.png))
* Bbox overlay on PDF from LiteParse `textItems` (scale `dpi/72`)
* **View | Mark** toggle on PDF original pane: Mark mode drawing toolbar (brand palette, stroke widths); block citation drag disabled while marking
* Annotated PDF export: toggleable block-comment markup, burned-in notes, optional **drawing marks** merge (rose export menu section when marks exist)
* `focusCitation(ref)` scrolls and highlights both panes
* Comment popover on selected block

**Technologies:** PDF.js, canvas overlay, LiteParse visual citations  
**Dependencies:** Ingest pipeline, CitationRef contract

---

### 5.5 RFP Results Profiles

**Purpose:** Structured bidder qualification output in workspace  

**Key features:**
* `RfpResultsProfile` per response doc: verdict, subject, criteria[], summary
* Criterion status: pass | warn | fail with optional detail and citation
* ResultsProfileGrid (multi-column cards); CriterionRow click → drill-in
* Generated via `document.build_rfp_profiles` + bitgpu JSON schema mode

**Technologies:** React card components, bitgpu constrained JSON  
**Dependencies:** RFP requirements extract, DuckDB persistence

---

### 5.6 Scope Creep Profiles

**Purpose:** Cross-document drift analysis  

**Key features:**
* Doc roles: baseline | change_request | supporting
* `ScopeCreepProfile` with flags (severity, summary, evidence cites)
* CreepProfileGrid in workspace; flags as MessageScroller markers in chat History
* Tools: `document.compare_scope`, `document.flag_creep`

**Technologies:** Same profile card pattern as RFP; ECP-governed tools  
**Dependencies:** Multi-doc ingest, baseline tagging UI

---

### 5.7 Agent & Chat (bitgpu + ECP)

**Purpose:** Local LLM conversation with tool calling and policy-governed actions  

**Key features:**
* bitgpu Bonsai in Web Worker; streaming via `onText` into MessageScroller
* ChatSidebar: Agent / History tabs, citation chips, collapsible
* ECP browser runtime: `@demo/*` extensions, `registry-control` policy, freeze before run
* Tools: search, find_clause, build_rfp_profiles, compare_scope, flag_creep

**Technologies:** [bitgpu](https://github.com/stfurkan/bitgpu), [@executioncontrolprotocol/browser](https://github.com/GuillaumeCleme/executioncontrolprotocol) v0.0.10, [MessageScroller](https://ui.shadcn.com/docs/components/base/message-scroller)  
**Dependencies:** WebGPU-capable browser; ~290MB model download (cached)

---

## 6. Workflows

### 6.1 RFP Analysis (Primary)

**Trigger:** User selects **Analyse RFP** or uploads RFP + bidder docs in RFP mode  

**Steps:**

1. User attaches files via command input, paperclip, or UploadFab popup
2. System parses each doc (OCR if scanned PDF) → DuckDB blocks
3. Agent extracts RFP requirement checklist
4. `build_rfp_profiles` produces `RfpResultsProfile[]` with criteria + citations
5. Workspace renders ResultsProfileGrid
6. User clicks criterion or asks in chat *"find indemnification clause"*
7. `find_clause` returns `CitationRef` → SplitDocumentView highlights both panes
8. User adds optional comment on block

**Expected outcome:** User sees qualification verdict per bidder and can navigate to exact source clauses in seconds  

**Edge cases:** Missing bidder name → generic profile from filename; OCR low confidence → warn badge on criterion; WebGPU unavailable → banner + degraded read-only parse view

---

### 6.2 Scope Creep Analysis

**Trigger:** User selects **Check scope creep** and uploads baseline + change docs  

**Steps:**

1. User tags docs: baseline SOW vs change request / addendum
2. Parse all → extract deliverables, requirements, exclusions per doc
3. User asks *"Does the March addendum expand scope?"*
4. `compare_scope` / `flag_creep` returns flags with evidence cites
5. CreepProfileGrid + chat markers show results
6. Click flag → SplitDocumentView highlights evidence in both docs

**Expected outcome:** User receives actionable creep flags with linked evidence, not a vague yes/no  

**Edge cases:** Ambiguous baseline → prompt user to confirm role; conflicting doc versions → show both cites

---

### 6.3 Empty → Loaded Transition

**Trigger:** First visit or new session with no documents  

**Steps:**

1. Workspace shows WorkspaceLanding (greeting, quick actions, command card)
2. User attaches files and submits task
3. Parse progress in upload popup / status footer pill
4. Workspace transitions to Profiles or SplitDocumentView
5. Chat sidebar streams analysis summary

**Expected outcome:** Clear progression from marketing-style landing to working analysis UI  

**Edge cases:** Chat collapsed → command card is sole input; parse failure → inline error on affected file

---

## 7. User Stories

### Must-Have (P0)

1. **As a** delivery lead, **I want** to upload PDFs without sending them to a server, **so that** client data stays on my machine.
2. **As a** bid manager, **I want** qualification cards with pass/warn/fail criteria, **so that** I can compare bidders at a glance.
3. **As a** reviewer, **I want** to click a criterion and see the exact clause highlighted, **so that** I don't manually search the PDF.
4. **As a** user, **I want** a persistent chat sidebar with streaming replies, **so that** I can ask follow-up questions while viewing results.
5. **As a** user, **I want** side-by-side OCR text and original document view, **so that** I trust the extraction matches the source.

### Should-Have (P1)

1. **As a** delivery lead, **I want** scope creep flags across multiple docs, **so that** I catch out-of-scope asks before sign-off.
2. **As a** user, **I want** to collapse the chat panel, **so that** I get full workspace width for profile comparison.
3. **As a** user, **I want** to comment on a highlighted block, **so that** I can capture review notes in session.
4. **As a** user, **I want** Word and Excel support, **so that** I'm not limited to PDF-only workflows.

### Could-Have (P2)

1. **As a** user, **I want** voice input on the composer, **so that** I can dictate questions hands-free.
2. **As a** user, **I want** session restore after reload, **so that** long chats don't require re-prefill.

---

## 8. Success Metrics

### 8.1 Demo completeness (MVP)

* **Metric:** MVP success criteria checklist completion
* **Target:** 100% of MVP items in Section 14 passed
* **Measurement:** Manual QA script before demo release

### 8.2 Citation accuracy (qualitative)

* **Metric:** Click-through from criterion to correct page/region (PDF)
* **Target:** Correct highlight on 8/10 sample clauses in test RFP pack
* **Measurement:** Internal test corpus of 3 sample PDFs

### 8.3 Performance

* **Metric:** First interactive paint (shell + landing)
* **Target:** < 3s on modern desktop Chrome
* **Measurement:** Lighthouse / manual timing

* **Metric:** PDF parse time (10-page text PDF)
* **Target:** < 10s including DuckDB ingest
* **Measurement:** Console timing in dev build

* **Metric:** Chat stream start after user message
* **Target:** First token < 5s after Bonsai model cached
* **Measurement:** bitgpu `onText` timestamp

### 8.4 Privacy

* **Metric:** Network requests carrying uploaded file bytes
* **Target:** Zero (except Bonsai model weight CDN fetch)
* **Measurement:** DevTools network audit during upload + analyze flow

---

## 9. Technical Requirements

### 9.1 Platform & Environment

* **Deployment:** Static SPA (Vite build → any static host)
* **Package manager:** pnpm (Corepack-enabled; lockfile committed)
* **Browser support:** Chrome/Edge 120+ (WebGPU primary); Safari 26+; Firefox (degraded throughput)
* **Runtime:** Modern ES modules; Web Workers for bitgpu, LiteParse, DuckDB, OCR
* **Hardware:** WebGPU-capable GPU; 8GB+ RAM recommended for Bonsai 1.7B

### 9.2 Architecture

* **Pattern:** Single-page client application; no backend API
* **Data flow:** Upload → Workers (parse) → DuckDB → ECP agent tools → bitgpu → UI (profiles, viewer, chat)
* **Integrations:** bitgpu (HF CDN weights), LiteParse WASM, DuckDB WASM, ECP npm packages — all client-side

See architecture diagram in [implementation plan](/Users/christopherkruger/.cursor/plans/browser_doc_agent_demo_9dbcbc83.plan.md).

### 9.3 Security & Privacy

* **Authentication:** None (local demo)
* **Data storage:** In-memory DuckDB; optional IndexedDB for session/chat cache; no server persistence
* **Network:** Model weights from CDN; disable DuckDB remote extensions (`allow_community_extensions = false`)
* **Privacy:** Documents never leave the browser except user-initiated export (future)

### 9.4 Performance Targets

* **Initial load:** Shell + landing < 3s
* **Model first load:** ~290MB download once; Cache Storage thereafter
* **Chat streaming:** MessageScroller autoScroll without layout thrash on 50+ turns
* **Long threads:** `content-visibility: auto` on MessageScroller items; virtualization deferred

### 9.5 Data Requirements

**Entities:** documents, blocks, results_profiles, profile_criteria, scope_flags, comments  

**Citation contract:**

```ts
type CitationRef = {
  doc_id: string
  block_id: string
  page_num?: number
  bbox?: { x: number; y: number; width: number; height: number }
  excerpt: string
  confidence?: number
}
```

**Storage:** DuckDB WASM in-memory only for v1; no file export of DB required for MVP

---

## 10. Design & UX Requirements

### 10.1 Design Principles

* **Local-first transparency** — Copy and UI state clearly that processing runs on-device
* **Evidence over prose** — Structured profiles and citations before long chat paragraphs
* **Workspace-first results** — Profiles and split viewer dominate; chat supports don't replace
* **Minimal chrome** — Rounded panels, light gray canvas, collapsible chat (refs in `docs/`)
* **Assistant not authority** — Labels like "assistant flags"; no "verified by" badges

### 10.2 Key Screens/Views

| View | Purpose |
|------|---------|
| **WorkspaceLanding** | Greeting, quick actions, command input with file stack |
| **ResultsProfileGrid** | RFP qualification cards (Likely / Might / Does not qualify) |
| **CreepProfileGrid** | Scope drift flags with severity |
| **SplitDocumentView** | OCR text \| original doc, synced highlights |
| **ChatSidebar** | MessageScroller transcript, History, composer |
| **UploadPopup** | Multi-file drop from FAB or paperclip |

### 10.3 Mockups/Wireframes

| Asset | Path |
|-------|------|
| App shell | [`docs/main.png`](main.png) |
| Landing + quick actions | [`docs/Screenshot 2026-07-27 at 2.51.53 PM.png`](Screenshot%202026-07-27%20at%202.51.53%E2%80%AFPM.png) |
| Command center input | [`docs/Screenshot 2026-07-27 at 2.49.33 PM.png`](Screenshot%202026-07-27%20at%202.49.33%E2%80%AFPM.png) |
| Split preview card | [`docs/Screenshot 2026-07-27 at 2.50.23 PM.png`](Screenshot%202026-07-27%20at%202.50.23%E2%80%AFPM.png) |
| RFP results profiles (dark cards) | Prior mock — qualification grid with pass/warn/fail |

---

## 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| WebGPU unavailable | High | Medium | Clear fallback banner; parse-only mode without chat |
| Bonsai 1-bit weak tool judgment | High | High | Force JSON schema for profiles; small tool set; `toolChoice` for extract |
| LiteParse WASM PDF-only | Medium | Certain | Client parsers for Word/MD/Excel; section anchors vs bbox |
| OCR quality on scans | Medium | Medium | tesseract.js worker; confidence on cites; manual block select |
| ECP + bitgpu loop undocumented | High | Medium | Spike early; follow bitgpu worker + ECP demo environment |
| Large model download friction | Medium | High | Progress UI; "works offline after first load" copy |
| Scope creep subjective | Medium | High | Evidence-linked flags; disclaimers; no legal claims |
| Imperative complexity in citation sync | Medium | Medium | `citation-bridge.ts` single owner; typed CitationRef |

---

## 12. Dependencies & Assumptions

### 12.1 Dependencies

**External packages:**
* bitgpu ^0.19.1
* @llamaindex/liteparse-wasm
* @duckdb/duckdb-wasm
* @executioncontrolprotocol/browser, policies, core @ 0.0.10
* shadcn message-scroller, message, tabs, badge, card
* pdfjs-dist, mammoth, xlsx, tesseract.js

**External services:**
* Hugging Face / jsDelivr for Bonsai model weights (first load)
* Static host with correct `.wasm` MIME types

**Internal:**
* None — standalone repo folder `scoper_page`

### 12.2 Assumptions

* Users have WebGPU-capable Chrome/Edge on desktop
* Users accept ~290MB one-time model download
* Sample RFP/bidder PDFs provided in repo for demo QA
* ECP npm packages remain compatible at 0.0.10 during build
* 1-bit Bonsai sufficient for demo; not production legal review

---

## 13. Timeline & Milestones

| Milestone | Target | Deliverables |
|-----------|--------|--------------|
| **M1: Shell + Landing** | +3 days | AppShell, WorkspaceLanding, CommandInputCard, collapsible chat, UploadFab |
| **M2: Ingest + Viewer** | +6 days | LiteParse, DuckDB, SplitDocumentView, OCR worker, PDF highlights |
| **M3: RFP MVP** | +9 days | Results Profiles, bitgpu chat, citations, find_clause |
| **M4: Scope Creep** | +12 days | Multi-doc roles, CreepProfileGrid, flag tools |
| **M5: Full v1** | +17 days | ECP extensions, Word/MD/Excel, comments, README, static deploy |

**MVP cutoff (M3):** PDF-only, RFP mode, profiles + citations + chat — defer scope creep and non-PDF formats.

---

## 14. Deliverables

**Documentation:**
- [x] PRD (this document)
- [x] README with local dev (`pnpm install`, `pnpm dev`) + static deploy instructions
- [x] Architecture summary (link to plan) — [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)

**Code & Infrastructure:**
- [x] Vite + React + TS codebase per project scaffold
- [x] Web Workers: bitgpu, liteparse, duckdb, ocr
- [x] Static build artifact deployable to GitHub Pages / Cloudflare Pages
- [x] Sample PDFs in `sample/`

**Features (MVP checklist):**
- [x] Self-contained in `scoper_page`; zero Scoper repo changes
- [x] Landing: greeting, quick actions, command input with file stack
- [x] RFP Results Profiles with pass/warn/fail + verdict badge
- [x] SplitDocumentView: OCR \| original with synced highlight
- [x] Click criterion or chat cite → focus source clause
- [x] MessageScroller chat with bitgpu streaming
- [x] Upload FAB popup; collapsible chat sidebar
- [x] ECP tool validation; registry frozen before agent run
- [x] Offline-capable after model + WASM cache

**Features (Full v1 additions):**
- [x] Scope Creep profiles + multi-doc
- [x] Word / Markdown / Excel parsers
- [x] Block comments persisted in session
- [x] Full `@demo/*` ECP extension set

**Testing:**
- [x] Manual QA script for MVP flows
- [x] Sample RFP pack (3 PDFs) for citation spot-checks

---

## 15. Open Questions

1. **Default deploy target URL?**  
   **Decision Maker:** Product owner  
   **Due Date:** Before M5  
   **Status:** Open

2. **Include dark mode in v1 or light-only matching mockups?**  
   **Decision Maker:** Design  
   **Due Date:** M1  
   **Status:** Open (RFP profile mock is dark; landing refs are light)

3. **Persist sessions across browser reload (IndexedDB) in MVP or full v1?**  
   **Decision Maker:** Engineering  
   **Due Date:** M3  
   **Status:** Open — bitgpu chat.save/restore desirable but optional for MVP

4. **Minimum supported PDF page count for demo SLA?**  
   **Decision Maker:** Engineering  
   **Due Date:** M2  
   **Status:** Open — propose 50 pages soft limit with progress UI

---

## 16. Future Enhancements (v2.0+)

* Server-optional sync export (share profile JSON + cites, not raw docs)
* PWA install + explicit offline mode messaging
* Voice input and multi-language OCR
* Custom RFP criteria templates (user-defined schemas)
* Batch ZIP upload
* Comparison export to PDF/CSV
* Integration hook for external products (optional; not Scoper-coupled by default)

---

## 17. Appendix

### 17.1 Glossary

* **Results Profile** — Structured RFP qualification card for one bidder/response
* **Creep Profile** — Scope drift summary comparing baseline vs candidate docs
* **CitationRef** — Pointer to a doc block with optional bbox for visual highlight
* **MessageScroller** — shadcn chat scroll container optimized for streaming LLM output
* **bitgpu** — WebGPU runtime for Bonsai low-bit LLMs in the browser
* **ECP** — Execution Control Protocol; governs agent tool calls via frozen policies
* **LiteParse WASM** — Browser PDF parser producing textItems with bounding boxes

### 17.2 References

* [Implementation plan](/Users/christopherkruger/.cursor/plans/browser_doc_agent_demo_9dbcbc83.plan.md)
* [bitgpu](https://github.com/stfurkan/bitgpu)
* [LiteParse browser usage](https://developers.llamaindex.ai/liteparse/guides/browser-usage/)
* [LiteParse visual citations](https://developers.llamaindex.ai/liteparse/guides/visual-citations/)
* [DuckDB WASM deploy](https://duckdb.org/docs/lts/clients/wasm/deploying_duckdb_wasm)
* [ECP browser policy](https://github.com/GuillaumeCleme/executioncontrolprotocol/blob/development/docs/ecp-browser-review-policy.md)
* [shadcn MessageScroller](https://ui.shadcn.com/docs/components/base/message-scroller)

### 17.3 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.2 | 2026-08-21 | — | Secondary goal: hold-Space mark voice notation (BDA-242–258) |
| v1.1 | 2026-08-03 | — | Secondary goal: PDF Mark drawing markup; viewer + export notes; scoped non-goals for drawing v1 (BDA-241) |
| v1.0 | 2026-07-27 | — | Initial PRD from browser_doc_agent_demo plan + UI refs |

---

## Document Metadata

**Stakeholders:**
- **Owner:** Browser Doc Agent Demo (scoper_page)
- **Contributors:** Engineering
- **Reviewers:** —
- **Approvers:** —

**Related Documents:**
- Template: [`docs/PRD_TEMPLATE.md`](PRD_TEMPLATE.md)
- Plan: [`browser_doc_agent_demo_9dbcbc83.plan.md`](/Users/christopherkruger/.cursor/plans/browser_doc_agent_demo_9dbcbc83.plan.md)
- Drawing markup tasks: [`TASK_BREAKDOWN_DRAWING_PDF_MARKUP.md`](TASK_BREAKDOWN_DRAWING_PDF_MARKUP.md) (BDA-220–241)
- Mark voice notation: [`TASK_BREAKDOWN_MARK_VOICE_NOTATION.md`](TASK_BREAKDOWN_MARK_VOICE_NOTATION.md) (BDA-242–258)
- Wireframes: [`docs/main.png`](main.png), [`docs/Screenshot 2026-07-27 at 2.49.33 PM.png`](Screenshot%202026-07-27%20at%202.49.33%E2%80%AFPM.png), [`docs/Screenshot 2026-07-27 at 2.51.53 PM.png`](Screenshot%202026-07-27%20at%202.51.53%E2%80%AFPM.png), [`docs/Screenshot 2026-07-27 at 2.50.23 PM.png`](Screenshot%202026-07-27%20at%202.50.23%E2%80%AFPM.png)
