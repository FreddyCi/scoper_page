import { SparklesIcon } from 'lucide-react'

import { ChatActionProposalList } from '@/components/chat/ChatActionProposalRow'
import { CitationChipList } from '@/components/chat/CitationChip'
import { ChatCitationCardView } from '@/components/chat/ChatCitationCard'
import type { ChatMessage } from '@/lib/types'

type AssistantMessageBodyProps = {
  message: ChatMessage
}

export function AssistantMessageBody({ message }: AssistantMessageBodyProps) {
  const rich = message.rich

  if (!rich) {
    return <p className="text-foreground text-sm leading-relaxed">{message.text}</p>
  }

  return (
    <div className="space-y-4">
      {rich.headline ? (
        <div className="flex items-start gap-2">
          <SparklesIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <h3 className="text-foreground text-base font-semibold tracking-tight">
            {rich.headline}
          </h3>
        </div>
      ) : null}

      <div className="space-y-3">
        {rich.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-foreground text-sm leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {rich.citationChips?.length ? <CitationChipList citations={rich.citationChips} /> : null}

      {rich.citations?.length ? <ChatCitationCardView citations={rich.citations} /> : null}

      {rich.actions?.length ? (
        <ChatActionProposalList
          messageId={message.id}
          intro={rich.actionsIntro}
          actions={rich.actions}
        />
      ) : null}
    </div>
  )
}
