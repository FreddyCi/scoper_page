import { SCOUT_JOURNEY_ACCENTS, type ScoutJourney } from '@/lib/scout/types'
import { SCOUT_TARGETS } from '@/lib/scout/targets'

/** Mark plans and export a window-stamp takeoff (BDA-280). */
export const markTakeoffJourney: ScoutJourney = {
  id: 'mark_takeoff',
  title: 'Mark and takeoff',
  description:
    'Open a sample plan PDF, review window stamps, walk the doc-wide takeoff sheet, and export a CSV — like a lightweight plan markup pass.',
  accent: SCOUT_JOURNEY_ACCENTS.mark_takeoff,
  steps: [
    {
      id: 'load-sample',
      title: 'Load the sample plan sheet',
      body:
        'We ingest your marked Windows plan export (page 8 floor plan). Window stamps are burned into the PDF and wired into the takeoff sheet for export.',
      action: 'load_sample_markup',
    },
    {
      id: 'mark-mode',
      title: 'Enter Mark mode',
      body:
        'Mark mode overlays drawing tools on the PDF preview — pen, shapes, text, and window stamps for plan markup.',
      target: SCOUT_TARGETS.markToolbar,
      action: 'enable_mark_mode',
    },
    {
      id: 'place-stamps',
      title: 'Review window stamps',
      body:
        'Select the window stamp tool and place stamps on plan sheets, or use the pre-loaded demo marks. Each stamp can carry a voice note in the field.',
      target: SCOUT_TARGETS.markStampTool,
    },
    {
      id: 'takeoff-panel',
      title: 'Open the takeoff sheet',
      body:
        'The takeoff list aggregates every window stamp in the document — page, color, voice note, and count — across all sheets.',
      target: SCOUT_TARGETS.takeoffFooterPill,
      action: 'open_takeoff_panel',
    },
    {
      id: 'jump-to-mark',
      title: 'Jump to a stamp',
      body:
        'Click any takeoff row to fly the viewer to that page with the mark selected — or use the button below to jump to the first stamp automatically.',
      target: SCOUT_TARGETS.takeoffPanel,
      action: 'jump_to_takeoff_mark',
    },
    {
      id: 'export-csv',
      title: 'Export takeoff CSV',
      body:
        'Download a spreadsheet of stamp labels, colors, pages, and notes for estimating or handoff to your PM.',
      target: SCOUT_TARGETS.takeoffCsvExport,
      action: 'export_takeoff_csv',
    },
    {
      id: 'done',
      title: 'Plan markup tour complete',
      body:
        'Upload your own drawing PDFs, burn in marks on export, or round-trip annotations through a share pack. Try Evaluate RFP next if you have not yet.',
      manualContinue: true,
      action: 'complete_journey',
    },
  ],
}

/** Expected step count for harness assertions (BDA-280). */
export const MARK_TAKEOFF_JOURNEY_STEP_COUNT = 7
