import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/lib/auth'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { token } = useAuthStore()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!token) {
      router.replace('/login')
    }
  }, [token, router])

  if (!token) return null

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar mobileOpen={mobileOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
