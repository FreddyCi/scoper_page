import { Streamdown } from 'streamdown'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { cn } from '@/lib/utils'

type ChatMarkdownProps = {
  content: string
  streaming?: boolean
  className?: string
}

/** Assistant markdown via shadcn Bubble (ghost) + Streamdown (BDA streaming chat) */
export function ChatMarkdown({ content, streaming = false, className }: ChatMarkdownProps) {
  return (
    <Bubble variant="ghost" className={cn('w-full max-w-full', className)}>
      <BubbleContent className="w-full max-w-full">
        <Streamdown
          mode={streaming ? 'streaming' : 'static'}
          isAnimating={streaming}
          caret={streaming ? 'block' : undefined}
          parseIncompleteMarkdown={streaming}
          className="text-foreground min-w-0 text-sm leading-relaxed [&_table]:text-xs"
        >
          {content || (streaming ? 'Thinking…' : '')}
        </Streamdown>
      </BubbleContent>
    </Bubble>
  )
}
