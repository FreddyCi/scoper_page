import type { ReactNode } from 'react'

type AppShellProps = {
  children?: ReactNode
}

/**
 * Shell preview — full two-column layout lands in BDA-010.
 * Tokens match docs/main.png: gray canvas, workspace tint, white chat panel.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="bg-canvas min-h-screen p-[var(--spacing-shell)]">
      <div className="shadow-panel flex h-[calc(100vh-var(--spacing-shell)*2)] overflow-hidden rounded-panel">
        {/* Workspace ~65% */}
        <section className="bg-workspace flex min-w-0 flex-[1.85] flex-col">
          <header className="border-border flex items-center gap-3 border-b px-[var(--spacing-panel)] py-3">
            <span className="rounded-pill border-border bg-surface text-foreground inline-flex items-center gap-2 border px-3 py-1 text-sm font-medium">
              Untitled session
            </span>
            <span className="text-subtle-foreground text-xs">Saving</span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center px-[var(--spacing-panel)]">
            <h1 className="text-foreground text-xl font-semibold">Browser Doc Agent Demo</h1>
            <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
              Tailwind 4 design tokens configured — shell components land in BDA-010.
            </p>
            {children}
          </div>
          <footer className="text-subtle-foreground px-[var(--spacing-panel)] py-3 text-xs">
            Workspace
          </footer>
        </section>

        {/* Agent sidebar ~35% */}
        <aside className="bg-surface border-border flex min-w-0 flex-1 flex-col border-l">
          <header className="border-border flex items-center justify-between border-b px-4 py-3">
            <div className="flex gap-4 text-sm">
              <span className="text-foreground font-medium">Agent</span>
              <span className="text-muted-foreground">History</span>
            </div>
            <span className="text-subtle-foreground text-lg leading-none">×</span>
          </header>
          <div className="flex flex-1 items-center justify-center px-4">
            <p className="text-muted-foreground text-sm">Chat sidebar</p>
          </div>
          <footer className="border-border border-t p-4">
            <div className="rounded-control border-border bg-workspace-muted text-subtle-foreground border px-3 py-2 text-sm">
              Ask the agent… @ to mention
            </div>
          </footer>
        </aside>
      </div>
    </div>
  )
}
