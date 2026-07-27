import type { ReactNode } from 'react'

type AppShellProps = {
  children?: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f3f4f6] p-4">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#111827]">Browser Doc Agent Demo</h1>
        <p className="mt-2 text-[#6b7280]">Scaffold ready — shell components land in BDA-010.</p>
        {children}
      </main>
    </div>
  )
}
