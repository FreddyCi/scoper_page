import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2Icon, MicIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  isChatVoiceSessionActive,
  startChatVoiceSession,
  stopChatVoiceSession,
  type ChatVoiceSessionState,
} from '@/services/chat-voice-session'
import { getWhisperClient } from '@/services/whisper-client'
import { useSessionStore } from '@/store/session-store'

export type ChatVoiceButtonVisualState = 'idle' | 'loading' | 'listening'

export type ChatVoiceButtonLabelInput = {
  visual: ChatVoiceButtonVisualState
  webGpuAvailable: boolean | null
  agentBusy: boolean
  /** Composer-level disable (ingest, etc.). */
  disabled?: boolean
}

export function resolveChatVoiceButtonTooltip(input: ChatVoiceButtonLabelInput): string {
  if (input.webGpuAvailable === false) {
    return 'WebGPU required'
  }
  if (input.visual === 'loading') {
    return 'Loading…'
  }
  if (input.visual === 'listening') {
    return 'Stop listening'
  }
  return 'Start voice input'
}

export function resolveChatVoiceButtonAriaLabel(input: ChatVoiceButtonLabelInput): string {
  const tooltip = resolveChatVoiceButtonTooltip(input)
  if (input.agentBusy && input.visual !== 'listening') {
    return 'Voice input unavailable while the agent is busy'
  }
  if (input.disabled && input.visual !== 'listening') {
    return 'Voice input unavailable'
  }
  return tooltip
}

export type ChatVoiceButtonProps = {
  className?: string
  disabled?: boolean
  onPartial?: (text: string) => void
  onListeningChange?: (listening: boolean) => void
  onVoiceError?: (error: Error) => void
}

/** Mic toggle for on-device voice draft capture (BDA-189). */
export function ChatVoiceButton({
  className,
  disabled = false,
  onPartial,
  onListeningChange,
  onVoiceError,
}: ChatVoiceButtonProps) {
  const chatGenerating = useSessionStore((s) => s.chatGenerating)
  const proposalGenerating = useSessionStore((s) => s.proposalGenerating)
  const agentBusy = chatGenerating || proposalGenerating

  const [webGpuAvailable, setWebGpuAvailable] = useState<boolean | null>(null)
  const [sessionState, setSessionState] = useState<ChatVoiceSessionState>('idle')
  const onPartialRef = useRef(onPartial)
  const onListeningChangeRef = useRef(onListeningChange)
  const onVoiceErrorRef = useRef(onVoiceError)

  onPartialRef.current = onPartial
  onListeningChangeRef.current = onListeningChange
  onVoiceErrorRef.current = onVoiceError

  useEffect(() => {
    let cancelled = false
    void getWhisperClient()
      .probeEnvironment()
      .then((state) => {
        if (!cancelled) {
          setWebGpuAvailable(state.webGpuAvailable)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (isChatVoiceSessionActive()) {
        void stopChatVoiceSession()
      }
    }
  }, [])

  const isListening =
    sessionState === 'listening' || (sessionState !== 'idle' && isChatVoiceSessionActive())
  const isLoading = sessionState === 'starting' || sessionState === 'stopping'
  const visual: ChatVoiceButtonVisualState = isListening
    ? 'listening'
    : isLoading
      ? 'loading'
      : 'idle'

  const labelInput: ChatVoiceButtonLabelInput = {
    visual,
    webGpuAvailable,
    agentBusy,
    disabled,
  }
  const tooltip = resolveChatVoiceButtonTooltip(labelInput)
  const ariaLabel = resolveChatVoiceButtonAriaLabel(labelInput)

  const buttonDisabled =
    webGpuAvailable !== true ||
    isLoading ||
    ((agentBusy || disabled) && !isListening)

  const handleToggle = useCallback(async () => {
    if (isLoading) return

    if (isListening) {
      await stopChatVoiceSession()
      setSessionState('idle')
      onListeningChangeRef.current?.(false)
      return
    }

    if (buttonDisabled) return

    setSessionState('starting')
    const result = await startChatVoiceSession({
      onPartial: (text) => onPartialRef.current?.(text),
      onError: (error) => onVoiceErrorRef.current?.(error),
      onStateChange: (next) => setSessionState(next),
    })

    if (!result.ok) {
      setSessionState('idle')
      onVoiceErrorRef.current?.(new Error(result.message))
      return
    }

    onListeningChangeRef.current?.(true)
  }, [buttonDisabled, isListening, isLoading])

  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(
              'text-muted-foreground hover:text-foreground rounded-full',
              visual === 'listening' &&
                'text-red-600 ring-2 ring-red-400/70 ring-offset-1 ring-offset-background hover:text-red-700',
              className,
            )}
            aria-label={ariaLabel}
            aria-pressed={isListening}
            disabled={buttonDisabled}
            onClick={() => void handleToggle()}
          >
            {visual === 'loading' ? (
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <MicIcon className="size-3.5" aria-hidden />
            )}
          </Button>
        }
      />
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/** Dev harness — a11y strings (BDA-189). */
export function runChatVoiceButtonLabelsHarness(): void {
  const cases: { input: ChatVoiceButtonLabelInput; tooltip: string }[] = [
    {
      input: { visual: 'idle', webGpuAvailable: true, agentBusy: false },
      tooltip: 'Start voice input',
    },
    {
      input: { visual: 'loading', webGpuAvailable: true, agentBusy: false },
      tooltip: 'Loading…',
    },
    {
      input: { visual: 'listening', webGpuAvailable: true, agentBusy: false },
      tooltip: 'Stop listening',
    },
    {
      input: { visual: 'idle', webGpuAvailable: false, agentBusy: false },
      tooltip: 'WebGPU required',
    },
  ]

  for (const { input, tooltip } of cases) {
    const actual = resolveChatVoiceButtonTooltip(input)
    if (actual !== tooltip) {
      throw new Error(
        `runChatVoiceButtonLabelsHarness: expected tooltip ${JSON.stringify(tooltip)}, got ${JSON.stringify(actual)}`,
      )
    }
  }

  const busyAria = resolveChatVoiceButtonAriaLabel({
    visual: 'idle',
    webGpuAvailable: true,
    agentBusy: true,
  })
  if (!busyAria.includes('busy')) {
    throw new Error('runChatVoiceButtonLabelsHarness: agent busy aria label missing')
  }
}
