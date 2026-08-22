# Scoper Scout — guided onboarding

**Status:** Implemented — automated QA pass; peer manual UI pending ([TASK_BREAKDOWN_SCOPER_SCOUT.md](../TASK_BREAKDOWN_SCOPER_SCOUT.md) BDA-302)  
**Created:** 2026-08-21  
**Task IDs:** BDA-277–309  

**Scoper Scout** is the **workspace-column onboarding coach** for first-time visitors: three spotlight-guided journeys with real “Do this” actions, bundled construction samples, resume state, and optional company profile onboarding. It is **not** get_scoper integration Scout, Studio Data Scout, or a third-party tour library.

**Source breakdown:** [TASK_BREAKDOWN_SCOPER_SCOUT.md](../TASK_BREAKDOWN_SCOPER_SCOUT.md)  
**GTM wedge:** [gtm/tam.md](../gtm/tam.md) Stage 1 — commercial subs qualifying bids and drafting proposals locally.

---

## Naming

| Term | Meaning |
|------|---------|
| **Scoper Scout** | Product feature — panel + spotlight + journeys (this doc) |
| **Scout panel** | Collapsible sidebar in the workspace column (`ScoutPanel.tsx`) |
| **Scout launcher** | Header MapPin control — reopen panel or resume mid-journey |
| **Journey** | One guided tour (`evaluate_rfp`, `generate_proposal`, `mark_takeoff`) |
| **Step** | Single checklist item with copy, optional spotlight target, and action |
| **Company profile** | Structured questionnaire → `scoper.company-profile.v1` + derived `companyContext` |

---

## Journeys (v1)

Each journey loads **bundled samples** from `public/sample/` so users can finish without uploading. Starting a new journey with existing documents shows a **confirm dialog** before `resetSession()`.

### Journey A — Evaluate an RFP (`evaluate_rfp`)

**Accent:** emerald / sky · **9 steps**

| Step | User outcome |
|------|----------------|
| Welcome | Privacy + on-device model download note |
| Load sample | DPR MSA + contract keyword checklist ingested |
| Open evaluation | Profiles workspace + eval panel |
| Run qualification | Bidder criteria with citations |
| Read criterion | Jump to cited clause in viewer |
| Compliance matrix | Shall/must grid |
| Instructions | Solicitation meta card |
| Export CSV | Matrix download |
| Done | Share / upload next steps |

**Sample loaders:** `loadSampleEvaluationWorkspace()` — MSA PDF + checklist DOCX.

### Journey B — Generate a proposal (`generate_proposal`)

**Accent:** violet · **6 steps**

| Step | User outcome |
|------|----------------|
| Load sample | Solicitation PDF + buyer rubric markdown |
| Company profile | Questionnaire CTA → responder context (`company-profile-setup` target) |
| Build profile | Requirements / volume structure from RFP |
| Generate volume | One sectional draft with find-clause retrieval |
| Export markdown | Drafted volumes as `.md` |
| Done | Upload real solicitation or switch tours |

**Sample loaders:** `loadSampleProposalWorkspace()` — pre-fills context if empty.

### Journey C — Mark / takeoff (`mark_takeoff`)

**Accent:** rose · **7 steps**

| Step | User outcome |
|------|----------------|
| Load sample | Plan PDF (`windows-drawing.pdf`) + optional seeded stamps |
| Mark mode | PDF markup toolbar |
| Place stamps | Window stamp tool |
| Takeoff panel | Sheet counts from stamps |
| Jump to mark | Viewer focuses stamped region |
| Export CSV | Takeoff spreadsheet |
| Done | Upload own plan or switch tours |

**Sample loaders:** `loadSampleMarkupWorkspace({ seedStamps: true })`.

---

## Company profile onboarding (Phase 8)

Structured onboarding via shadcn **Questionnaire** (`CompanyOnboardingQuestionnaire`):

- **First visit** — dismissible “Tell us about your company” dialog (does not block upload)
- **Proposal setup** — “Complete company profile” CTA when responder context is empty; freeform edit after submit
- **Evaluation setup** — “Edit company profile” link on org context
- **Serializer** — `companyProfileToContext()` → `session.companyContext` for proposal readiness, RFP relink, chat

**Persistence:** `localStorage` key `scoper.company-profile.v1` (profile, `completedAt`, `onboardingStep`, `onboardingPromptDismissed`). No cloud sync in v1.

---

## Product rules

| Rule | Behavior |
|------|----------|
| **Active coach** | Primary button runs real actions (`runScoutAction`) — not fake UI tours |
| **Spotlight** | `[data-scout-target]` cutout; step instructions stay in panel for a11y |
| **Workspace only** | Scout panel lives in workspace column, not chat sidebar |
| **Resume** | `scoper.scout.v1` — journey + step index survive reload |
| **Dismiss** | “Don’t show again” stops auto-open; header launcher still works |
| **No silent wipe** | Confirm before reset when documents exist |
| **Sample-first** | Each journey can complete without user uploads |

---

## Copy guidelines

- **Construction wedge** — subs, GC partners, shall/must compliance, envelope / fall protection examples (Pro-Bel-style fixtures).
- **Privacy** — “stays in this browser”, “on your machine”, no server upload of doc bytes.
- **WebGPU** — first AI run may download ~290 MB Bonsai weights; degraded path when WebGPU unavailable.
- **Tone** — coach, not marketing deck; short step titles + one paragraph body per step.
- **Company profile** — “responder context” in proposal mode; “buyer org” framing in evaluation mode.

---

## Architecture (summary)

| Area | Path |
|------|------|
| Store | `src/store/scout-store.ts` (`scoper.scout.v1`) |
| Journeys | `src/lib/scout/journeys/*.ts` |
| Actions | `src/lib/scout/actions.ts` |
| Completion | `src/lib/scout/completion.ts` |
| Targets | `src/lib/scout/targets.ts` |
| UI | `ScoutProvider`, `ScoutPanel`, `ScoutSpotlight`, `ScoutJourneyPicker` |
| Company profile | `src/store/company-profile-store.ts`, `src/lib/company-profile/` |
| Dev harnesses | `src/services/scout-dev-harnesses.ts`, `company-profile-dev-harnesses.ts` |

---

## Explicit non-goals (v1)

- Server analytics or tour completion telemetry
- Driver.js / Intro.js / third-party tour libraries
- Full share-pack demo import for Journey A (optional v1.1)
- Tauri-only Scout shell
- get_scoper `scout-chat` translation
- LLM-driven dynamic tour narration
- i18n
- Cloud-synced company profile / auth accounts
- Blocking modal that prevents upload until profile complete

---

## QA

| Command | Purpose |
|---------|---------|
| `pnpm qa:scout` | Static wiring + `tsc -b` (BDA-300) |
| `pnpm qa:company-profile` | Company onboarding static checks (BDA-309) |
| `pnpm dev` | Runtime dev harness chain — no `[dev-harness]` throw |

Manual checklist: [TASK_BREAKDOWN_SCOPER_SCOUT.md § BDA-302](../TASK_BREAKDOWN_SCOPER_SCOUT.md#manual-qa-checklist-bda-302).

---

## Related documents

- [PRD.md](../PRD.md) §6.3, §7 P1
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [TASK_BREAKDOWN.md](../TASK_BREAKDOWN.md)
