# Compliance matrix, instructions card, stamp takeoff

**Status:** Planned — see [TASK_BREAKDOWN_COMPLIANCE_MATRIX_TAKEOFF.md](../TASK_BREAKDOWN_COMPLIANCE_MATRIX_TAKEOFF.md) (BDA-259–276)  
**Created:** 2026-08-21  
**Overview:** Three Scoper-native deliverables: a shall/compliance matrix with CSV, an Instructions card on evaluation/proposal panels, and a stamp takeoff list with CSV. Local, cited, exportable — not Loopio or Bluebeam.

Stay in Scoper’s lane. Do **not** add content libraries, SAM.gov, realtime markup, or screen recording.

**Source plan:** [matrix_takeoff_instructions_187c9d3c](/Users/christopherkruger/.cursor/plans/matrix_takeoff_instructions_187c9d3c.plan.md)

---

## Context

Qualification today is three keyword rules in `build-rfp-profiles.ts`. `RfpRequirement` / `RfpRequirementsExtract` and `rfpRequirementsResponseSchema` exist and are unused. Shall/must regex lives in `compare-scope.ts` (`OBLIGATION_PATTERN`). Contract keyword checklist is a separate path and must not regress.

PDF LiteParse blocks have no `section_path`. Voice notation panel is page-scoped. No user-facing profile CSV.

---

## Explicit non-goals (v1)

- bitgpu / LLM shall extraction (`rfpRequirementsResponseSchema` later)
- Section L structured parser
- Excel-formatted matrix
- Custom criteria template library
- SAM.gov, content library, realtime markup, Scribe-style capture
