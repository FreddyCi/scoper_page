import { MessageScrollerDemo } from '@/components/chat/MessageScrollerDemo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ChatSidebar() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs defaultValue="agent" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-border border-b px-4 py-2">
          <TabsList variant="line" className="h-auto bg-transparent p-0">
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agent" className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <MessageScrollerDemo />
        </TabsContent>

        <TabsContent value="history" className="text-muted-foreground px-4 py-3 text-sm">
          History tab — scope creep markers land in BDA-073.
        </TabsContent>
      </Tabs>

      <footer className="border-border border-t p-4">
        <div className="rounded-control border-border bg-workspace-muted text-subtle-foreground border px-3 py-2 text-sm">
          Ask the agent… @ to mention
        </div>
      </footer>
    </div>
  )
}
