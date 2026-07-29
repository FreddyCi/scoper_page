import { useEffect, useRef, useState } from 'react'
import { SparklesIcon, XIcon } from 'lucide-react'
import { Streamdown } from 'streamdown'

import { Button } from '@/components/ui/button'
import { EnhancePassageShimmer } from '@/components/ui/enhance-passage-shimmer'
import type { BlockRecord } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  generatePassageEnhancement,
  recordPassageEnhancement,
  scoperEnhanceModelLabel,
} from '@/services/enhance-passage'

type EnhancePassagePanelProps = {
  block: BlockRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecorded?: () => void
}

const BLOCK_EXCERPT_WORD_LIMIT = 30

function truncateWords(text: string, maxWords: number): { excerpt: string; isTruncated: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return { excerpt: text, isTruncated: false }
  }

  return {
    excerpt: `${words.slice(0, maxWords).join(' ')}…`,
    isTruncated: true,
  }
}

function SourceExcerpt({ text, blockId }: { text: string; blockId: string }) {
  const [expanded, setExpanded] = useState(false)
  const { excerpt, isTruncated } = truncateWords(text, BLOCK_EXCERPT_WORD_LIMIT)

  useEffect(() => {
    setExpanded(false)
  }, [blockId])

  return (
    <blockquote className="border-violet-400 bg-violet-50/70 text-foreground rounded-r-md border-l-4 px-3 py-2 text-xs leading-relaxed">
      <p>{expanded || !isTruncated ? text : excerpt}</p>
      {isTruncated ? (
        <button
          type="button"
          className="text-violet-800 hover:text-violet-950 mt-1 text-xs font-medium hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </blockquote>
  )
}

/** AI passage enhancement — Scoper 1.7 on-device generation with Recorded / Change actions. */
export function EnhancePassagePanel({
  block,
  open,
  onOpenChange,
  onRecorded,
}: EnhancePassagePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [instruction, setInstruction] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      setInstruction('')
      setGeneratedText('')
      setGenerating(false)
      setRecording(false)
      setError(null)
      return
    }

    if (!block) return

    void runEnhancement(block.text, '')
  }, [block?.block_id, open])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      onOpenChange(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  async function runEnhancement(passage: string, nextInstruction: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGenerating(true)
    setError(null)
    setGeneratedText('')

    try {
      const enhanced = await generatePassageEnhancement(passage, {
        instruction: nextInstruction,
        signal: controller.signal,
        onDelta: (delta) => {
          setGeneratedText((current) => current + delta)
        },
      })

      if (!controller.signal.aborted) {
        setGeneratedText(enhanced)
      }
    } catch (caught) {
      if (controller.signal.aborted) return
      const message =
        caught instanceof Error ? caught.message : 'Enhancement failed — try again.'
      setError(message)
    } finally {
      if (!controller.signal.aborted) {
        setGenerating(false)
      }
    }
  }

  function handleChange() {
    if (!block || generating) return
    void runEnhancement(block.text, instruction)
  }

  async function handleRecorded() {
    if (!block || generating || recording || !generatedText.trim()) return

    setRecording(true)
    setError(null)

    try {
      await recordPassageEnhancement(block, generatedText)
      onRecorded?.()
      onOpenChange(false)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not record enhancement'
      setError(message)
    } finally {
      setRecording(false)
    }
  }

  if (!open || !block) return null

  const canRecord = !generating && !recording && generatedText.trim().length > 0

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Enhance passage"
      className={cn(
        'border-violet-200/80 bg-surface shadow-elevated absolute top-3 right-3 left-3 z-30 flex max-h-[min(34rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border sm:left-auto sm:w-[min(22rem,calc(100vw-2rem))]',
      )}
    >
      <div className="border-border/70 shrink-0 space-y-2 border-b px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
              <SparklesIcon className="text-violet-700 size-4 shrink-0" />
              Enhance passage
            </h3>
            <p className="text-violet-800 text-[11px] font-medium">{scoperEnhanceModelLabel()}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close enhance panel"
            className="text-muted-foreground shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Scoper enhances this passage on-device. Use Change to regenerate, then Recorded to apply
          it to the markdown file.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
        <SourceExcerpt text={block.text} blockId={block.block_id} />

        <div className="space-y-1.5">
          <label htmlFor="enhance-instruction" className="text-violet-950 text-xs font-medium">
            Instruction
          </label>
          <textarea
            id="enhance-instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="e.g. Add bullet points, clarify wording, expand this section…"
            rows={2}
            disabled={generating || recording}
            className="border-violet-200/80 bg-white/90 text-foreground placeholder:text-muted-foreground focus-visible:border-violet-400 focus-visible:ring-violet-200/80 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          />
        </div>

        {generating && !generatedText ? <EnhancePassageShimmer /> : null}

        {generatedText ? (
          <div className="border-violet-200/70 bg-violet-50/30 max-h-56 space-y-1 overflow-y-auto rounded-xl border px-3 py-2.5">
            <p className="text-violet-900 text-[10px] font-semibold tracking-wide uppercase">
              Enhanced preview
            </p>
            <Streamdown
              mode="static"
              className="text-foreground prose-sm max-w-none text-sm leading-relaxed [&_p:last-child]:mb-0 [&_p]:my-0"
            >
              {generatedText}
            </Streamdown>
          </div>
        ) : null}

        {generating && generatedText ? (
          <p className="text-violet-800 text-xs font-medium">Still generating…</p>
        ) : null}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>

      <div className="border-border/70 bg-surface flex shrink-0 justify-end gap-2 border-t px-3 py-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={generating || recording}
          className="border-violet-200 text-violet-950 hover:bg-violet-50 rounded-full"
          onClick={handleChange}
        >
          Change
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canRecord}
          className="rounded-full bg-violet-950 text-white hover:bg-violet-900"
          onClick={() => void handleRecorded()}
        >
          {recording ? 'Recording…' : 'Recorded'}
        </Button>
      </div>
    </div>
  )
}
