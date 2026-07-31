import { useMemo } from 'react'
import {
  AlertCircleIcon,
  FilePenLineIcon,
  SearchIcon,
} from 'lucide-react'

import type { AgentActivityEntry } from '@/lib/agent-activity'
import {
  agentActivityEntryShimmer,
  agentActivityEntryUsesStatusRole,
  resolveAgentActivityTranscriptEntries,
  shouldShowAgentActivityStrip,
} from '@/lib/agent-activity'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type AgentActivityMarkerRowProps = {
  entry: AgentActivityEntry
}

function AgentActivityMarkerRow({ entry }: AgentActivityMarkerRowProps) {
  const detailSuffix = entry.detail ? ` · ${entry.detail}` : ''

  if (entry.kind === 'separator') {
    return (
      <Marker variant="separator">
        <MarkerContent>{entry.label}</MarkerContent>
      </Marker>
    )
  }

  if (entry.kind === 'ecp') {
    return (
      <Marker variant="border">
        <MarkerIcon>
          <SearchIcon />
        </MarkerIcon>
        <MarkerContent>
          {entry.label}
          {detailSuffix}
        </MarkerContent>
      </Marker>
    )
  }

  if (entry.kind === 'section_write') {
    return (
      <Marker variant="border">
        <MarkerIcon>
          <FilePenLineIcon />
        </MarkerIcon>
        <MarkerContent>
          {entry.label}
          {detailSuffix}
        </MarkerContent>
      </Marker>
    )
  }

  if (entry.kind === 'error') {
    return (
      <Marker variant="border">
        <MarkerIcon>
          <AlertCircleIcon className="text-destructive" />
        </MarkerIcon>
        <MarkerContent className="text-destructive">
          {entry.label}
          {detailSuffix}
        </MarkerContent>
      </Marker>
    )
  }

  const shimmer = agentActivityEntryShimmer(entry)
  const statusRole = agentActivityEntryUsesStatusRole(entry.kind)

  return (
    <Marker role={statusRole ? 'status' : undefined} aria-live={statusRole ? 'polite' : undefined}>
      <MarkerContent shimmer={shimmer}>
        {entry.label}
        {detailSuffix}
      </MarkerContent>
    </Marker>
  )
}

type AgentActivityMarkersProps = {
  className?: string
}

/** Live agent / proposal activity tail for the agent transcript (BDA-173). */
export function AgentActivityMarkers({ className }: AgentActivityMarkersProps) {
  const chatGenerating = useSessionStore((s) => s.chatGenerating)
  const proposalGenerating = useSessionStore((s) => s.proposalGenerating)
  const contextPhase = useSessionStore((s) => s.contextPhase)
  const agentActivityLog = useSessionStore((s) => s.agentActivityLog)

  const showStrip = shouldShowAgentActivityStrip({
    chatGenerating,
    proposalGenerating,
    contextPhase,
  })

  const entries = useMemo(
    () =>
      resolveAgentActivityTranscriptEntries(agentActivityLog, {
        chatGenerating,
        proposalGenerating,
        contextPhase,
      }),
    [agentActivityLog, chatGenerating, contextPhase, proposalGenerating],
  )

  if (!showStrip || entries.length === 0) {
    return null
  }

  return (
    <div
      className={cn('flex w-full flex-col gap-2 py-1', className)}
      data-slot="agent-activity-markers"
    >
      {entries.map((entry) => (
        <AgentActivityMarkerRow key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
