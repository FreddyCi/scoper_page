# Sample document corpus

Redacted, synthetic procurement documents for local demo and QA. **Not real contracts** — text is fabricated for parser, RFP profile, and citation testing.

Files are copied to `public/sample/` during `pnpm install` / `pnpm dev` / `pnpm build` so the app can fetch them at `/sample/...`.

## Construction evaluation pack (Scout evaluate journey)

| File | Role | Use in app |
|------|------|------------|
| [`dpr-construction-msa-2025.pdf`](dpr-construction-msa-2025.pdf) | Contract / MSA baseline | Evaluation baseline — shall/must matrix |
| [`contract-keyword-check.docx`](contract-keyword-check.docx) | Keyword checklist | Contract keyword review profile |

Loaded by `loadSampleEvaluationWorkspace()` for the Scout **Evaluate an RFP** tour.

## Mark / takeoff pack (Scout mark journey)

| File | Role | Use in app |
|------|------|------------|
| [`windows-drawing.pdf`](windows-drawing.pdf) | Plan drawing | Primary sample — window stamp takeoff |
| [`plan-windows-sample.pdf`](plan-windows-sample.pdf) | Plan drawing alias | Same bytes as `windows-drawing.pdf` (QA/docs) |

Loaded by `loadSampleMarkupWorkspace()` for the Scout **Mark and takeoff** tour (pre-seeds 3 window stamps).

## Proposal pack (Scout generate journey)

| File | Role | Use in app |
|------|------|------------|
| [`dpr-construction-msa-2025.pdf`](dpr-construction-msa-2025.pdf) | Solicitation / RFP | Proposal baseline |
| [`files/buyer-rubric.md`](files/buyer-rubric.md) | Buyer rubric notes | Supporting context attachment |

Source: [`docs/DPR CONSTRUCTION  - Fully Executed MSA - 2025.pdf`](../docs/DPR%20CONSTRUCTION%20%20-%20Fully%20Executed%20MSA%20-%202025.pdf) (synced by `generate-sample-pdfs.mjs`).

Loaded by `loadSampleProposalWorkspace()` with pre-filled Summit Ridge Envelope responder context.

## RFP pack (legacy IT-services demo)

| File | Role | Use in app |
|------|------|------------|
| [`rfp-it-services.pdf`](rfp-it-services.pdf) | Issuer RFP | Upload first — requirements source |
| [`bidder-acme-response.pdf`](bidder-acme-response.pdf) | Bidder A | Strong match (CMMI, insurance, fixed fee) |
| [`bidder-contoso-response.pdf`](bidder-contoso-response.pdf) | Bidder B | Weaker match (gaps on cert, insurance, pricing) |
| [`demo-bidder-response.pdf`](demo-bidder-response.pdf) | Bidder demo | Quick upload — strong match for qualification demos |

### Suggested workflow (legacy pack)

1. Start dev server: `pnpm dev`
2. Choose **Analyse RFP** on the landing page
3. Upload all three PDFs from `public/sample/` (or drag from this folder after generation)
4. Open **Profiles** — compare Acme vs Contoso verdicts and criterion rows
5. Click a criterion or ask in chat: `find indemnification`

## Scope creep pack

| File | Role |
|------|------|
| `public/sample/minimal.pdf` | Minimal parse smoke test |
| `public/sample/minimal.docx`, `minimal.xlsx` | Word / Excel ingest demos |
| Markdown context | Upload any `.md` file — auto-tagged **Supporting** |

Tag PDFs **Baseline** and **Change** in the doc tab dropdown, add a `.md` context file, then run **Compare scope**.

## OCR / scan fixtures

| File | Purpose |
|------|---------|
| `public/sample/scanned.pdf` | OCR ingest path |
| `public/sample/ocr-test.png` | Tesseract harness image |

## Regenerate PDFs

```bash
node scripts/generate-sample-pdfs.mjs
```

This rewrites both `sample/` and `public/sample/` for the three RFP pack PDFs.
