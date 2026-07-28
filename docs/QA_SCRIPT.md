# MVP manual QA script (BDA-100)

Execute on **Chrome or Edge 120+ desktop** with **WebGPU** enabled. Use a clean profile or incognito to avoid stale cache unless testing offline/cached model.

**Sample files:** `public/sample/rfp-it-services.pdf`, `bidder-acme-response.pdf`, `bidder-contoso-response.pdf`

**Record results in:** [`QA_RESULTS.md`](QA_RESULTS.md)

---

## Environment setup

| Step | Action | Expected |
|------|--------|----------|
| E1 | `corepack enable && pnpm install && pnpm dev` | Dev server at `http://localhost:5173`, no install errors |
| E2 | Open DevTools → Console | No red errors on load (dev harness may log `[dev-harness]` success) |
| E3 | Confirm WebGPU | No amber banner, OR banner shows if GPU unavailable (parse-only still OK) |

---

## PRD §14 — MVP feature checklist

### F1 — Self-contained demo

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F1.1 | Load app from local dev or `pnpm preview` | Shell renders without external API keys |
| F1.2 | Confirm repo is standalone `scoper_page` | No backend server required |

### F2 — Landing experience

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F2.1 | Open `/` | Greeting, three quick-action cards, command input visible |
| F2.2 | Click **Analyse RFP** | Mode set to RFP; upload popup opens |
| F2.3 | Click **Upload docs** FAB (bottom-left) | Upload popup opens; accept `.pdf` |
| F2.4 | Attach file in command input (paperclip) | File appears in stack before submit |

### F3 — Upload & parse PDF (local-only)

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F3.1 | Upload `rfp-it-services.pdf` via popup | Status → Ingested; doc tab appears |
| F3.2 | Upload both bidder PDFs | Three documents in session |
| F3.3 | **Privacy audit:** DevTools → Network, filter during upload | **No POST/PUT** of PDF bytes to third-party origins (only localhost static + optional model CDN on chat) |
| F3.4 | Open **Extract** tab on a doc | Block list populated (>0 blocks) |

### F4 — RFP Results Profiles

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F4.1 | After upload, view navigates to profiles OR click **Qualify** / profiles view | Profile grid visible |
| F4.2 | Inspect Acme vs Contoso cards | Verdict badges differ; criteria show pass/warn/fail |
| F4.3 | Expand a criterion row | Detail text and status color visible |

### F5 — Split view & citation focus

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F5.1 | Click a criterion with citation | Split view opens; PDF viewer shows document |
| F5.2 | Verify **Extract** + **Original** tabs | Extract shows block text; Original shows PDF page |
| F5.3 | Click citation chip in chat (after F6) | Same block highlighted / page navigates |

### F6 — Chat sidebar & streaming

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F6.1 | Send prompt: `find indemnification` (or any clause in corpus) | User message appears; assistant streams text |
| F6.2 | Observe assistant message | Markdown renders (headings/tables not raw `##` syntax) |
| F6.3 | Citation chips on assistant message | Chips clickable → split view (F5.3) |
| F6.4 | First chat only: model download | Progress/loading state; eventual response (may take minutes first run) |

### F7 — Collapsible chat

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F7.1 | Collapse chat panel (header control) | Chat hides; workspace widens |
| F7.2 | Command input on landing/main still works when chat collapsed | Can submit prompt / upload |
| F7.3 | Re-expand chat | Prior messages still visible |

### F8 — ECP / agent governance (MVP)

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F8.1 | Dev console: `[dev-harness]` completes without throw | ECP env + agent run harness pass |
| F8.2 | Tool call path uses `@demo/document.find_clause` | No unvalidated arbitrary fetch from agent |

### F9 — Production build smoke

| ID | Steps | Pass criteria |
|----|--------|---------------|
| F9.1 | `pnpm build` | Exit 0; bundle + asset checks pass |
| F9.2 | `pnpm preview` + open app | Same flows as F2–F4 work from production bundle |
| F9.3 | `pnpm preview:smoke` | WASM paths return 200 + WASM MIME |

---

## PRD §8.1 — Success metrics (spot checks)

| Metric | How to measure | Target |
|--------|----------------|--------|
| MVP checklist | All F1–F9 rows Pass | 100% |
| Citation accuracy | Click 3 criteria on sample pack | Correct doc + plausible excerpt |
| Shell load time | Performance tab, hard reload | < 3s to interactive landing |
| Privacy | F3.3 network audit | Zero upload of file bytes off-origin |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA executor | | | Pass / Fail |
| Notes | | | |

---

## Automated pre-check (before manual walkthrough)

```bash
pnpm build
pnpm preview:smoke
```

Dev harness chain (runs automatically in `pnpm dev` console): see [`QA_RESULTS.md`](QA_RESULTS.md) mapping.
